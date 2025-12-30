
import { GoogleGenAI, Type } from "@google/genai";
import { ActivityType, WeatherInfo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getHumorousCaption = async (activity: ActivityType, status: string, mood: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User is ${activity} (${status}) and feeling ${mood}. Generate a funny, caring, or humorous one-sentence caption (max 10 words) for their partner to see.`,
    });
    return response.text?.trim() || "Just vibing through the day!";
  } catch (error) {
    return "Living the dream!";
  }
};

export const getSimulatedWeather = async (lat?: number, lon?: number): Promise<WeatherInfo> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a realistic weather object for ${lat && lon ? `location ${lat},${lon}` : 'a random city'}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            temp: { type: Type.NUMBER },
            condition: { type: Type.STRING },
            icon: { type: Type.STRING, description: "Weather emoji" }
          },
          required: ["temp", "condition", "icon"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return { temp: 22, condition: "Partly Cloudy", icon: "⛅" };
  }
};
