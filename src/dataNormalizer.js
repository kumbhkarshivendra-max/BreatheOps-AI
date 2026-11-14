export function normalizePollutantValue(rawStr, pollutantType = "PM2.5") {
  if (rawStr === undefined || rawStr === null) {
    return { value: null, status: "MISSING", flag: "Missing reading (Null)" };
  }

  const cleaned = String(rawStr).trim().toLowerCase();
  if (["n/a", "na", "-", "null", "err", "nan", ""].includes(cleaned)) {
    return { value: null, status: "MISSING", flag: `Flagged Missing Reading ('${rawStr.trim()}')` };
  }

  const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
  if (!numMatch) {
    return { value: null, status: "UNPARSEABLE", flag: `Invalid format ('${rawStr.trim()}')` };
  }

  let num = parseFloat(numMatch[0]);
  let flag = "Verified µg/m³";

  if (cleaned.includes("mg/m3") || cleaned.includes("mg/m³")) {
    num = Math.round(num * 1000);
    flag = `Auto-converted ${rawStr.trim()} → ${num} µg/m³`;
  } else if (cleaned.includes("ppm")) {
    // Standard molecular conversion approximation to µg/m³
    num = Math.round(pollutantType === "NO2" ? num * 1880 : num * 1000);
    flag = `Auto-converted ${rawStr.trim()} → ${num} µg/m³`;
  } else if (!cleaned.includes("ug") && !cleaned.includes("µg")) {
    flag = "Inferred µg/m³ (Unit omitted)";
  }

  if (num < 0 || num > 2500) {
    return { value: null, status: "OUTLIER", flag: `Excluded faulty sensor spike (${rawStr.trim()})` };
  }

  return { value: Math.round(num), status: "VALID", flag };
}

export function parseMessyTable(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const rows = [];

  lines.forEach((line, idx) => {
    // Skip header row if present
    if (idx === 0 && /sensor|locality|pm2\.?5/i.test(line)) return;

    // Split strictly by pipe '|' first so commas inside locality names ("Arera Colony, Bhopal") never break columns
    const delimiter = line.includes("|") ? "|" : line.includes("\t") ? "\t" : ",";
    const cols = line.split(delimiter).map(c => c.trim());

    const pm25Audit = normalizePollutantValue(cols[2], "PM2.5");

    rows.push({
      rowId: `Row #${rows.length + 1}`,
      sensorId: cols[0] || `S-${rows.length + 1}`,
      zoneName: cols[1] || "Local Zone",
      pm25: pm25Audit.value,
      status: pm25Audit.status,
      flag: pm25Audit.flag,
      note: cols[3] || "Field telemetry"
    });
  });

  return rows;
}
