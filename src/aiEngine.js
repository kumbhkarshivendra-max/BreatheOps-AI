import { GoogleGenAI, Type } from "https://esm.run/@google/genai";

export async function generateCivicIntelligence({ apiKey, zone, profile, normalizedRows, previousBrief }) {
  if (!apiKey) {
    throw new Error("Gemini API Key is required. Paste your free AIza... key in the configuration popup.");
  }

  // 1. ZERO-TOKEN CACHE CHECK: Never spend tokens twice for the same zone + role + language + data
  const cacheSignature = JSON.stringify({
    z: zone.id,
    pm: zone.pm25,
    r: profile.role,
    a: profile.ageGroup,
    l: profile.language,
    rows: normalizedRows.map(r => `${r.sensorId}:${r.pm25}:${r.status}`)
  });
  const cacheKey = "BREATHEOPS_AI_CACHE_" + btoa(encodeURIComponent(cacheSignature)).slice(0, 48);
  const cachedResult = sessionStorage.getItem(cacheKey);
  if (cachedResult) {
    return JSON.parse(cachedResult);
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are BreatheOps AI, a Civic Air Quality Intelligence System.
Analyze this telemetry and sensor table. Write output ENTIRELY in ${profile.language}.

LOCALITY: ${zone.name} (GPS: ${zone.lat.toFixed(3)}, ${zone.lng.toFixed(3)})
LIVE SATELLITE: PM2.5=${zone.pm25}, PM10=${zone.pm10}, NO2=${zone.no2}, CO=${zone.co}, SO2=${zone.so2} µg/m³
PREVIOUS BRIEF: ${JSON.stringify(previousBrief)}
ROLE: ${profile.role} | AUDIENCE: ${profile.ageGroup} | LANGUAGE: ${profile.language}
NORMALIZED ROWS: ${JSON.stringify(normalizedRows)}

RULES:
1. "deltaSummary": Compare current vs Previous Brief in ${profile.language}.
2. "plainSummary": Infer hotspot & emission source from pollutant ratios and sensor notes in plain ${profile.language}.
3. "prioritizedActions": 6 practical actions for "${profile.role}" in ${profile.language}. NO chemical formulas/numbers (no PM2.5, NO2, µg/m³) inside action bullets.
4. "citizenAdvisory": Health advisory in ${profile.language} for "${profile.ageGroup}", protecting kids, seniors & sensitive lungs.
5. "internalBriefingNote": Official operational memo in ${profile.language} logging deltas and sensor flags.
6. "whatsappBroadcastMessage": Ready-to-share WhatsApp group alert in ${profile.language} with emojis, advisory & top actions.
7. "citations" & "dataQualityFlags": Cite Row #/Sensor IDs and flag missing (N/A), converted (mg/m³), or outlier (-999) readings.
`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      deltaSummary: { type: Type.STRING },
      plainSummary: { type: Type.STRING },
      prioritizedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
      citizenAdvisory: { type: Type.STRING },
      internalBriefingNote: { type: Type.STRING },
      whatsappBroadcastMessage: { type: Type.STRING },
      citations: { type: Type.ARRAY, items: { type: Type.STRING } },
      dataQualityFlags: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: [
      "deltaSummary",
      "plainSummary",
      "prioritizedActions",
      "citizenAdvisory",
      "internalBriefingNote",
      "whatsappBroadcastMessage",
      "citations",
      "dataQualityFlags"
    ]
  };

  // 2. UPDATED MODEL WATERFALL: Uses gemini-3.8-flash and latest Flash-Lite aliases for new keys
  const activeModels = [
    "gemini-3.8-flash",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  let lastError = null;

  for (const modelName of activeModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2,
          maxOutputTokens: 1000
        }
      });

      const parsed = JSON.parse(response.text);
      sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(lastError?.message || "Unable to reach Gemini API. Please check your key.");
}
