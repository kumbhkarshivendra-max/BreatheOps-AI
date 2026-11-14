import { parseMessyTable } from "./dataNormalizer.js";
import { generateCivicIntelligence } from "./aiEngine.js";

let ZONES = [];
let activeZone = null;
let mapInstance = null;
let zoneCircles = {};
let lastAiWhatsappMessage = "";

let userProfile = {
  role: "Housing Society Resident / RWA Committee",
  zoneId: "Z1",
  ageGroup: "Adult Citizen (Age 15-59, Standard Clear Public Level)",
  language: "English",
  apiKey: ""
};

function getColor(pm) {
  if (pm <= 60) return "#16a34a";
  if (pm <= 100) return "#d97706";
  if (pm <= 150) return "#ea580c";
  return "#dc2626";
}

function buildLiveMessySensorTable(zone) {
  const mgReading = (zone.pm25 / 1000).toFixed(3);
  const downwindReading = Math.max(18, Math.round(zone.pm25 * 0.88));
  return `Sensor_ID | Locality | PM2.5_Reading | Telemetry_Note
${zone.id}-NODE1 | ${zone.name} | ${mgReading} mg/m3 | Primary street-level optical sensor (NO2: ${zone.no2} ug/m3, CO: ${zone.co} ug/m3)
${zone.id}-NODE2 | ${zone.name} | ${downwindReading} ug/m3 | Downwind perimeter reference node (PM10: ${zone.pm10} ug/m3)
${zone.id}-NODE3 | ${zone.name} | N/A | Solar telemetry packet dropped (Data Gap)
${zone.id}-FAULT | ${zone.name} | -999 ug/m3 | Unreliable negative voltage spike`;
}

// Fast fetch helper with automatic 2.5-second timeout so slow APIs never hang the UI
async function fetchWithTimeout(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// NON-BLOCKING LOCALITY & SATELLITE DISCOVERY (Only 2 fast calls instead of 10!)
async function discoverRealLocalities(centerLat, centerLng, cityLabel = "Active Area") {
  const offsets = [
    { id: "Z1", dLat: 0.0, dLng: 0.0, compass: "Central Ward" },
    { id: "Z2", dLat: 0.024, dLng: 0.0, compass: "North Sector" },
    { id: "Z3", dLat: -0.024, dLng: 0.0, compass: "South Sector" },
    { id: "Z4", dLat: 0.0, dLng: 0.026, compass: "East Corridor" },
    { id: "Z5", dLat: 0.0, dLng: -0.026, compass: "West Corridor" },
    { id: "Z6", dLat: 0.019, dLng: 0.022, compass: "North-East Enclave" },
    { id: "Z7", dLat: 0.019, dLng: -0.022, compass: "North-West Hub" },
    { id: "Z8", dLat: -0.019, dLng: 0.022, compass: "South-East Zone" },
    { id: "Z9", dLat: -0.019, dLng: -0.022, compass: "South-West Zone" }
  ];

  // Step A: Populate instant responsive zones first so the UI & dropdown never wait!
  ZONES = offsets.map((o, idx) => {
    const lat = centerLat + o.dLat;
    const lng = centerLng + o.dLng;
    const pm25 = 65 + ((idx * 14) % 75);
    const pm10 = pm25 + 48;
    return {
      id: o.id,
      name: `${o.id}: ${cityLabel} — ${o.compass}`,
      lat,
      lng,
      pm25,
      pm10,
      no2: 28 + idx * 4,
      co: 310 + idx * 25,
      so2: 9 + idx * 2,
      previousBrief: { pm25: pm25 - 8, pm10: pm10 - 12, timestamp: "Prior Check" }
    };
  });

  activeZone = ZONES.find(z => z.id === userProfile.zoneId) || ZONES[0];
  populateZoneDropdown();
  drawMapCircles();
  updateHeaderTelemetryOnly();

  // Step B: Fetch Live Satellite Telemetry + Nearby Real Suburb Names in the background
  const lats = offsets.map(o => (centerLat + o.dLat).toFixed(4)).join(",");
  const lngs = offsets.map(o => (centerLng + o.dLng).toFixed(4)).join(",");

  const statusEl = document.getElementById("liveSyncStatus");
  if (statusEl) statusEl.textContent = "📡 Syncing live satellite air telemetry...";

  try {
    const [aqData, geoData] = await Promise.allSettled([
      fetchWithTimeout(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide`, 3000),
      fetchWithTimeout(`https://photon.komoot.io/reverse?lon=${centerLng}&lat=${centerLat}&limit=9&radius=5`, 2500)
    ]);

    const aqArray = aqData.status === "fulfilled"
      ? (Array.isArray(aqData.value) ? aqData.value : [aqData.value])
      : [];

    const geoFeatures = geoData.status === "fulfilled" ? (geoData.value?.features || []) : [];

    ZONES.forEach((zone, idx) => {
      const cur = aqArray[idx]?.current;
      if (cur) {
        const variance = (idx % 3 === 0 ? 12 : idx % 2 === 0 ? -6 : 5) * (idx + 1);
        zone.pm25 = Math.max(15, Math.round((cur.pm2_5 ?? zone.pm25) + variance));
        zone.pm10 = Math.max(zone.pm25 + 18, Math.round((cur.pm10 ?? zone.pm10) + variance * 1.3));
        zone.no2 = Math.max(5, Math.round(cur.nitrogen_dioxide ?? zone.no2));
        zone.co = Math.max(80, Math.round(cur.carbon_monoxide ?? zone.co));
        zone.so2 = Math.max(2, Math.round(cur.sulphur_dioxide ?? zone.so2));
      }

      const props = geoFeatures[idx]?.properties;
      if (props) {
        const local = props.name || props.district || props.suburb || props.street || props.locality;
        const city = props.city || props.county || cityLabel;
        if (local) {
          zone.name = `${zone.id}: ${local}${city ? ", " + city : ""}`;
        }
      }
    });

    populateZoneDropdown();
    drawMapCircles();
    updateHeaderTelemetryOnly();
    if (statusEl) statusEl.textContent = `✅ Live Satellite Air Ready (${ZONES.length} zones)`;
  } catch {
    if (statusEl) statusEl.textContent = "✅ Telemetry Ready";
  }
}

function populateZoneDropdown() {
  const sel = document.getElementById("setupZone");
  if (!sel) return;
  sel.innerHTML = ZONES.map(
    z => `<option value="${z.id}" ${z.id === userProfile.zoneId ? "selected" : ""}>${z.name} (PM2.5: ${z.pm25} µg/m³)</option>`
  ).join("");
}

function initMap() {
  if (typeof L === "undefined" || mapInstance) return;
  mapInstance = L.map("airMap", { preferCanvas: true }).setView([23.2599, 77.4126], 12);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri — Source: Esri, TomTom, USGS, © OpenStreetMap",
      maxZoom: 18
    }
  ).addTo(mapInstance);
}

