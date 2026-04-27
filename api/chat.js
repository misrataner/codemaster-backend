module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST istegi kabul edilir.' });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const cleanMessage = message.trim().slice(0, 800);

    const prompt =
      'Sen bir C# ogretmenisin. Turkce konus. Kisa, net ve ogrenci seviyesinde acikla. ' +
      'Cevabin en fazla 120 kelime olsun. Kod gerekiyorsa su formatta yaz: ```csharp\\n// kod buraya\\n``` ' +
      'Ogrenci sorusu: ' + cleanMessage;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 350,
            temperature: 0.5
          }
        })
      }
    );

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', data);

      if (response.status === 429) {
        return res.status(200).json({
          response: 'Şu anda çok fazla istek var. Lütfen birkaç saniye sonra tekrar dene.'
        });
      }

      return res.status(200).json({
        response: 'Yapay zeka şu an cevap veremedi. Sorunu biraz daha kısa yazar mısın?'
      });
    }

    const aiResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      console.error('Empty Gemini response:', data);
      return res.status(200).json({
        response: 'Şu an net bir cevap oluşturamadım. Sorunu daha kısa şekilde tekrar yazar mısın?'
      });
    }

    return res.status(200).json({ response: aiResponse });

  } catch (error) {
    console.error('Server error:', error);

    if (error.name === 'AbortError') {
      return res.status(200).json({
        response: 'Cevap süresi uzadı. Lütfen sorunu daha kısa yazıp tekrar dene.'
      });
    }

    return res.status(200).json({
      response: 'Geçici bir hata oluştu. Birkaç saniye sonra tekrar dene.'
    });
  }
};
