# BreatheOps AI — Civic Air Quality Intelligence Platform

BreatheOps AI is an AI-driven civic intelligence web application that empowers local municipal authorities, housing societies (RWAs), schools, ward-level field teams, and outdoor gig workers to turn raw, messy air quality telemetry into traceable, role-specific local interventions.

Built with a modular ES6 architecture, real-time multi-pollutant satellite telemetry (**Open-Meteo API**), dynamic street-level neighbourhood discovery (**Photon / OpenStreetMap**), and **Google Gemini (`@google/genai` SDK)** with strict structured JSON schemas.

---

## 🎯 Problem Statement Alignment

1. **Generative AI Messy Table Interpreter (`src/aiEngine.js` & `src/dataNormalizer.js`)**
   - Uses the official `@google/genai` SDK (`gemini-3.8-flash` / `gemini-flash-lite-latest`) with `responseSchema` enforcement.
   - Parses irregular CSV, pipe (`|`), and tab-delimited tables containing mixed units (`mg/m³`, `ppm`, `µg/m³`), missing tokens (`N/A`, `-`, `null`), and hardware voltage spikes (`-999 µg/m³`).
   - Automatically normalizes units to `µg/m³` and isolates faulty sensor rows so bad data never corrupts local AQI averages.

2. **Traceable Findings & Data Hygiene Audit**
   - Every plain-language trend and hotspot attribution is linked to specific `Row #` and `Sensor_ID` badges inside the **Sensor Proof & Data Audit** modal.
   - Infers localized emission sources dynamically by analysing real multi-pollutant ratios ($PM_{2.5}/PM_{10}$ coarse dust ratios, $NO_2$ vehicular traffic spikes, and $SO_2/CO$ combustion signatures).

3. **Role-Scoped & Jurisdiction-Locked Interventions**
   - Tailors 6 jargon-free, actionable local interventions based on who is asking:
     - **🏠 Housing Society / RWA (Zone-Locked):** Gate zero-idling rules, wet mopping, generator test rescheduling.
     - **🎒 School Principal / Parent (Zone-Locked):** Indoor assembly triggers, bus dispersal staggering, infirmary inhaler readiness.
     - **🧹 Ward-Level Field Officer (Zone-Locked):** Open waste-burning patrols, water-tanker dust suppression, sensor wire checks.
     - **🛵 Outdoor Gig / Delivery Worker (Zone-Locked):** N95 route protection, shaded hydration breaks, signal engine-off habits.
     - **🏛️ Municipal Authority (City-Wide Access):** Anti-smog cannon deployment, heavy freight diversion, construction site enforcement.

4. **Brief-to-Brief Delta Comparison**
   - Stores previous zone baselines in browser storage and compares every new briefing against prior readings to highlight exact improvements or deteriorations.

5. **Dual Deliverable Output: Internal Briefing Note + Multi-Language Citizen Advisory**
   - Generates both an official **Internal Operational Briefing Note** and a **Public Citizen & Vulnerable-Group Advisory** across **13+ Indian and global languages** (English, Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Spanish, French).
   - Adapts reading levels for **Children (Grade-4 level)**, **Adult Commuters**, and **Older Adults / Respiratory-Sensitive Citizens (60+)**, complete with one-click **WhatsApp Web (`web.whatsapp.com`)** group broadcast formatting.

---

## 🗂️ Modular Repository Structure

```text
├── index.html               # Semantic HTML5 workspace, ARIA live regions & modal dialogs
├── styles.css               # Responsive layout & WCAG High-Contrast theme variables
├── package.json             # Project manifest (@google/genai, leaflet, vitest)
├── README.md                # System architecture & judge evaluation guide
├── src/
│   ├── app.js               # Leaflet GIS controller, live telemetry sync & UI state
│   ├── aiEngine.js          # Official @google/genai SDK integration, JSON schema & caching
│   └── dataNormalizer.js    # Unit conversion (mg/m3, ppm -> ug/m3) & outlier isolation
└── tests/
    └── normalizer.test.js   # Automated Vitest unit test suite for data normalization
