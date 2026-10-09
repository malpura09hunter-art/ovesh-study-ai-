import fs from "node:fs/promises";
import path from "node:path";

const STOP = new Set(["what","when","where","which","with","from","that","this","have","does","about","explain","define","write","give","tell","into","your","there","their","then","than","also","how","why","for","and","the","are","was","were","can","could","would","should","you","use","used","using","topic","notes"]);
function tokens(value) { return String(value || "").toLowerCase().match(/[a-z0-9+#.-]{2,}/g)?.filter(t => !STOP.has(t)) || []; }
function rankChunks(chunks, query, subject) {
  const terms = [...new Set(tokens(query))];
  return chunks.map(chunk => {
    const title = String(chunk.title || "") + " " + String(chunk.chapter || "") + " " + String(chunk.unit || "");
    const haystack = (title + " " + String(chunk.text || "")).toLowerCase();
    let score = 0;
    for (const term of terms) if (haystack.includes(term)) score += (title.toLowerCase().includes(term) ? 4 : 1) * Math.min(5, haystack.split(term).length - 1);
    if (subject && String(chunk.subject || "").toUpperCase() === subject.toUpperCase()) score *= 1.8;
    return { chunk, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 5);
}
async function loadChunks() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "ai-chunks.json"), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.chunks || [];
  } catch { return []; }
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 2500) : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim().slice(0, 12) : "";
  const action = req.body?.action === "quiz" ? "quiz" : "answer";
  if (!question) return res.status(400).json({ error: "Enter a question or topic first." });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Study AI needs OPENAI_API_KEY configured in Vercel." });
  try {
    const chunks = await loadChunks();
    const matches = rankChunks(chunks, question, subject);
    if (!matches.length) return res.status(200).json({ answer: "I couldn't find a relevant passage in the connected study notes. Try a more specific topic, or check that the notes index and AI text chunks have been added to this deployment.", questions: [], sources: [], grounded: false });
    const excerpts = matches.map(({chunk}, i) => `[Source ${i+1}] Subject: ${chunk.subject || "Unknown"} | ${chunk.title || "Notes"} | ${chunk.unit || ""} | File: ${chunk.file || "not specified"}\n${String(chunk.text || "").slice(0, 3200)}`).join("\n\n---\n\n").slice(0, 14000);
    const system = action === "quiz"
      ? 'You are StudySpace, a careful college exam-preparation assistant. Use ONLY the supplied source excerpts. Generate 5 practice questions based on those excerpts. Do not call them official or past-paper questions. Return valid JSON only: {"title":"string","questions":[{"question":"string","type":"short or mcq","options":["option"],"answer":"string","explanation":"string","source":"filename"}]}. For short questions options must be []. If excerpts are insufficient, return {"title":"Not enough source material","questions":[]}.'
      : "You are StudySpace, a careful college study assistant. Answer using ONLY the supplied study-note excerpts. Explain clearly for a college student. Do not add unsupported facts. If the excerpts do not contain the answer, say so. Cite source filenames.";
    const user = `Student request: ${question}\nPreferred subject: ${subject || "Any subject"}\n\nRetrieved source excerpts:\n${excerpts}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: user }], ...(action === "quiz" ? { response_format: { type: "json_object" } } : {}) })
    });
    if (!response.ok) return res.status(502).json({ error: "AI provider error. Check the key, quota and model configuration." });
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "";
    const sources = [...new Map(matches.map(({chunk}) => [chunk.file, { subject: chunk.subject || "", title: chunk.title || "Study notes", unit: chunk.unit || "", file: chunk.file || "" }]).filter(([file]) => file)).values()];
    if (action === "quiz") {
      try { return res.status(200).json({ ...JSON.parse(answer), sources, grounded: true }); }
      catch { return res.status(502).json({ error: "The quiz could not be formatted. Please try again." }); }
    }
    return res.status(200).json({ answer, sources, grounded: true });
  } catch { return res.status(500).json({ error: "Study AI encountered an unexpected error." }); }
}