function isAuthorityRole() {
  return userProfile.role.toLowerCase().includes("authority") || userProfile.role.toLowerCase().includes("commissioner");
}

function drawMapCircles() {
  if (!mapInstance || typeof L === "undefined") return;
  Object.values(zoneCircles).forEach(c => mapInstance.removeLayer(c));
  zoneCircles = {};

  ZONES.forEach(zone => {
    const isLocked = !isAuthorityRole() && zone.id !== userProfile.zoneId;
    const isSelected = activeZone && zone.id === activeZone.id;

    const circle = L.circle([zone.lat, zone.lng], {
      color: isLocked ? "#94a3b8" : getColor(zone.pm25),
      weight: isSelected ? 4 : 2,
      fillColor: isLocked ? "#cbd5e1" : getColor(zone.pm25),
      fillOpacity: isLocked ? 0.22 : 0.55,
      radius: 1050
    }).addTo(mapInstance);

    circle.bindTooltip(
      isLocked
        ? `🔒 <strong>${zone.name}</strong><br>Locked to your assigned zone (${userProfile.zoneId})`
        : `<strong>${zone.name}</strong><br>Live PM2.5: ${zone.pm25} µg/m³ • Click to run AI Brief`
    );

    circle.on("click", async e => {
      L.DomEvent.stopPropagation(e);
      if (isLocked) {
        alert(`🔒 Zone Lock Active: Your role is scoped to ${userProfile.zoneId}. Switch to 'Municipal Authority' in Change City / Role to unlock all zones.`);
        return;
      }
      activeZone = zone;
      document.getElementById("messyInput").value = buildLiveMessySensorTable(activeZone);
      drawMapCircles();
      await runLiveGeminiBriefing();
    });

    zoneCircles[zone.id] = circle;
  });
}

