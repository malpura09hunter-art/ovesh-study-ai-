export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 2500) : "";
  if (!question) return res.status(400).json({ error: "Enter a question first." });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Study AI needs OPENAI_API_KEY configured in Vercel." });
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Authorization": "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.2, messages: [{ role: "system", content: "You are StudySpace, a careful college study assistant. Explain concepts clearly. Do not pretend to have read the user's notes when no note excerpts are supplied; ask for the subject or text when needed." }, { role: "user", content: question }] }) });
    if (!r.ok) return res.status(502).json({ error: "AI provider error. Check the key, quota and model configuration." });
    const data = await r.json(); return res.status(200).json({ answer: data.choices?.[0]?.message?.content || "No answer returned." });
  } catch { return res.status(500).json({ error: "Study AI encountered an unexpected error." }); }
}
