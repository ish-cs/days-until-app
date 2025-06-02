// .netlify/functions/gemini.js
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function handler(event) {
  try {
    const { text: userInput, context } = JSON.parse(event.body);
    const today = new Date().toISOString().slice(0, 10);

    const prompt = `
Today is ${today}.
You are a smart assistant that extracts the event name, date and time from natural input.

Here is the user's existing event list:
${context.map(e => `- ${e.name} on ${e.date}${e.time ? ` at ${e.time}` : ''}`).join('\n')}

Now interpret this user input:
"${userInput}"

Return only JSON in this format:
{ "name": "event name", "date": "YYYY-MM-DD", "time": "HH:MM" }

- "time" should be 24-hour format (e.g. "18:30")
- If time is missing or unclear, use: "time": ""
- If date is missing or unclear, use: "date": null
- If name is missing, use: "name": null
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
