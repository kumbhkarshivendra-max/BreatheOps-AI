import { parseMessyTable } from "./dataNormalizer.js";
import { generateCivicIntelligence } from "./aiEngine.js";

const ZONES = [
  {
    id: "Z1",
    name: "Zone 1: Industrial & Transit Corridor",
    lat: 23.285,
    lng: 77.415,
    pm25: 164,
    pm10: 280,
    no2: 68,
    prevPm25: 138,
    hotspot: "Heavy diesel freight idling & unpaved shoulder dust near Gate 4"
  },
  {
    id: "Z2",
    name: "Zone 2: Green Valley Housing Enclave",
    lat: 23.235,
    lng: 77.435,
    pm25: 86,
    pm10: 145,
    no2: 34,
    prevPm25: 102,
    hotspot: "Morning backup diesel generator testing near Tower B play park"
  },
  {
    id: "Z3",
    name: "Zone 3: Central Market Ward 4",
    lat: 23.258,
    lng: 77.401,
    pm25: 142,
    pm10: 235,
    no2: 61,
    prevPm25: 119,
    hotspot: "Evening traffic congestion & open waste burning behind Sabzi Mandi"
  },
  {
    id: "Z4",
    name: "Zone 4: Sunrise School & Hospital District",
    lat: 23.248,
    lng: 77.458,
    pm25: 114,
    pm10: 182,
    no2: 45,
    prevPm25: 95,
    hotspot: "School dismissal bus idling & uncovered construction sand trucks"
  }
];

const SAMPLE_MESSY = `Sensor_ID | Zone | PM2.5_Reading | Note
S-101 | Zone 1 | 0.164 mg/m3 | Thick black diesel plume near Gate 4
S-102 | Zone 2 | 86 ug/m3 | Generator exhaust near Tower B
S-103 | Zone 3 | N/A | Telemetry dropout / missing reading
S-999 | Zone 4 | -999 ug/m3 | Unreliable negative voltage glitch`;

let userProfile = {
  role: "society",
  zoneId: "Z2",
  ageGroup: "adult",
  language: "English",
  apiKey: ""
};

let activeZone = ZONES[1];
let mapInstance = null;
let zoneCircles = {};

function getColor(pm) {
  if (pm <= 60) return "#16a34a";
  if (pm <= 100) return "#d97706";
  if (pm <= 150) return "#ea580c";
  return "#dc2626";
}

