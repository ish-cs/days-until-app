// .netlify/functions/gemini.js
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function handler(event) {
  try {
    const { text: userInput } = JSON.parse(event.body);
    const today = new Date().toISOString().slice(0, 10);

    const prompt = `
Today is ${today}.
You are a smart assistant that extracts the event name and event date from this input:
"${userInput}"

Return only JSON in this format:
{ "name": "event name", "date": "YYYY-MM-DD" }

If a date is missing or unclear, return:
{ "name": null, "date": null }
`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonMatch = text.match(/{[\s\S]*?}/);
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gemini failed", detail: err.message }),
    };
  }
}
