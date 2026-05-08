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

    if (body.action === 'placeholder') {
      const rawContext = Array.isArray(body.context) ? body.context : [];
      const context = rawContext.slice(0, 30).map(e =>
        String(e.name ?? '').replace(/[\r\n]/g, ' ').slice(0, 80)
      );
      const THEMES = ['academic', 'social', 'health', 'work', 'personal', 'family', 'fitness', 'errand', 'creative', 'financial'];
      const COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'teal', null, null, null];
      const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
      const colorHint = COLORS[Math.floor(Math.random() * COLORS.length)];

      const prompt = `You help generate placeholder text for an event input box.
Based on the user's existing events, infer their life context (student, professional, parent, etc).
Generate ONE short realistic example event in natural language — something they might plausibly add.
Rules:
- MUST include a relative date (e.g. "next Tuesday", "this Friday", "tomorrow", "in 3 days", "next week")
- Optionally include a time if the event is time-sensitive (e.g. "3pm", "10:30am")
- Theme for this example: ${theme}${colorHint ? `\n- Prefix with color: "${colorHint} - ..."` : ''}
- Do NOT reuse any existing events
- Keep it under 10 words total, conversational

Existing events: ${context.length ? context.join(', ') : '(none yet)'}

Return ONLY JSON: { "placeholder": "..." }`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });
      const parsed = JSON.parse(completion.choices[0].message.content);
      const text = typeof parsed.placeholder === 'string' && parsed.placeholder.trim()
        ? parsed.placeholder.trim()
        : 'Dentist next Tuesday 3pm';
      return { statusCode: 200, body: JSON.stringify({ placeholder: text }) };
    }

    if (body.action === 'complete') {
      const rawText = typeof body.text === 'string' ? body.text : '';
      const text = rawText.slice(0, 200);
      const todayISO = typeof body.today === 'string' ? body.today.slice(0, 20) : '';

      if (!text.trim()) {
        return { statusCode: 200, body: JSON.stringify({ suffix: '' }) };
      }

      const prompt = `You are an autocomplete engine for a single-line calendar/countdown event input.
${todayISO ? `Today is ${todayISO}.` : ''}
The user is currently typing this text:
"${text}"

Your job: predict ONLY the characters that should be appended to the END of that text to naturally continue what they are typing.
- If the last word is partial, complete that word first.
- Otherwise, predict the next short token (a word, a date phrase, a time, etc.).
- Keep the continuation SHORT (typically 1-20 characters, never more than 48).
- Do NOT repeat any of the existing text.
- Do NOT include leading whitespace if the user already ended with a space.
- Add a single leading space ONLY if the user's text does not end with whitespace AND your suffix starts a new word.
- No newlines. Single line only.
- If you are unsure or have nothing useful to add, return an empty string.

Return ONLY JSON: { "suffix": "..." }`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
      });

      let suffix = '';
      try {
        const parsedC = JSON.parse(completion.choices[0].message.content);
        if (typeof parsedC.suffix === 'string') suffix = parsedC.suffix;
      } catch {
        suffix = '';
      }

      if (/[\r\n]/.test(suffix)) suffix = '';
      suffix = suffix.trim();
      if (suffix.length > 48) suffix = '';
      if (suffix.length > text.length + 20) suffix = '';
      if (suffix && text.toLowerCase().endsWith(suffix.toLowerCase())) suffix = '';

      return { statusCode: 200, body: JSON.stringify({ suffix }) };
    }

    const userInput = body.text ?? "";
    const rawContext = Array.isArray(body.context) ? body.context : [];
    const context = rawContext.slice(0, 30).map((e) => ({
      name: String(e.name ?? '').replace(/[\r\n]/g, ' ').slice(0, 100),
      date: String(e.date ?? '').slice(0, 20),
      time: String(e.time ?? '').slice(0, 10),
      recurrence: typeof e.recurrence === 'string' ? e.recurrence : null,
    }));
    const today = body.today;

    const structured = extractStructuredDateTime(userInput, today, context);
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

Existing events (names + dates help resolve phrases like "the day after my bday" or "a week after dog walk" — use ONLY this list to anchor those relative dates; do not treat them as free-form text):
${context.map(e => `- ${e.name} on ${e.date}${e.time ? ` at ${e.time}` : ''}${e.recurrence ? ` (${e.recurrence})` : ''}`).join('\n') || '(none)'}

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
