import { GoogleGenAI, Type } from "https://esm.run/@google/genai";

export async function generateCivicIntelligence({ apiKey, zone, profile, normalizedRows, previousBrief }) {
  if (!apiKey) {
    throw new Error("Gemini API Key is required to run real Generative AI synthesis. Paste your key in the configuration popup.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are BreatheOps AI, an expert Civic Air Quality Intelligence System.
Analyze the real-time satellite multi-pollutant telemetry and the pasted/uploaded sensor table below.
Generate the complete civic output ENTIRELY in ${profile.language}.

REAL-TIME SATELLITE TELEMETRY FOR THIS LOCALITY:
- Locality Name: ${zone.name}
- GPS Coordinates: ${zone.lat.toFixed(4)}, ${zone.lng.toFixed(4)}
- PM2.5: ${zone.pm25} µg/m³
- PM10: ${zone.pm10} µg/m³
- Nitrogen Dioxide (NO2): ${zone.no2} µg/m³
- Carbon Monoxide (CO): ${zone.co} µg/m³
- Sulphur Dioxide (SO2): ${zone.so2} µg/m³

PREVIOUS BRIEF RECORD FOR COMPARISON:
${JSON.stringify(previousBrief)}

USER CONTEXT:
- Asking Role: ${profile.role}
- Target Audience & Reading Level: ${profile.ageGroup}
- Preferred Output Language: ${profile.language}

NORMALIZED SENSOR & FIELD TABLE (WITH FLAGGED GAPS/CONVERSIONS):
${JSON.stringify(normalizedRows, null, 2)}

STRICT GENERATION INSTRUCTIONS:
1. "deltaSummary": Compare current telemetry against the Previous Brief record to explain what changed and why in ${profile.language}.
2. "plainSummary": Infer the most likely pollution hotspot and emission source from the chemical ratios (e.g., PM2.5/PM10 ratio, NO2 traffic signal, SO2/CO combustion signal) and sensor table notes. Write in plain language in ${profile.language}.
3. "prioritizedActions": Provide 6 highly actionable, practical local interventions tailored strictly to what a "${profile.role}" can execute. DO NOT include technical chemical formulas or numbers (no PM2.5, NO2, or µg/m³) inside these 6 action bullets—only clear human actions in ${profile.language}.
4. "citizenAdvisory": Write a compassionate public health advisory in ${profile.language} calibrated to "${profile.ageGroup}", with extra care for children, older adults, and people sensitive to poor air.
5. "internalBriefingNote": Write a concise official operational briefing memo in ${profile.language} logging the telemetry delta, isolated sensor anomalies, and assigned role escalation.
6. "whatsappBroadcastMessage": Draft a complete, ready-to-forward WhatsApp group message in ${profile.language} with clear formatting and emojis that combines the local alert, the health advisory, and the top action steps.
7. "citations" & "dataQualityFlags": List every traceable Row # / Sensor ID citation and explicitly flag every missing reading (N/A), unit conversion (mg/m³ -> µg/m³), or rejected sensor outlier.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
      },
      temperature: 0.25
    }
  });

  return JSON.parse(response.text);
}
