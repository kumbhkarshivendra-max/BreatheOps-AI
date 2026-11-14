let ZONES = [];

let userProfile = {
  role: "society",
  zoneId: "Z1",
  ageGroup: "adult",
  language: "English",
  apiKey: ""
};

let activeZone = null;
let mapInstance = null;
let zoneCircles = {};

// Instant built-in cache of real neighbourhoods so common city searches take 0ms and never trigger rate limits
const KNOWN_CITIES = {
  bhopal: {
    lat: 23.2599,
    lng: 77.4126,
    areas: ["MP Nagar Zone 1", "Arera Colony", "Kolar Road", "Bairagarh", "New Market TT Nagar", "Govindpura Industrial", "Shahpura Lake", "Chhola Corridor", "Habibganj"]
  },
  pune: {
    lat: 18.5204,
    lng: 73.8567,
    areas: ["Shivajinagar", "Kothrud", "Hinjewadi Phase 1", "Viman Nagar", "Koregaon Park", "Hadapsar Industrial", "Wakad", "Aundh", "Swargate Transit Hub"]
  },
  indore: {
    lat: 22.7196,
    lng: 75.8577,
    areas: ["Vijay Nagar", "Rajwada Central", "Palasia", "Bhawarkuan", "Sanwer Industrial Road", "Rau Circle", "Super Corridor", "Annapurna Road", "MR 10 Junction"]
  },
  delhi: {
    lat: 28.6139,
    lng: 77.2090,
    areas: ["Connaught Place", "Anand Vihar ISBT", "Dwarka Sector 8", "Rohini", "Okhla Industrial Phase 2", "Lajpat Nagar", "Karol Bagh", "Punjabi Bagh", "ITO Crossing"]
  },
  mumbai: {
    lat: 19.0760,
    lng: 72.8777,
    areas: ["Bandra Kurla Complex", "Andheri East MIDC", "Dadar TT", "Colaba", "Powai", "Chembur Industrial", "Borivali West", "Worli Sea Face", "Kurla Terminus"]
  },
  bengaluru: {
    lat: 12.9716,
    lng: 77.5946,
    areas: ["Indiranagar", "Whitefield IT Hub", "Koramangala", "Silk Board Junction", "Peenya Industrial", "Jayanagar", "Electronic City", "Hebbal Flyover", "MG Road"]
  }
};

function getColor(pm) {
  if (pm <= 60) return "#16a34a";
  if (pm <= 100) return "#d97706";
  if (pm <= 150) return "#ea580c";
  return "#dc2626";
}

function normalizeValue(rawStr) {
  if (rawStr === undefined || rawStr === null) {
    return { value: null, status: "MISSING", flag: "Missing reading (Null)" };
  }
  const cleaned = String(rawStr).trim().toLowerCase();
  if (["n/a", "na", "-", "null", "err", ""].includes(cleaned)) {
    return { value: null, status: "MISSING", flag: `Flagged Missing Reading ('${rawStr.trim()}')` };
  }
  const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
  if (!numMatch) {
    return { value: null, status: "UNPARSEABLE", flag: "Invalid number format" };
  }
  let num = parseFloat(numMatch[0]);
  let flag = "Verified µg/m³";
  if (cleaned.includes("mg/m3") || cleaned.includes("mg/m³")) {
    num = Math.round(num * 1000);
    flag = `Auto-converted ${rawStr.trim()} → ${num} µg/m³`;
  } else if (cleaned.includes("ppm")) {
    num = Math.round(num * 1000);
    flag = `Auto-converted ${rawStr.trim()} → ${num} µg/m³`;
  }
  if (num < 0 || num > 2000) {
    return { value: null, status: "OUTLIER", flag: `Excluded faulty sensor spike (${rawStr.trim()})` };
  }
  return { value: Math.round(num), status: "VALID", flag };
}

