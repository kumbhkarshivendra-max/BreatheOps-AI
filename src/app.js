import { parseMessyTable } from "./dataNormalizer.js";
import { generateCivicIntelligence } from "./aiEngine.js";

const ZONES = [
  {
    id: "Z1",
    name: "Zone 1: North Industrial Corridor",
    lat: 23.285,
    lng: 77.415,
    pm25: 168,
    prevPm25: 138,
    summary: "Heavy freight exhaust and road dust near Gate 4 are trapping smoke close to the ground.",
    citation: "Traceable Source: Sensor S-101 (Row #2) • Converted 0.168 mg/m³ → 168 µg/m³",
    actions: {
      society: ["Keep society park gates closed until 10 AM smog clears", "Switch security gate to zero-idling delivery mode", "Use wet mopping instead of dry sweeping on driveways"],
      school: ["Move morning assembly and PT classes indoors today", "Keep classroom windows facing the highway shut", "Check asthma inhalers with the school nurse"],
      ward: ["Deploy water-sprinkling tanker on Gate 4 dusty shoulder", "Inspect behind market for open waste burning", "Log uncovered sand trucks for municipal fine"],
      authority: ["Dispatch anti-smog misting cannon to North Corridor", "Divert heavy diesel trucks during 8–11 AM peak", "Issue dust notice to Plot 14 construction site"],
      gig_worker: ["Wear a snug N95 mask on two-wheeler delivery routes", "Take 10-minute indoor rest breaks every 2 hours", "Avoid idling behind diesel trucks at North Signals"]
    },
    care: "Children & Seniors: Avoid outdoor exercise this morning. Delivery/Gig Riders: Use N95 protection along Industrial Road."
  },
  {
    id: "Z2",
    name: "Zone 2: Emerald Greens Housing Society",
    lat: 23.245,
    lng: 77.435,
    pm25: 88,
    prevPm25: 104,
    summary: "Air improved since yesterday! Mild morning dust near Tower B from generator testing.",
    citation: "Traceable Source: Sensor S-102 (Row #3) • Verified 88 µg/m³",
    actions: {
      society: ["Reschedule backup generator testing to 2 PM sunny window", "Sprinkle water around Tower B children's play area", "Post 'Moderate Air' notice on WhatsApp group"],
      school: ["Outdoor recess is safe; limit intense 400m sprinting for sensitive kids", "Ventilate classrooms between 1 PM and 3 PM", "Encourage extra water intake"],
      ward: ["Clear dry leaf piles near society perimeter wall", "Ensure garbage collection van covers waste bin", "Routine patrol only"],
      authority: ["Maintain green-belt misting schedule", "Monitor society micro-sensor telemetry", "No emergency diversion needed"],
      gig_worker: ["Safe for regular delivery shifts", "Keep visor down to prevent eye irritation from road dust", "Stay hydrated"]
    },
    care: "Safe for most residents. Seniors with asthma should prefer evening walks after 4 PM."
  },
  {
    id: "Z3",
    name: "Zone 3: Central Market & Transit Ward",
    lat: 23.259,
    lng: 77.402,
    pm25: 142,
    prevPm25: 118,
    summary: "Evening traffic congestion and open waste burning behind Sabzi Mandi caused a sharp spike.",
    citation: "Traceable Source: Sensor S-103 (Row #4) • Flagged missing PM10 gap",
    actions: {
      society: ["Keep balcony doors shut between 6 PM and 9 PM", "Run indoor air purifiers in bedrooms", "Share market traffic avoidance alert"],
      school: ["Stagger afternoon school bus dispersal by 10 minutes", "Turn off bus engines while waiting for students", "Keep infirmary nebulizer ready"],
      ward: ["Extinguish open plastic/leaf burning behind Sabzi Mandi immediately", "Clear parked carts blocking transit lane", "Water unpaved market shoulder"],
      authority: ["Deploy traffic marshals at Market Chowk choke point", "Enforce ₹5,000 penalty on open waste burning", "Sync traffic signals for smoother flow"],
      gig_worker: ["Wear N95 mask when waiting for orders inside Central Market", "Turn off bike engine at signals longer than 30 seconds", "Wash face and eyes after peak evening shift"]
    },
    care: "High Risk for Seniors, Children & Two-Wheeler Delivery Riders: Avoid Central Market alleyways during 6–9 PM peak."
  }
];

const SAMPLE_MESSY = `Sensor_ID | Zone | PM2.5 | Note
S-101 | Zone 1 | 0.168 mg/m3 | Thick black diesel smoke at Gate 4
S-102 | Zone 2 | 88 ug/m3 | Generator exhaust near Tower B
S-103 | Zone 3 | N/A | Sensor wire loose (Data Gap)
S-999 | Zone 1 | -999 ug/m3 | Outlier spike glitch`;