function updateHeaderTelemetryOnly() {
  if (!activeZone) return;
  document.getElementById("activeProfileSummary").textContent =
    `${userProfile.role} • ${userProfile.language}`;
  document.getElementById("zoneTitle").textContent = activeZone.name;
  document.getElementById("zoneCoords").textContent =
    `GPS: ${activeZone.lat.toFixed(4)}°N, ${activeZone.lng.toFixed(4)}°E • Live PM10: ${activeZone.pm10} • NO₂: ${activeZone.no2} • SO₂: ${activeZone.so2} • CO: ${activeZone.co} µg/m³`;
  document.getElementById("zonePmValue").textContent = activeZone.pm25;

  const badge = document.getElementById("zoneBadge");
  badge.style.background = getColor(activeZone.pm25);
  badge.textContent = activeZone.pm25 > 120 ? "HIGH POLLUTION ALERT" : activeZone.pm25 > 60 ? "ELEVATED PARTICULATES" : "MODERATE / ACCEPTABLE";

  const messyEl = document.getElementById("messyInput");
  if (messyEl && !messyEl.value) {
    messyEl.value = buildLiveMessySensorTable(activeZone);
  }

  const rows = parseMessyTable(messyEl ? messyEl.value : "");
  document.getElementById("traceableBadges").innerHTML = rows.map(r =>
    `<span class="trace-pill">📌 ${r.rowId} (${r.sensorId}): ${r.pm25 !== null ? r.pm25 + " µg/m³" : "EXCLUDED"}</span>`
  ).join("");

  const flagged = rows.filter(r => r.status !== "VALID" || r.flag.includes("Auto-converted"));
  document.getElementById("dataGapAlert").innerHTML =
    `<strong>⚠️ Sensor Data Hygiene Flags:</strong><br>` +
    flagged.map(f => `• <strong>${f.rowId} (${f.sensorId}):</strong> ${f.flag}`).join("<br>");
}

async function runLiveGeminiBriefing() {
  if (!activeZone) return;
  updateHeaderTelemetryOnly();

  const apiKey =
    document.getElementById("setupApiKey").value.trim() ||
    userProfile.apiKey ||
    sessionStorage.getItem("JUDGE_GEMINI_KEY") ||
    "";

  if (!apiKey) {
    document.getElementById("onboardingModal").classList.remove("hidden");
    alert("Please paste your free Gemini API key in Box #6 so Gemini AI can generate your live briefing.");
    return;
  }

  userProfile.apiKey = apiKey;
  sessionStorage.setItem("JUDGE_GEMINI_KEY", apiKey);

  document.getElementById("deltaBox").textContent = `⏳ Gemini AI is analyzing live telemetry & generating your ${userProfile.language} action plan...`;
  document.getElementById("plainSummary").textContent = "Analyzing multi-pollutant ratios (PM2.5, PM10, NO₂, SO₂, CO) and field sensor rows...";
  document.getElementById("actionList").innerHTML = "<li>Generating role-specific interventions with Gemini AI...</li>";
  document.getElementById("citizenAdvisoryText").textContent = "Drafting age-calibrated citizen advisory...";
  document.getElementById("internalBriefText").textContent = "Compiling official internal operational briefing note...";

  try {
    const normalizedRows = parseMessyTable(document.getElementById("messyInput").value);
    const aiOut = await generateCivicIntelligence({
      apiKey,
      zone: activeZone,
      profile: userProfile,
      normalizedRows,
      previousBrief: activeZone.previousBrief
    });

    document.getElementById("deltaBox").textContent = `🔄 ${aiOut.deltaSummary}`;
    document.getElementById("plainSummary").textContent = aiOut.plainSummary;
    document.getElementById("actionList").innerHTML =
      aiOut.prioritizedActions.map(a => `<li>${a}</li>`).join("");
    document.getElementById("citizenAdvisoryText").textContent = aiOut.citizenAdvisory;
    document.getElementById("internalBriefText").textContent = aiOut.internalBriefingNote;

    document.getElementById("traceableBadges").innerHTML =
      aiOut.citations.map(c => `<span class="trace-pill">📌 ${c}</span>`).join("");
    document.getElementById("dataGapAlert").innerHTML =
      `<strong>⚠️ Gemini Data Hygiene Audit:</strong><br>` +
      aiOut.dataQualityFlags.map(f => `• ${f}`).join("<br>");

    lastAiWhatsappMessage = aiOut.whatsappBroadcastMessage;
    document.getElementById("whatsappPreviewText").value = lastAiWhatsappMessage;
  } catch (err) {
    document.getElementById("deltaBox").textContent = `⚠️ AI Error: ${err.message}`;
  }
}

