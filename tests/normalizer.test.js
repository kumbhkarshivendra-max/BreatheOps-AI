import { describe, it, expect } from "vitest";
import { normalizePollutantValue, parseMessyTable } from "../src/dataNormalizer.js";

describe("BreatheOps AI — Messy Sensor Table Normalizer", () => {
  it("accurately converts mg/m3 and ppm to ug/m3", () => {
    const mgResult = normalizePollutantValue("0.164 mg/m3");
    expect(mgResult.value).toBe(164);
    expect(mgResult.status).toBe("VALID");
    expect(mgResult.flag).toContain("Auto-converted");

    const ppmResult = normalizePollutantValue("0.05 ppm", "NO2");
    expect(ppmResult.value).toBe(94);
    expect(ppmResult.status).toBe("VALID");
  });

  it("isolates missing data tokens (N/A, -, null) without NaN errors", () => {
    expect(normalizePollutantValue("N/A").status).toBe("MISSING");
    expect(normalizePollutantValue("-").status).toBe("MISSING");
    expect(normalizePollutantValue(null).status).toBe("MISSING");
  });

  it("rejects negative hardware glitches and impossible outlier spikes", () => {
    const glitch = normalizePollutantValue("-999 ug/m3");
    expect(glitch.value).toBeNull();
    expect(glitch.status).toBe("OUTLIER");

    const extreme = normalizePollutantValue("9500 ug/m3");
    expect(extreme.value).toBeNull();
    expect(extreme.status).toBe("OUTLIER");
  });

  it("preserves commas inside locality names when parsing pipe-delimited tables", () => {
    const sample = `Sensor_ID | Locality | PM2.5_Reading | Telemetry_Note
Z2-NODE1 | Z2: Arera Colony, Bhopal | 0.088 mg/m3 | Primary street sensor
Z2-NODE2 | Z2: Arera Colony, Bhopal | N/A | Solar telemetry packet dropped`;

    const rows = parseMessyTable(sample);
    expect(rows).toHaveLength(2);
    expect(rows[0].zoneName).toBe("Z2: Arera Colony, Bhopal");
    expect(rows[0].pm25).toBe(88);
    expect(rows[1].pm25).toBeNull();
    expect(rows[1].status).toBe("MISSING");
  });
});
