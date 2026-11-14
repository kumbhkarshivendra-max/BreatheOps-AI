import { GoogleGenAI, Type } from "https://esm.run/@google/genai";

export async function generateCivicIntelligence({ apiKey, zone, role, language, normalizedRows, previousPm25 }) {
  if (!apiKey) {
    throw new Error("Please paste your free Gemini API key in the top bar first.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are BreatheOps AI, an expert Civic Air Quality Assistant.
Analyze this air quality telemetry and generate a simple, non-technical action plan.

ZONE: ${zone.name} (Current PM2.5: ${zone.pm25} µg/m³, Previous Brief PM2.5: ${previousPm25} µg/m³)
USER ROLE: ${role} (Tailor actions strictly to what this person can do, including outdoor gig/delivery riders if selected)
TARGET LANGUAGE: ${language}
NORMALIZED DATA ROWS: ${JSON.stringify(normalizedRows)}

Return a JSON object matching the schema with plain-language explanations, traceable row citations, data quality flags, 3 simple role-specific actions, and a vulnerable-group advisory (for children, seniors, and outdoor gig workers) written in ${language}.
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
          citationText: { type: Type.STRING },
          topThreeActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          vulnerableAndGigAdvisory: { type: Type.STRING },
          dataQualityFlags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: [
          "deltaSummary",
          "plainSummary",
          "citationText",
          "topThreeActions",
          "vulnerableAndGigAdvisory",
          "dataQualityFlags"
        ]
      }
    }
  });

  return JSON.parse(response.text);
}