// 1. FETCH REAL LIVE SATELLITE AIR QUALITY FROM OPEN-METEO API
async function syncLiveSatelliteAir() {
  const statusEl = document.getElementById("liveSyncStatus");
  if (statusEl) {
    statusEl.textContent = "📡 Fetching real-time satellite PM2.5 & PM10 from Open-Meteo...";
  }

  await Promise.all(ZONES.map(async zone => {
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${zone.lat}&longitude=${zone.lng}&current=pm2_5,pm10,nitrogen_dioxide`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.current) {
        const storedPrev = localStorage.getItem(`PREV_PM_${zone.id}`);
        zone.prevPm25 = storedPrev ? Number(storedPrev) : zone.pm25;
        zone.pm25 = Math.round(data.current.pm2_5 || zone.pm25);
        zone.pm10 = Math.round(data.current.pm10 || zone.pm10);
        zone.no2 = Math.round(data.current.nitrogen_dioxide || zone.no2);
        localStorage.setItem(`PREV_PM_${zone.id}`, String(zone.pm25));
      }
    } catch {
      // Retain baseline telemetry if offline
    }
  }));

  if (statusEl) {
    statusEl.textContent = `✅ Live Satellite Air Synced (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }
  drawMapCircles();
  renderWorkspace();
}

// 2. INITIALIZE INTERACTIVE LEAFLET MAP & ZONE LOCK
function initMap() {
  if (typeof L === "undefined") return;
  mapInstance = L.map("airMap").setView([23.258, 77.425], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(mapInstance);
  drawMapCircles();
}

function drawMapCircles() {
  if (!mapInstance || typeof L === "undefined") return;
  Object.values(zoneCircles).forEach(c => mapInstance.removeLayer(c));
  zoneCircles = {};

  ZONES.forEach(zone => {
    const isLocked =
      userProfile.role !== "authority" &&
      userProfile.role !== "gig_worker" &&
      zone.id !== userProfile.zoneId;

    const circle = L.circle([zone.lat, zone.lng], {
      color: isLocked ? "#94a3b8" : getColor(zone.pm25),
      fillColor: isLocked ? "#cbd5e1" : getColor(zone.pm25),
      fillOpacity: isLocked ? 0.25 : 0.5,
      radius: 1200
    }).addTo(mapInstance);

    circle.bindTooltip(
      isLocked
        ? `🔒 <strong>${zone.name}</strong><br>Outside your assigned jurisdiction`
        : `<strong>${zone.name}</strong><br>Live PM2.5: ${zone.pm25} µg/m³ (Click to inspect)`
    );

    circle.on("click", () => {
      if (isLocked) {
        alert(`Your profile is scoped to ${userProfile.zoneId}. Switch to Municipal Authority in 'Change Profile' to inspect all city zones.`);
        return;
      }
      activeZone = zone;
      renderWorkspace();
    });

    zoneCircles[zone.id] = circle;
  });
}

// 3. RENDER TRACEABLE BRIEF, INTERNAL NOTE & CITIZEN ADVISORY
function renderWorkspace() {
  const messyEl = document.getElementById("messyInput");
  const rows = parseMessyTable(messyEl ? messyEl.value : SAMPLE_MESSY);

  const roleLabels = {
    society: "Housing Society / RWA",
    school: "School Principal / Parent",
    ward: "Ward Field Officer",
    authority: "Municipal Authority",
    gig_worker: "Outdoor Gig Worker"
  };

  document.getElementById("activeProfileSummary").textContent =
    `${roleLabels[userProfile.role]} • ${userProfile.ageGroup.toUpperCase()} View • ${userProfile.language}`;

  document.getElementById("zoneTitle").textContent = activeZone.name;
  document.getElementById("zoneCoords").textContent =
    `GPS: ${activeZone.lat.toFixed(3)}°N, ${activeZone.lng.toFixed(3)}°E • Live PM10: ${activeZone.pm10} µg/m³ • NO₂: ${activeZone.no2} µg/m³`;
  document.getElementById("zonePmValue").textContent = activeZone.pm25;

  const badge = document.getElementById("zoneBadge");
  badge.style.background = getColor(activeZone.pm25);
  badge.textContent = activeZone.pm25 > 120 ? "HIGH HOTSPOT ALERT" : activeZone.pm25 > 60 ? "MODERATE / POOR" : "SAFE AIR";

  // Delta comparison against previous brief
  const diff = activeZone.pm25 - activeZone.prevPm25;
  document.getElementById("deltaBox").textContent =
    `🔄 Comparison with Previous Brief: PM2.5 ${diff >= 0 ? "worsened by +" + diff : "improved by " + diff} µg/m³ (Previous: ${activeZone.prevPm25} µg/m³ → Current: ${activeZone.pm25} µg/m³).`;

  // Plain language summary + Traceable Row Badges
  document.getElementById("plainSummary").textContent =
    `Primary pollution driver: ${activeZone.hotspot}. Fine-to-coarse particulate ratio (${(activeZone.pm25 / activeZone.pm10).toFixed(2)}) confirms localized combustion and road dust.`;

  document.getElementById("traceableBadges").innerHTML = rows.map(r =>
    `<span class="trace-pill">📌 ${r.rowId} (${r.sensorId}): ${r.pm25 !== null ? r.pm25 + " µg/m³" : "EXCLUDED"}</span>`
  ).join("");

  // Data Gaps & Unreliable Readings Flagged
  const flagged = rows.filter(r => r.status !== "VALID" || r.flag.includes("Converted"));
  document.getElementById("dataGapAlert").innerHTML =
    `<strong>⚠️ Data Hygiene & Reliability Audit:</strong><br>` +
    flagged.map(f => `• <strong>${f.rowId} (${f.sensorId}):</strong> ${f.flag}`).join("<br>");

  // Role-specific prioritized interventions
  const roleActions = {
    society: [
      `Switch security gates to zero-idling delivery mode while PM2.5 is ${activeZone.pm25} µg/m³ (Trace: Row #1)`,
      `Replace dry broom sweeping with wet mopping/sprinkling on internal driveways (PM10: ${activeZone.pm10} µg/m³)`,
      `Shift diesel generator testing to 2:00 PM afternoon wind window (Trace: Row #2)`
    ],
    school: [
      `Move morning assembly and outdoor PT indoors when PM2.5 exceeds 100 µg/m³ (Current: ${activeZone.pm25} µg/m³)`,
      `Enforce engine-off rule for school buses & parent pickup vans at main gate`,
      `Check classroom HEPA filters and keep nurse asthma spacer kit ready`
    ],
    ward: [
      `Extinguish open waste/leaf burning reported near ${activeZone.hotspot} (Trace: Row #1)`,
      `Deploy ward water sprinkler tanker along dusty market shoulders every 4 hours`,
      `Inspect sensor S-103 for loose telemetry wiring flagged in Row #3`
    ],
    authority: [
      `Dispatch truck-mounted anti-smog misting cannon to ${activeZone.name}`,
      `Enforce peak-hour heavy freight diversion and penalize uncovered construction trucks`,
      `Order technical calibration audit on outlier sensor S-999 (Trace: Row #4)`
    ],
    gig_worker: [
      `Wear a snug N95 mask on two-wheeler routes through ${activeZone.name} (PM2.5: ${activeZone.pm25} µg/m³)`,
      `Take a 10-minute indoor hydration break every 2 hours away from main traffic signals`,
      `Turn off bike engine at red lights longer than 30 seconds to cut personal NO₂ inhalation`
    ]
  };

  document.getElementById("roleActionHeading").textContent =
    `✅ Prioritized Local Actions (${roleLabels[userProfile.role]})`;
  document.getElementById("actionList").innerHTML =
    (roleActions[userProfile.role] || roleActions.society).map(a => `<li>${a}</li>`).join("");

  // Internal Operational Briefing Note
  document.getElementById("internalBriefText").textContent =
    `[INTERNAL MEMO • ${activeZone.id}] Current PM2.5 is ${activeZone.pm25} µg/m³ (Delta: ${diff >= 0 ? "+" + diff : diff} µg/m³ vs prior brief). ` +
    `${flagged.length} sensor anomalies/conversions isolated (${flagged.map(f => f.sensorId).join(", ")}). Assigned ${roleLabels[userProfile.role]} interventions active.`;

  // Age-Calibrated & Language-Aware Citizen Advisory
  const ageCareMap = {
    child: `[Child-Friendly • Simple Level] Today's air in ${activeZone.name} has dust and smoke (PM2.5: ${activeZone.pm25}). Play indoor games during recess, drink extra water, and tell a teacher or parent if your throat feels scratchy!`,
    adult: `[Standard Citizen Advisory] Air quality in ${activeZone.name} is at PM2.5 ${activeZone.pm25} µg/m³ due to ${activeZone.hotspot}. Limit heavy outdoor jogging, wear an N95 mask on two-wheelers, and keep car AC on recirculate.`,
    senior: `[Older Adult & Sensitive Lungs Alert] Elevated PM2.5 (${activeZone.pm25} µg/m³) increases breathing and blood pressure strain. Avoid early morning walks, keep windows shut during peak traffic, and keep inhalers handy.`
  };

  document.getElementById("advisoryHeading").textContent =
    `📢 Citizen Advisory (${userProfile.language} • ${userProfile.ageGroup.toUpperCase()})`;
  document.getElementById("citizenAdvisoryText").textContent = ageCareMap[userProfile.ageGroup];
}

// 4. GEMINI AI LIVE RUN FOR MESSY DATA & MULTI-LANGUAGE GENERATION
async function handleRunGeminiAI() {
  const btn = document.getElementById("runAiBtn");
  btn.textContent = "⏳ Gemini AI Interpreting Messy Data...";

  try {
    const rows = parseMessyTable(document.getElementById("messyInput").value);
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

// 5. WHATSAPP WEB ONE-CLICK LAUNCHER
function shareToWhatsAppWeb() {
  const message =
    `*BreatheOps AI Civic Alert — ${activeZone.name}*\n` +
    `📊 Live PM2.5: ${activeZone.pm25} µg/m³\n` +
    `🔄 ${document.getElementById("deltaBox").textContent}\n\n` +
    `📢 *Advisory (${userProfile.language}):*\n${document.getElementById("citizenAdvisoryText").textContent}`;

  const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
}

// 6. APPLY ONBOARDING PROFILE & CLOSE MODAL WITHOUT REFRESHING
function applyOnboardingProfile(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  userProfile = {
    role: document.getElementById("setupRole").value,
    zoneId: document.getElementById("setupZone").value,
    ageGroup: document.getElementById("setupAge").value,
    language: document.getElementById("setupLang").value,
    apiKey: document.getElementById("setupApiKey").value.trim()
  };

  activeZone = ZONES.find(z => z.id === userProfile.zoneId) || ZONES[0];
  document.getElementById("onboardingModal").classList.add("hidden");

  if (mapInstance) {
    setTimeout(() => {
      mapInstance.invalidateSize();
      mapInstance.setView([activeZone.lat, activeZone.lng], 13);
    }, 100);
  }

  drawMapCircles();
  renderWorkspace();

  if (userProfile.apiKey && userProfile.language !== "English") {
    handleRunGeminiAI();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const messyEl = document.getElementById("messyInput");
  if (messyEl) messyEl.value = SAMPLE_MESSY;

  initMap();
  syncLiveSatelliteAir();

  // Attach to button AND form so neither can ever cause a page reload
  const openBtn = document.getElementById("openDashboardBtn");
  if (openBtn) openBtn.addEventListener("click", applyOnboardingProfile);

  const formEl = document.getElementById("onboardingForm");
  if (formEl) formEl.addEventListener("submit", applyOnboardingProfile);

  document.getElementById("changeProfileBtn")?.addEventListener("click", () => {
    document.getElementById("onboardingModal").classList.remove("hidden");
  });

  document.getElementById("refreshLiveBtn")?.addEventListener("click", syncLiveSatelliteAir);
  document.getElementById("runAiBtn")?.addEventListener("click", handleRunGeminiAI);
  document.getElementById("whatsappWebBtn")?.addEventListener("click", shareToWhatsAppWeb);

  document.getElementById("copyBtn")?.addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("citizenAdvisoryText").textContent);
    alert("Advisory copied to clipboard!");
  });

  document.getElementById("contrastBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("high-contrast");
  });
});
