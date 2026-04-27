module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });
    const prompt = 'Sen bir C# ogretmenisin. Turkce konus. Kisa ve net acikla. Tum kod orneklerini su formatta yaz: ```csharp\n// kod buraya\n``` Ogrenci sorusu: ' + message;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + GEMINI_API_KEY,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );
        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
          const aiResponse = data.candidates[0].content.parts[0].text;
          return res.status(200).json({ response: aiResponse });
        } else if (data.error) {
          lastError = data.error.message;
          if (data.error.code === 429) {
            await new Promise(function(r) { setTimeout(r, attempt * 2000); });
            continue;
          }
          return res.status(500).json({ error: data.error.message });
        } else {
          return res.status(500).json({ error: 'No response from AI' });
        }
      } catch (err) {
        lastError = err.message;
        await new Promise(function(r) { setTimeout(r, attempt * 1000); });
      }
    }
    return res.status(500).json({ error: 'Cok fazla istek: ' + lastError });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