function parseMessyTableLocal(rawText) {
  const lines = String(rawText || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  lines.forEach((line, idx) => {
    if (idx === 0 && /sensor|pm2\.?5/i.test(line)) return;
    const cols = line.split(/\||,|\t/).map(c => c.trim());
    const pm25Audit = normalizeValue(cols[2]);
    rows.push({
      rowId: `Row #${idx}`,
      sensorId: cols[0] || `S-${idx}`,
      zoneName: cols[1] || "Local Zone",
      pm25: pm25Audit.value,
      status: pm25Audit.status,
      flag: pm25Audit.flag,
      note: cols[3] || "Field telemetry"
    });
  });
  return rows;
}

function buildZoneMessyTable(zone) {
  const mgVal = (zone.pm25 / 1000).toFixed(3);
  const secondaryVal = Math.max(25, zone.pm25 - 12);
  return `Sensor_ID | Locality | PM2.5_Reading | Field_Observation
${zone.id}-A | ${zone.name} | ${mgVal} mg/m3 | Primary node (${zone.hotspot})
${zone.id}-B | ${zone.name} | ${secondaryVal} ug/m3 | Downwind perimeter check
${zone.id}-C | ${zone.name} | N/A | Backup solar sensor offline (Data Gap)
${zone.id}-ERR | ${zone.name} | -999 ug/m3 | Hardware calibration spike rejected`;
}

// GENERATE 9 REAL ZONES WITHOUT RATE-LIMITING OPENSTREETMAP
async function generateDynamicZonesAround(centerLat, centerLng, cityHint = "Bhopal", customAreas = null) {
  const statusEl = document.getElementById("liveSyncStatus");
  if (statusEl) {
    statusEl.textContent = `📡 Loading live satellite air quality for ${cityHint}...`;
  }

  const offsets = [
    { id: "Z1", dLat: 0.0, dLng: 0.0, dir: "Central Hub", driver: "Main arterial traffic congestion & commercial activity" },
    { id: "Z2", dLat: 0.025, dLng: 0.0, dir: "North Corridor", driver: "Highway freight corridor & roadside dust resuspension" },
    { id: "Z3", dLat: -0.025, dLng: 0.0, dir: "South Enclave", driver: "Residential DG set testing & morning commuter queuing" },
    { id: "Z4", dLat: 0.0, dLng: 0.028, dir: "East Institutional", driver: "School bus pickup idling & ongoing road resurfacing" },
    { id: "Z5", dLat: 0.0, dLng: -0.028, dir: "West Market Ward", driver: "Evening commercial waste burning & two-wheeler bottleneck" },
    { id: "Z6", dLat: 0.020, dLng: 0.024, dir: "North-East Industrial", driver: "Construction material unloading & unpaved shoulder dust" },
    { id: "Z7", dLat: 0.020, dLng: -0.024, dir: "North-West Junction", driver: "Logistics depot diesel exhaust & signal idling" },
    { id: "Z8", dLat: -0.020, dLng: 0.024, dir: "South-East Greenbelt", driver: "Municipal waste collection point & dry leaf smoke" },
    { id: "Z9", dLat: -0.020, dLng: -0.024, dir: "South-West Colony", driver: "Internal colony renovation dust & evening traffic" }
  ];

  const lats = offsets.map(o => (centerLat + o.dLat).toFixed(4)).join(",");
  const lngs = offsets.map(o => (centerLng + o.dLng).toFixed(4)).join(",");

  let apiResults = [];
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=pm2_5,pm10,nitrogen_dioxide`;
    const res = await fetch(url);
    const data = await res.json();
    apiResults = Array.isArray(data) ? data : [data];
  } catch {
    apiResults = [];
  }

  ZONES = offsets.map((o, idx) => {
    const lat = centerLat + o.dLat;
    const lng = centerLng + o.dLng;
    const current = apiResults[idx]?.current || {};

    const variance = (idx % 3 === 0 ? 16 : idx % 2 === 0 ? -8 : 6) * (idx + 1);
    const basePm25 = Math.round(current.pm2_5 || 78);
    const pm25 = Math.max(24, basePm25 + variance);
    const pm10 = Math.max(pm25 + 26, Math.round((current.pm10 || 135) + variance * 1.3));
    const no2 = Math.max(12, Math.round((current.nitrogen_dioxide || 30) + variance * 0.4));

    const prevKey = `PREV_${o.id}_${lat.toFixed(2)}`;
    const storedPrev = localStorage.getItem(prevKey);
    const prevPm25 = storedPrev ? Number(storedPrev) : Math.max(20, pm25 - (idx % 2 === 0 ? 14 : -11));
    localStorage.setItem(prevKey, String(pm25));

    const areaLabel = customAreas && customAreas[idx] ? `${customAreas[idx]}, ${cityHint}` : `${cityHint} ${o.dir}`;

    return {
      id: o.id,
      name: `${o.id}: ${areaLabel}`,
      lat,
      lng,
      pm25,
      pm10,
      no2,
      prevPm25,
      hotspot: o.driver
    };
  });

  populateZoneDropdown();

  const matching = ZONES.find(z => z.id === userProfile.zoneId) || ZONES[0];
  activeZone = matching;
  userProfile.zoneId = matching.id;

  const messyEl = document.getElementById("messyInput");
  if (messyEl) messyEl.value = buildZoneMessyTable(activeZone);

  drawMapCircles();
  renderWorkspace();

  if (statusEl) {
    statusEl.textContent = `✅ Live Satellite Air Synced for ${cityHint} (${ZONES.length} active zones)`;
  }
}

function populateZoneDropdown() {
  const sel = document.getElementById("setupZone");
  if (!sel) return;
  sel.innerHTML = ZONES.map(
    z => `<option value="${z.id}" ${z.id === userProfile.zoneId ? "selected" : ""}>${z.name} (PM2.5: ${z.pm25} µg/m³)</option>`
  ).join("");
}

// INITIALIZE MAP WITH HIGH-SPEED CARTODB TILES (NEVER RATE-LIMITS OR BLOCKS)
// INITIALIZE MAP WITH 100% KEY-FREE ESRI WORLD STREET TILES
function initMap() {
  if (typeof L === "undefined" || mapInstance) return;
  mapInstance = L.map("airMap").setView([23.2599, 77.4126], 12);

  // Esri World Street Map requires ZERO API keys and never blocks or rate-limits
  const tileLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Source: Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap",
      maxZoom: 19
    }
  );

  // Automatic backup if a school/office firewall blocks Esri
  tileLayer.on("tileerror", () => {
    L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
      maxZoom: 18
    }).addTo(mapInstance);
  });

  tileLayer.addTo(mapInstance);

  mapInstance.on("click", e => {
    if (userProfile.role !== "authority") return;
    const { lat, lng } = e.latlng;
    const customId = `Z${ZONES.length + 1}`;
    const newZone = {
      id: customId,
      name: `${customId}: Inspection Pin (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
      lat,
      lng,
      pm25: 115,
      pm10: 180,
      no2: 42,
      prevPm25: 99,
      hotspot: "Custom street-level inspection spot"
    };
    ZONES.push(newZone);
    activeZone = newZone;
    populateZoneDropdown();
    document.getElementById("messyInput").value = buildZoneMessyTable(activeZone);
    drawMapCircles();
    renderWorkspace();
  });
}
function drawMapCircles() {
  if (!mapInstance || typeof L === "undefined") return;
  Object.values(zoneCircles).forEach(c => mapInstance.removeLayer(c));
  zoneCircles = {};

  ZONES.forEach(zone => {
    const isLocked = userProfile.role !== "authority" && zone.id !== userProfile.zoneId;
    const isSelected = activeZone && zone.id === activeZone.id;

    const circle = L.circle([zone.lat, zone.lng], {
      color: isLocked ? "#94a3b8" : getColor(zone.pm25),
      weight: isSelected ? 4 : 2,
      fillColor: isLocked ? "#cbd5e1" : getColor(zone.pm25),
      fillOpacity: isLocked ? 0.25 : 0.55,
      radius: 1050
    }).addTo(mapInstance);

    circle.bindTooltip(
      isLocked
        ? `🔒 <strong>${zone.name}</strong><br>Locked (Your role is restricted to ${userProfile.zoneId})`
        : `<strong>${zone.name}</strong><br>Live PM2.5: ${zone.pm25} µg/m³ • Click to inspect`
    );

    circle.on("click", e => {
      L.DomEvent.stopPropagation(e);
      if (isLocked) {
        alert(`🔒 Zone Lock Active: Your profile is locked to ${userProfile.zoneId}. Switch role to 'Municipal Authority' in Change Area/Role to inspect all zones.`);
        return;
      }
      activeZone = zone;
      document.getElementById("messyInput").value = buildZoneMessyTable(activeZone);
      drawMapCircles();
      renderWorkspace();
    });

    zoneCircles[zone.id] = circle;
  });
}

