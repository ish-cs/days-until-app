import Groq from "groq-sdk";
import { extractStructuredDateTime, extractFallbackTitle } from "./dateExtract.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ALLOWED_COLORS = new Set([
  "yellow-300", "red-300", "green-300", "blue-300", "purple-300",
  "pink-300", "orange-300", "teal-300", "gray-300", "white",
]);

const ALLOWED_RECURRENCES = new Set(['weekly', 'monthly', 'yearly']);

/** First dash segment "red - …" → tailwind key when user names a color plainly */
const LEADING_COLOR_HINT = {
  yellow: "yellow-300",
  red: "red-300",
  green: "green-300",
  blue: "blue-300",
  purple: "purple-300",
  pink: "pink-300",
  orange: "orange-300",
  teal: "teal-300",
  gray: "gray-300",
  grey: "gray-300",
  white: "white",
};

function colorHintFromLeadingSegment(userInput) {
  const raw = userInput?.trim().split(/\s*-\s*/)[0]?.trim().toLowerCase();
  if (!raw) return null;
  const word = raw.replace(/-300$/i, "");
  const key = LEADING_COLOR_HINT[word];
  return key && ALLOWED_COLORS.has(key) ? key : null;
}

function weekdayLongFromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return dt.toLocaleDateString("en-US", { weekday: "long" });
}

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    const userInput = body.text ?? "";
    const rawContext = Array.isArray(body.context) ? body.context : [];
    const context = rawContext.slice(0, 20).map(e => ({
      name: String(e.name ?? '').replace(/[\r\n]/g, ' ').slice(0, 100),
      date: String(e.date ?? '').slice(0, 20),
      time: String(e.time ?? '').slice(0, 10),
    }));
    const today = body.today;

    const structured = extractStructuredDateTime(userInput, today);
    const todayWeekday = today ? weekdayLongFromISO(today) : "";

    const prompt = `Today is ${today} (${todayWeekday}). The user's phrase may contain a date/time — precise calendar dates are resolved separately; focus on meaning.

Extract:
1) Event title/name — short, human (strip leading filler like "remind me to").
2) time as HH:MM 24-hour if explicitly stated; else "".
3) color: yellow-300 | red-300 | green-300 | blue-300 | purple-300 | pink-300 | orange-300 | teal-300 | gray-300 | white (default yellow-300).
4) recurrence: ONLY set if the user explicitly means a repeating event.
   - "weekly" ONLY for: "every Friday", "every week", "weekly", "each Monday", "every other week"
   - "monthly" ONLY for: "every month", "monthly", "each month", "first of every month"
   - "yearly" ONLY for: "every year", "annually", "every January", "yearly"
   - null for ALL one-time date phrases: "next Friday", "this Tuesday", "tomorrow", "next week", "in 3 days", "on the 15th", "next month" — these are specific dates, NOT recurrences.
   - When in doubt: null. Prefer null over a wrong recurrence.

If no usable title: name null.

Existing events (context only):
${context.map(e => `- ${e.name} on ${e.date}${e.time ? ` at ${e.time}` : ''}`).join('\n') || '(none)'}

User phrase:
"${userInput}"

Return ONLY JSON:
{ "name": "string or null", "time": "HH:MM or empty string", "color": "tailwind token", "recurrence": "weekly"|"monthly"|"yearly"|null }`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const parsed = JSON.parse(completion.choices[0].message.content);

    const llmTime = typeof parsed.time === "string" ? parsed.time.trim() : "";
    const llmColor = typeof parsed.color === "string" ? parsed.color.trim() : "";

    let name = parsed.name;
    if (typeof name === "string") name = name.trim();
    if (!name || String(name).toLowerCase() === "null") {
      name = extractFallbackTitle(userInput);
    }

    const hintColor = colorHintFromLeadingSegment(userInput);
    const resolvedColor =
      ALLOWED_COLORS.has(llmColor) ? llmColor : hintColor || "yellow-300";

    const llmRecurrence = ALLOWED_RECURRENCES.has(parsed.recurrence) ? parsed.recurrence : null;

    const merged = {
      name: name || null,
      date: structured.date ?? null,
      time: structured.time || llmTime || "",
      color: resolvedColor,
      recurrence: llmRecurrence,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(merged),
    };
  } catch (err) {
    console.error("Groq function error:", err);
    const status = err?.status || 500;
    const friendly = status === 429
      ? "Rate limit hit. Please try again in a few seconds."
      : "AI failed. Please try again.";
    return {
      statusCode: status,
      body: JSON.stringify({ error: friendly }),
    };
  }
}
