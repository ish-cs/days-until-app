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
You are a smart assistant that extracts the event name, date, time, and optional color from natural input.

Here is the user's existing event list (for context, do not modify these):
${context.map(e => `- ${e.name} on ${e.date}${e.time ? ` at ${e.time}` : ''}`).join('\n')}

Now interpret this user input:
"${userInput}"

Return only JSON in this format:
{ "name": "event name", "date": "YYYY-MM-DD", "time": "HH:MM", "color": "tailwind-color-class" }

- "time" should be 24-hour format (e.g. "18:30"). If time is missing or unclear, use: "time": "".
- If date is missing or unclear, use: "date": null.
- If name is missing, use: "name": null.
- "color" should be a valid Tailwind CSS color class from this list: 'yellow-300', 'red-300', 'green-300', 'blue-300', 'purple-300', 'pink-300', 'orange-300', 'teal-300', 'gray-300', 'white'. If no specific color is mentioned or understood, use: "yellow-300".
`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "name": { "type": "STRING", "nullable": true },
            "date": { "type": "STRING", "nullable": true },
            "time": { "type": "STRING" },
            "color": { "type": "STRING" }
          },
          required: ["name", "date", "time", "color"]
        }
      }
    });

    const geminiResponseText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    // --- FIX START ---
    // Use a regex to extract the JSON string, accounting for markdown code blocks
    const jsonMatch = geminiResponseText.match(/```json\n([\s\S]*?)\n```/);
    let jsonString;
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1]; // Extract content within ```json ... ```
    } else {
      // If no markdown fences, assume the response is pure JSON
      jsonString = geminiResponseText;
    }
    const parsed = JSON.parse(jsonString);
    // --- FIX END ---

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    console.error("Gemini function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gemini failed", detail: err.message, stack: err.stack }),
    };
  }
}