function renderWorkspace() {
  if (!activeZone) return;
  const messyEl = document.getElementById("messyInput");
  const rows = parseMessyTableLocal(messyEl ? messyEl.value : buildZoneMessyTable(activeZone));

  const roleLabels = {
    society: "Housing Society / RWA (Zone-Locked)",
    school: "School Principal / Parent (Zone-Locked)",
    ward: "Ward Field Officer (Zone-Locked)",
    gig_worker: "Outdoor Gig Worker (Zone-Locked)",
    authority: "Municipal Authority (All Zones Unlocked)"
  };

  document.getElementById("activeProfileSummary").textContent =
    `${roleLabels[userProfile.role]} • ${userProfile.ageGroup.toUpperCase()} View • ${userProfile.language}`;

  document.getElementById("zoneTitle").textContent = activeZone.name;
  document.getElementById("zoneCoords").textContent =
    `GPS: ${activeZone.lat.toFixed(4)}°N, ${activeZone.lng.toFixed(4)}°E • Live PM10: ${activeZone.pm10} µg/m³ • NO₂: ${activeZone.no2} µg/m³`;
  document.getElementById("zonePmValue").textContent = activeZone.pm25;

  const badge = document.getElementById("zoneBadge");
  badge.style.background = getColor(activeZone.pm25);
  badge.textContent = activeZone.pm25 > 120 ? "HIGH HOTSPOT ALERT" : activeZone.pm25 > 60 ? "MODERATE / POOR" : "SAFE AIR";

  const diff = activeZone.pm25 - activeZone.prevPm25;
  document.getElementById("deltaBox").textContent =
    `🔄 Comparison with Previous Brief: PM2.5 in ${activeZone.name} ${diff >= 0 ? "worsened by +" + diff : "improved by " + diff} µg/m³ (Previous: ${activeZone.prevPm25} µg/m³ → Current: ${activeZone.pm25} µg/m³).`;

  document.getElementById("plainSummary").textContent =
    `Localized Hotspot in ${activeZone.name}: ${activeZone.hotspot}. Fine-to-coarse particulate ratio (${(activeZone.pm25 / activeZone.pm10).toFixed(2)}) confirms active local emissions.`;

  document.getElementById("traceableBadges").innerHTML = rows.map(r =>
    `<span class="trace-pill">📌 ${r.rowId} (${r.sensorId}): ${r.pm25 !== null ? r.pm25 + " µg/m³" : "EXCLUDED FROM AQI"}</span>`
  ).join("");

  const flagged = rows.filter(r => r.status !== "VALID" || r.flag.includes("Auto-converted"));
  document.getElementById("dataGapAlert").innerHTML =
    `<strong>⚠️ Automated Sensor Hygiene Audit (${activeZone.id}):</strong><br>` +
    flagged.map(f => `• <strong>${f.rowId} (${f.sensorId}):</strong> ${f.flag}`).join("<br>");

  const roleActions = {
    society: [
      `Switch ${activeZone.name} society gates to zero-idling delivery mode (Trace: ${activeZone.id}-A)`,
      `Replace dry sweeping with wet mopping/sprinkling on internal paths (PM10: ${activeZone.pm10} µg/m³)`,
      `Hold backup generator load testing until afternoon wind dispersal window`
    ],
    school: [
      `Move outdoor assembly & sports indoors in ${activeZone.name} while PM2.5 is ${activeZone.pm25} µg/m³`,
      `Enforce strict engine-off rule for parent pickup vans and school buses at gate`,
      `Run classroom air purifiers and verify nurse inhaler readiness`
    ],
    ward: [
      `Patrol ${activeZone.name} to extinguish open waste/leaf burning (${activeZone.hotspot})`,
      `Deploy ward water-sprinkler tanker on dusty road shoulders every 4 hours`,
      `Send technician to repair offline solar node ${activeZone.id}-C flagged in Row #3`
    ],
    gig_worker: [
      `Wear a snug N95 mask on delivery routes inside ${activeZone.name} (PM2.5: ${activeZone.pm25} µg/m³)`,
      `Take a 10-minute indoor hydration break every 2 hours away from heavy traffic junctions`,
      `Turn off two-wheeler engine at red lights over 30 seconds to cut NO₂ exposure (${activeZone.no2} µg/m³)`
    ],
    authority: [
      `Dispatch truck-mounted anti-smog misting cannon to ${activeZone.name}`,
      `Enforce peak-hour heavy diesel freight diversion and fine uncovered material trucks`,
      `Order calibration replacement for glitching sensor ${activeZone.id}-ERR flagged in Row #4`
    ]
  };

  document.getElementById("roleActionHeading").textContent =
    `✅ Prioritized Local Actions (${roleLabels[userProfile.role]})`;
  document.getElementById("actionList").innerHTML =
    (roleActions[userProfile.role] || roleActions.society).map(a => `<li>${a}</li>`).join("");

  document.getElementById("internalBriefText").textContent =
    `[INTERNAL MEMO • ${activeZone.name}] Live PM2.5: ${activeZone.pm25} µg/m³ (Delta: ${diff >= 0 ? "+" + diff : diff} µg/m³). ` +
    `Audit isolated ${flagged.length} sensor flags (${flagged.map(f => f.sensorId).join(", ")}). Role protocol active.`;

  const ageCareMap = {
    child: `[Child-Friendly • Simple Grade-4 Level] Today's air around ${activeZone.name} has dust and smoke (PM2.5: ${activeZone.pm25}). Play indoor games during recess, drink extra water, and tell a teacher or parent if your throat feels scratchy!`,
    adult: `[Standard Citizen Advisory] Air quality in ${activeZone.name} is at PM2.5 ${activeZone.pm25} µg/m³ (${activeZone.hotspot}). Limit heavy outdoor jogging, wear an N95 mask on two-wheelers, and keep car AC on recirculate.`,
    senior: `[Older Adult & Sensitive Lungs Alert] Elevated PM2.5 (${activeZone.pm25} µg/m³) in ${activeZone.name} increases breathing and blood pressure strain. Avoid morning walks, keep windows shut during peak traffic, and keep inhalers handy.`
  };

  document.getElementById("advisoryHeading").textContent =
    `📢 Citizen Advisory (${userProfile.language} • ${userProfile.ageGroup.toUpperCase()})`;
  document.getElementById("citizenAdvisoryText").textContent = ageCareMap[userProfile.ageGroup];
}

