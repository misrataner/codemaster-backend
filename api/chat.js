// /api/chat.js
// Vercel Serverless Function - Gemini API Backend (CommonJS)

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const message = body.message;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "API key not configured" });
    }

    // Gemini API call
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    `Sen bir C# programlama öğretmenisin. Türkçe konuş. Kısa ve net açıkla. Kod örnekleri ver. Samimi ol.\n\n` +
                    `Öğrenci sorusu: ${message}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await resp.json();

    if (data?.candidates?.length > 0?. && data.candidates[0]?.content?.parts?.length) {
      const aiResponse = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ response: aiResponse });
    }

    if (data?.error?.message) {
      return res.status(500).json({ error: data.error.message });
    }

    return res.status(500).json({ error: "No response from AI" });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
};
