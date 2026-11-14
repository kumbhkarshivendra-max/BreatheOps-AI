export async function generateCivicIntelligence({ apiKey, zone, profile, normalizedRows, previousPm25 }) {
  if (!apiKey) {
    throw new Error("Please click 'Change Area / Role' at the top and paste your free Gemini API key first.");
  }

  const { GoogleGenAI, Type } = await import("https://esm.run/@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const readingLevelMap = {
    child: "Simple Grade-4 Child-Friendly level (warm, protective, easy words for school kids)",
    adult: "Standard Clear Public level (direct, practical everyday language)",
    senior: "Older Adult & Sensitive Lungs High-Care level (gentle, clear, health-first guidance)"
  };

  const prompt = `
You are BreatheOps AI, a friendly Civic Air Quality Assistant.
Analyze the local air quality situation and generate a response ENTIRELY in ${profile.language} (Universal Translation Mode).

LOCALITY: ${zone.name}
ASKING USER ROLE: ${profile.role}
TARGET AUDIENCE & READING LEVEL: ${readingLevelMap[profile.ageGroup]}
PREVIOUS READING VS CURRENT: Was ${previousPm25}, now ${zone.pm25}
NORMALIZED SENSOR TABLE: ${JSON.stringify(normalizedRows)}

STRICT RULES:
1. Write "deltaSummary", "plainSummary", "prioritizedActions", and "citizenAdvisory" naturally in ${profile.language}.
2. Provide 6 specific, practical "prioritizedActions" tailored strictly to what a "${profile.role}" can do right now.
3. DO NOT include technical chemical names, numbers, or units (NO "PM2.5", "PM10", "NO2", or "µg/m³") inside "prioritizedActions" or "citizenAdvisory" — write pure, easy-to-follow human actions.
4. Keep technical sensor IDs and unit conversion flags strictly inside "citations" and "dataQualityFlags" (for the hidden audit popup).
5. Generate an "internalBriefingNote" for official municipal/ward records.
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