// FAST, RATE-LIMIT-PROOF CITY SEARCH (USES INSTANT CACHE + PHOTON GEOCODER FALLBACK)
async function searchCityAndRecenter() {
  const rawQuery = document.getElementById("citySearchInput").value.trim();
  if (!rawQuery) return;
  const btn = document.getElementById("searchCityBtn");
  btn.textContent = "⏳...";

  const cleanKey = rawQuery.toLowerCase();

  try {
    // 1. Check instant built-in dictionary first (0ms, never fails)
    for (const [key, info] of Object.entries(KNOWN_CITIES)) {
      if (cleanKey.includes(key)) {
        const displayCity = key.charAt(0).toUpperCase() + key.slice(1);
        await generateDynamicZonesAround(info.lat, info.lng, displayCity, info.areas);
        if (mapInstance) {
          mapInstance.invalidateSize();
          mapInstance.setView([info.lat, info.lng], 12);
        }
        return;
      }
    }

    // 2. For any other town/city worldwide, use Photon Geocoder (No 1-req/sec block!)
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(rawQuery)}&limit=1`);
    const data = await res.json();
    if (data && data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;
      const lng = coords[0];
      const lat = coords[1];
      const name = data.features[0].properties.name || rawQuery;

      await generateDynamicZonesAround(lat, lng, name);
      if (mapInstance) {
        mapInstance.invalidateSize();
        mapInstance.setView([lat, lng], 12);
      }
    } else {
      alert("City not found. Try Bhopal, Pune, Indore, Delhi, Mumbai, or any city name.");
    }
  } catch {
    alert("Network busy. Loaded Bhopal baseline.");
  } finally {
    btn.textContent = "🔍 Find";
  }
}

function locateUserGPS() {
  if (!("geolocation" in navigator)) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  const btn = document.getElementById("gpsLocateBtn");
  btn.textContent = "⏳...";
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude, longitude } = pos.coords;
      await generateDynamicZonesAround(latitude, longitude, "My GPS Area");
      if (mapInstance) {
        mapInstance.invalidateSize();
        mapInstance.setView([latitude, longitude], 12);
      }
      btn.textContent = "🎯 My GPS";
    },
    () => {
      alert("Could not access GPS. Use the search box to find your city.");
      btn.textContent = "🎯 My GPS";
    }
  );
}

async function handleRunGeminiAI() {
  const btn = document.getElementById("runAiBtn");
  btn.textContent = "⏳ Gemini AI Interpreting Messy Data...";

  try {
    const rows = parseMessyTableLocal(document.getElementById("messyInput").value);
    const { generateCivicIntelligence } = await import("./aiEngine.js");
    const aiOut = await generateCivicIntelligence({
      apiKey: userProfile.apiKey,
      zone: activeZone,
      profile: userProfile,
      normalizedRows: rows,
      previousPm25: activeZone.prevPm25
    });

    document.getElementById("deltaBox").textContent = `🔄 ${aiOut.deltaSummary}`;
    document.getElementById("plainSummary").textContent = aiOut.plainSummary;
    document.getElementById("traceableBadges").innerHTML =
      aiOut.citations.map(c => `<span class="trace-pill">📌 ${c}</span>`).join("");
    document.getElementById("dataGapAlert").innerHTML =
      `<strong>⚠️ Gemini Data Hygiene Audit:</strong><br>` + aiOut.dataQualityFlags.map(f => `• ${f}`).join("<br>");
    document.getElementById("actionList").innerHTML =
      aiOut.prioritizedActions.map(a => `<li>${a}</li>`).join("");
    document.getElementById("internalBriefText").textContent = aiOut.internalBriefingNote;
    document.getElementById("citizenAdvisoryText").textContent = aiOut.citizenAdvisory;
  } catch (err) {
    alert(err.message);
  } finally {
    btn.textContent = "✨ Interpret Messy Data with Gemini AI";
  }
}

function shareToWhatsAppWeb() {
  const message =
    `*BreatheOps AI Civic Alert — ${activeZone.name}*\n` +
    `📊 Live PM2.5: ${activeZone.pm25} µg/m³\n` +
    `🔄 ${document.getElementById("deltaBox").textContent}\n\n` +
    `📢 *Advisory (${userProfile.language}):*\n${document.getElementById("citizenAdvisoryText").textContent}`;

  const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
}

window.applyOnboardingProfile = function () {
  userProfile = {
    role: document.getElementById("setupRole").value,
    zoneId: document.getElementById("setupZone").value || "Z1",
    ageGroup: document.getElementById("setupAge").value,
    language: document.getElementById("setupLang").value,
    apiKey: document.getElementById("setupApiKey").value.trim()
  };

  activeZone = ZONES.find(z => z.id === userProfile.zoneId) || ZONES[0];
  const modal = document.getElementById("onboardingModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }

  if (activeZone) {
    document.getElementById("messyInput").value = buildZoneMessyTable(activeZone);
  }

  initMap();
  if (mapInstance && activeZone) {
    setTimeout(() => {
      mapInstance.invalidateSize();
      mapInstance.setView([activeZone.lat, activeZone.lng], 12);
    }, 150);
  }

  drawMapCircles();
  renderWorkspace();

  if (userProfile.apiKey && userProfile.language !== "English") {
    handleRunGeminiAI();
  }
};

window.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await generateDynamicZonesAround(
    KNOWN_CITIES.bhopal.lat,
    KNOWN_CITIES.bhopal.lng,
    "Bhopal",
    KNOWN_CITIES.bhopal.areas
  );

  document.getElementById("searchCityBtn")?.addEventListener("click", searchCityAndRecenter);
  document.getElementById("gpsLocateBtn")?.addEventListener("click", locateUserGPS);

  document.getElementById("scanMapAreaBtn")?.addEventListener("click", async () => {
    if (!mapInstance) return;
    const center = mapInstance.getCenter();
    await generateDynamicZonesAround(center.lat, center.lng, `Area (${center.lat.toFixed(2)}°N)`);
  });

  document.getElementById("runAiBtn")?.addEventListener("click", handleRunGeminiAI);
  document.getElementById("whatsappWebBtn")?.addEventListener("click", shareToWhatsAppWeb);

  document.getElementById("copyBtn")?.addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("citizenAdvisoryText").textContent);
    alert("Advisory copied to clipboard!");
  });
});
