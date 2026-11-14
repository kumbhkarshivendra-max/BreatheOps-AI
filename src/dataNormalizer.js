export function normalizePollutantValue(rawStr) {
  if (rawStr === undefined || rawStr === null) {
    return { value: null, status: "MISSING", flag: "Missing reading (Null)" };
  }
  const cleaned = String(rawStr).trim().toLowerCase();
  if (["n/a", "na", "-", "null", "err", ""].includes(cleaned)) {
    return { value: null, status: "MISSING", flag: "Data gap ('" + rawStr.trim() + "')" };
  }

  const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
  if (!numMatch) {
    return { value: null, status: "UNPARSEABLE", flag: "Invalid format" };
  }

  let num = parseFloat(numMatch[0]);
  let flag = "Verified µg/m³";

  if (cleaned.includes("mg/m3") || cleaned.includes("mg/m³")) {
    num = Math.round(num * 1000);
    flag = "Converted mg/m³ → µg/m³";
  } else if (cleaned.includes("ppm")) {
    num = Math.round(num * 1000);
    flag = "Converted ppm → µg/m³";
  }

  if (num < 0 || num > 2000) {
    return { value: null, status: "OUTLIER", flag: `Rejected sensor glitch (${rawStr.trim()})` };
  }

  return { value: Math.round(num), status: "VALID", flag };
}

export function parseMessyTable(rawText) {
  const lines = String(rawText || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];

  lines.forEach((line, idx) => {
    if (idx === 0 && /sensor|pm2\.?5/i.test(line)) return;
    const cols = line.split(/\||,|\t/).map(c => c.trim());
    const pm25Audit = normalizePollutantValue(cols[2]);

    rows.push({
      rowId: `Row #${idx + 1}`,
      sensorId: cols[0] || `S-${idx + 1}`,
      zoneName: cols[1] || "Zone 1",
      pm25: pm25Audit.value,
      status: pm25Audit.status,
      flag: pm25Audit.flag,
      note: cols[3] || "Field observation"
    });
  });

  return rows;
}