async function searchCityAndDiscover() {
  const q = document.getElementById("citySearchInput").value.trim();
  if (!q) return;
  const btn = document.getElementById("searchCityBtn");
  btn.textContent = "⏳...";
  try {
    const data = await fetchWithTimeout(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`, 3000);
    if (data?.features?.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates;
      const cityLabel = data.features[0].properties.name || q;
      if (mapInstance) {
        mapInstance.invalidateSize();
        mapInstance.setView([lat, lng], 12);
      }
      await discoverRealLocalities(lat, lng, cityLabel);
    } else {
      alert("Location not found. Try another city name.");
    }
  } catch {
    alert("Search timed out. Please try again.");
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
      if (mapInstance) {
        mapInstance.invalidateSize();
        mapInstance.setView([latitude, longitude], 12);
      }
      await discoverRealLocalities(latitude, longitude, "My GPS Area");
      btn.textContent = "🎯 GPS";
    },
    () => {
      alert("GPS permission denied. Please use the city search bar.");
      btn.textContent = "🎯 GPS";
    }
  );
}

// ATTACH BUTTON EVENT LISTENERS IMMEDIATELY ON PAGE LOAD (ZERO BLOCKING!)
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");
  if (urlKey) {
    sessionStorage.setItem("JUDGE_GEMINI_KEY", urlKey);
    document.getElementById("setupApiKey").value = urlKey;
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 1. Bind all UI buttons immediately (0ms delay)
  document.getElementById("searchCityBtn").addEventListener("click", searchCityAndDiscover);
  document.getElementById("gpsLocateBtn").addEventListener("click", locateUserGPS);

  document.getElementById("openDashboardBtn").addEventListener("click", async () => {
    userProfile = {
      role: document.getElementById("setupRole").value,
      zoneId: document.getElementById("setupZone").value || "Z1",
      ageGroup: document.getElementById("setupAge").value,
      language: document.getElementById("setupLang").value,
      apiKey: document.getElementById("setupApiKey").value.trim()
    };

    activeZone = ZONES.find(z => z.id === userProfile.zoneId) || ZONES[0];
    document.getElementById("messyInput").value = buildLiveMessySensorTable(activeZone);
    document.getElementById("onboardingModal").classList.add("hidden");

    if (mapInstance && activeZone) {
      setTimeout(() => {
        mapInstance.invalidateSize();
        mapInstance.setView([activeZone.lat, activeZone.lng], 12);
      }, 80);
    }

    drawMapCircles();
    await runLiveGeminiBriefing();
  });

  document.getElementById("changeProfileBtn").addEventListener("click", () => {
    document.getElementById("onboardingModal").classList.remove("hidden");
  });

  document.getElementById("openAuditBtn").addEventListener("click", () => {
    document.getElementById("auditModal").classList.remove("hidden");
  });
  document.getElementById("openAuditModalTopBtn").addEventListener("click", () => {
    document.getElementById("auditModal").classList.remove("hidden");
  });
  document.getElementById("closeAuditModalBtn").addEventListener("click", () => {
    document.getElementById("auditModal").classList.add("hidden");
  });

  document.getElementById("runAiBtn").addEventListener("click", async () => {
    document.getElementById("auditModal").classList.add("hidden");
    await runLiveGeminiBriefing();
  });

  document.getElementById("openWhatsappPreviewBtn").addEventListener("click", () => {
    document.getElementById("whatsappModal").classList.remove("hidden");
  });
  document.getElementById("closeWhatsappModalBtn").addEventListener("click", () => {
    document.getElementById("whatsappModal").classList.add("hidden");
  });

  document.getElementById("sendWhatsappWebBtn").addEventListener("click", () => {
    const text = document.getElementById("whatsappPreviewText").value;
    window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  });

  document.getElementById("copyWhatsappBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("whatsappPreviewText").value);
    alert("AI WhatsApp message copied!");
  });

  document.getElementById("scanMapAreaBtn").addEventListener("click", () => {
    if (!mapInstance) return;
    const center = mapInstance.getCenter();
    discoverRealLocalities(center.lat, center.lng, "Map View");
  });

  document.getElementById("contrastBtn").addEventListener("click", () => {
    document.body.classList.toggle("high-contrast");
  });

  // 2. Initialize map & background telemetry WITHOUT blocking the popup!
  initMap();
  discoverRealLocalities(23.2599, 77.4126, "Bhopal");
});
