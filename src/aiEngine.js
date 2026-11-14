import { GoogleGenAI, Type } from "https://esm.run/@google/genai";

export async function generateCivicIntelligence({ apiKey, zone, profile, normalizedRows, previousPm25 }) {
  if (!apiKey) {
    throw new Error("Please click 'Change Profile / Language' at the top and paste your free Gemini API key first.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const readingLevelMap = {
    child: "Simple Grade-4 Child-Friendly level (extra care for young lungs and school play)",
    adult: "Standard Clear Public level (commuters, parents, and working adults)",
    senior: "Older Adult & Respiratory-Sensitive High-Care level (60+ seniors, asthma/COPD patients)"
  };

  const prompt = `
You are BreatheOps AI, an expert Civic Air Quality Intelligence System.
Analyze the live satellite telemetry and normalized messy sensor table below:

ZONE: ${zone.name} (Live PM2.5: ${zone.pm25} µg/m³, PM10: ${zone.pm10} µg/m³, NO2: ${zone.no2} µg/m³)
PREVIOUS BRIEF PM2.5: ${previousPm25} µg/m³
ASKING USER ROLE: ${profile.role}
TARGET LANGUAGE: ${profile.language}
TARGET AUDIENCE & READING LEVEL: ${readingLevelMap[profile.ageGroup]}
NORMALIZED SENSOR & COMPLAINT TABLE: ${JSON.stringify(normalizedRows)}

REQUIREMENTS:
1. Compare this brief with the Previous Brief (${previousPm25} -> ${zone.pm25} µg/m³) to explain what changed.
2. Summarize trends and likely hotspots in plain language, citing specific Row # and Sensor IDs.
3. Explicitly list every flagged data gap (N/A), unit conversion (mg/m³ -> µg/m³), and rejected sensor outlier.
4. Recommend 3 prioritized local interventions tailored strictly to what a "${profile.role}" can do.
5. Generate BOTH an "internalBriefingNote" (for civic/operational logging) AND a "citizenAdvisory" written in ${profile.language} at the requested reading level, with extra care for children, older adults, sensitive groups, and outdoor gig workers.
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
          citations: { type: Type.ARRAY, items: { type: Type.STRING } },
          dataQualityFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          prioritizedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          internalBriefingNote: { type: Type.STRING },
          citizenAdvisory: { type: Type.STRING }
        },
        required: [
          "deltaSummary",
          "plainSummary",
          "citations",
          "dataQualityFlags",
          "prioritizedActions",
          "internalBriefingNote",
          "citizenAdvisory"
        ]
      }
    }
  });

  return JSON.parse(response.text);
}
