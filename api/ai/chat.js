import { clientIp, rateLimit, verifyUser } from "../_lib/guard.js";
import { clean, cleanUrl } from "../_lib/env.js";

// AI assistant, served through OpenRouter (https://openrouter.ai).
// Set OPENROUTER_API_KEY in Vercel. Optionally set OPENROUTER_MODEL (default below).
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!(await rateLimit(`chat-ip:${clientIp(req)}`, 30, 60_000))) return res.status(429).json({ error: "Too many requests. Try again soon." });

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to use the assistant." });
  if (!(await rateLimit(`chat-min:${user.id}`, 8, 60_000)) || !(await rateLimit(`chat-day:${user.id}`, 60, 86_400_000))) {
    return res.status(429).json({ error: "Message limit reached. Try again later." });
  }

  const key = clean("OPENROUTER_API_KEY");
  if (!key) return res.status(500).json({ error: "The AI service is not configured." });

  const message = String(req.body?.message || "").trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": cleanUrl("SITE_URL") || `https://${req.headers.host}`,
        "X-Title": "TerraLens"
      },
      body: JSON.stringify({
        model: clean("OPENROUTER_MODEL") || DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "You are TerraLens AI, a concise travel discovery assistant. Help users turn places and travel inspiration into practical ideas. Never invent live prices, opening hours, visa rules, weather, or availability. Clearly label estimates and suggest checking official sources for time-sensitive facts."
          },
          { role: "user", content: message }
        ]
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("OpenRouter error", r.status, JSON.stringify(data).slice(0, 300));
      const text = r.status === 402 ? "The AI assistant is paused right now. Please try again later."
        : r.status === 429 ? "The AI assistant is busy. Please try again in a minute."
        : "The AI assistant is unavailable right now. Please try again.";
      return res.status(503).json({ error: text });
    }
    return res.status(200).json({ reply: data?.choices?.[0]?.message?.content || "I couldn't generate a response." });
  } catch {
    return res.status(502).json({ error: "Unable to reach the AI service." });
  }
}
