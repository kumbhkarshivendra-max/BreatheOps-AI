import { describe, it, expect } from "vitest";
import { normalizePollutantValue, parseMessyTable } from "../src/dataNormalizer.js";

describe("Air Quality Data Normalizer", () => {
  it("converts mg/m3 to ug/m3", () => {
    expect(normalizePollutantValue("0.168 mg/m3").value).toBe(168);
  });

  it("flags N/A and negative sensor glitches", () => {
    expect(normalizePollutantValue("N/A").status).toBe("MISSING");
    expect(normalizePollutantValue("-999 ug/m3").status).toBe("OUTLIER");
  });

  it("parses messy tables into traceable rows", () => {
    const rows = parseMessyTable("Sensor | Zone | PM2.5\nS-1 | Z1 | 0.12 mg/m3");
    expect(rows[0].pm25).toBe(120);
  });
});