let activeZone = ZONES[0];
let mapInstance = null;

function getColor(pm) {
  if (pm <= 60) return "#16a34a";
  if (pm <= 100) return "#d97706";
  if (pm <= 150) return "#ea580c";
  return "#dc2626";
}

function initMap() {
  mapInstance = L.map("airMap").setView([23.262, 77.418], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(mapInstance);

  ZONES.forEach(zone => {
    const circle = L.circle([zone.lat, zone.lng], {
      color: getColor(zone.pm25),
      fillColor: getColor(zone.pm25),
      fillOpacity: 0.45,
      radius: 1100
    }).addTo(mapInstance);

    circle.bindTooltip(`<strong>${zone.name}</strong><br>PM2.5: ${zone.pm25} µg/m³`);
    circle.on("click", () => {
      activeZone = zone;
      renderSelectedZone();
    });
  });
}

function renderSelectedZone() {
  const role = document.getElementById("roleSelect").value;
  document.getElementById("zoneTitle").textContent = activeZone.name;
  document.getElementById("zonePmValue").textContent = activeZone.pm25;

  const badge = document.getElementById("zoneBadge");
  badge.style.background = getColor(activeZone.pm25);
  badge.textContent = activeZone.pm25 > 120 ? "HIGH POLLUTION HOTSPOT" : "MODERATE ZONE";

  const diff = activeZone.pm25 - activeZone.prevPm25;
  document.getElementById("deltaBox").textContent =
    `🔄 Change since previous brief: PM2.5 ${diff >= 0 ? "increased by +" + diff : "improved by " + diff} µg/m³ (was ${activeZone.prevPm25} µg/m³).`;

  document.getElementById("plainSummary").textContent = activeZone.summary;
  document.getElementById("dataCitation").textContent = activeZone.citation;

  const actions = activeZone.actions[role] || activeZone.actions.society;
  document.getElementById("actionList").innerHTML = actions.map(a => `<li>${a}</li>`).join("");
  document.getElementById("careAdvisory").textContent = activeZone.care;
}

async function handleRunAI() {
  const apiKey = document.getElementById("apiKeyInput").value.trim();
  const rawText = document.getElementById("messyInput").value;
  const role = document.getElementById("roleSelect").value;
  const language = document.getElementById("langSelect").value;

  const normalizedRows = parseMessyTable(rawText);
  const flags = normalizedRows.filter(r => r.status !== "VALID").map(r => `⚠️ ${r.rowId} (${r.sensorId}): ${r.flag}`);
  document.getElementById("dataFlagsBox").innerHTML = flags.join("<br>");

  const btn = document.getElementById("runAiBtn");
  btn.textContent = "⏳ Gemini AI Analyzing...";

  try {
    const aiResult = await generateCivicIntelligence({
      apiKey,
      zone: activeZone,
      role,
      language,
      normalizedRows,
      previousPm25: activeZone.prevPm25
    });

    document.getElementById("deltaBox").textContent = `🔄 ${aiResult.deltaSummary}`;
    document.getElementById("plainSummary").textContent = aiResult.plainSummary;
    document.getElementById("dataCitation").textContent = aiResult.citationText;
    document.getElementById("actionList").innerHTML = aiResult.topThreeActions.map(a => `<li>${a}</li>`).join("");
    document.getElementById("careAdvisory").textContent = aiResult.vulnerableAndGigAdvisory;
    if (aiResult.dataQualityFlags?.length) {
      document.getElementById("dataFlagsBox").innerHTML = aiResult.dataQualityFlags.map(f => `⚠️ ${f}`).join("<br>");
    }
  } catch (err) {
    alert(err.message);
  } finally {
    btn.textContent = "✨ Run Gemini AI Analysis";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("messyInput").value = SAMPLE_MESSY;
  initMap();
  renderSelectedZone();

  document.getElementById("roleSelect").addEventListener("change", renderSelectedZone);
  document.getElementById("runAiBtn").addEventListener("click", handleRunAI);
  document.getElementById("contrastBtn").addEventListener("click", () => {
    document.body.classList.toggle("high-contrast");
  });
  document.getElementById("copyBtn").addEventListener("click", () => {
    const text = `${activeZone.name} (PM2.5: ${activeZone.pm25})\n${document.getElementById("plainSummary").textContent}\n${document.getElementById("careAdvisory").textContent}`;
    navigator.clipboard.writeText(text);
    alert("Copied simple advisory for WhatsApp!");
  });
});
