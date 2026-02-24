// /api/chat.js - Vercel Serverless Function - Gemini API Backend (CommonJS)

module.exports = async function handler(req, res) {
  // CORS ayarları
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Sen bir C# programlama öğretmenisin. Türkçe konuş. Kısa ve net açıkla. Kod örnekleri ver. Samimi ol.

Öğrenci sorusu: ${message}`
            }]
          }]
        })
      }
    );

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const aiResponse = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ response: aiResponse });
    } else if (data.error) {
      return res.status(500).json({ error: data.error.message });
    } else {
      return res.status(500).json({ error: 'No response from AI' });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
