# BreatheOps AI — Civic Air Quality Intelligence Platform

> **Prompt Wars Submission** • An AI-driven civic intelligence web application that transforms raw, irregular air quality data and messy sensor feeds into traceable, role-specific recurring operational interventions and age-calibrated multi-language citizen advisories.

---

## 🚀 Live Demo & Access
* **Live GitHub Pages URL:** `https://<your-github-username>.github.io/breatheops-ai/`
* **Zero Installation:** Runs entirely inside any modern web browser. No local servers or installations required.

---

## 🔑 Quick Demo Login Credentials (Password: `admin`)

Access is strictly secured and scoped by **Civic Group**, **Assigned Zone**, and **User Age**:

| Role / Civic Group | Username | Password | Access Scope & Jurisdiction |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `super` | `admin` | **All Zones** (City-wide municipal command & user management) |
| **Local Authority** | `authority1` | `admin` | **All Zones** (Municipal enforcement & heavy equipment deployment) |
| **Housing Society** | `society1` | `admin` | **Zone 2 Only** (Emerald Greens Housing Society micro-controls) |
| **Ward-Level Team** | `ward1` | `admin` | **Zone 3 Only** (Central Market Ward 4 patrols & waste enforcement) |
| **School Admin** | `school1` | `admin` | **Zone 4 Only** (Sunrise School campus student safety & air purification) |

*(Tip: You can also register a brand new user on the login screen with custom **Age** and **Zone** bounds to test dynamic age-calibrated advisories!)*

---

## 🧠 How the Solution Works (Core Architecture)

BreatheOps AI operates on a robust **3-Tier Civic Intelligence Pipeline**:

1. **Live Data Ingestion & Offline Resilience:**
   * Automatically queries real-time particulate and gas telemetry (`PM2.5`, `PM10`, `NO2`) via the **Open-Meteo Air Quality API**.
   * Features an intelligent offline fallback mode to guarantee 100% uptime during live competition judging.

2. **Messy Data & Complaint Table Normalization Engine:**
   * Users can paste or upload irregular CSV/text tables containing mixed units (`mg/m³`, `ppm`, `µg/m³`), missing values (`N/A`, `-`, `null`), or extreme sensor outliers.
   * The AI normalizes units to standard `µg/m³`, flags data gaps, isolates faulty sensors, and logs every adjustment in an **Audit Ledger** for 100% traceability.

3. **Role-Based & Age-Aware Interventions:**
   * **Local Authorities** receive heavy-duty municipal orders (anti-smog cannons, construction halts, freight traffic rerouting).
   * **Housing Societies** receive preventative micro-controls (perimeter misting, DG generator runtime limits, basement idling bans).
   * **Ward Teams** receive ground-level enforcement tasks (open-waste burning patrols, unpaved shoulder watering).
   * **Schools & Vulnerable Groups** receive age-calibrated health notices (indoor assembly protocols, asthma inhaler readiness).

---

## 🌐 Multi-Language & Accessibility Features
* **Universal Language Bridge:** Instantly translates citizen advisories across English, Hindi (`हिन्दी`), Marathi (`मराठी`), Spanish (`Español`), Bengali, and Tamil.
* **Accessibility Suite:** Includes a high-contrast theme toggle, scalable large text mode, and keyboard-navigational ARIA design.
* **Automated System Self-Tests:** Built-in diagnostic suite verifying unit normalization math, RBAC zone isolation, and API security hygiene.

---

## 🛠️ Tech Stack
* **Frontend:** Pure HTML5, Modern CSS3 (Grid/Flexbox variables), and Vanilla JavaScript (ES6+).
* **Hosting:** Static cloud deployment via GitHub Pages.
* **Security:** Zero hardcoded API keys; designed with a secure session-storage slot for future LLM integrations.
