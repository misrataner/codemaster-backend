module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST isteği kabul edilir.' });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mesaj boş olamaz.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key tanımlı değil.' });
    }

    const cleanMessage = message.trim().slice(0, 1500);

    const prompt =
      'Sen lise 10. sınıf öğrencilerine C# öğreten net bir öğretmensin. ' +
      'Türkçe konuş. ' +
      'Öğrenci kod isterse açıklama yapma, selamlama yapma, sadece tam çalışan C# kodu ver. ' +
      'Hesap makinesi istenirse çok kısa ama tam çalışan console kodu ver. ' +
      'Kodda menü kullanma. Sadece iki sayı alıp toplama, çıkarma, çarpma ve bölme sonuçlarını ekrana yazdır. ' +
      'Kodun başına sadece [KOD] yaz. Kodun sonuna sadece [/KOD] yaz. ' +
      'Kod eksik kalmasın. Kod dışında açıklama yazma. ' +
      'Öğrenci sorusu: ' + cleanMessage;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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
            maxOutputTokens: 2000,
            temperature: 0.1
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
          response: 'Şu anda çok fazla istek var. Birkaç saniye sonra tekrar dene.'
        });
      }

      return res.status(200).json({
        response: 'Yapay zeka şu an cevap veremedi. Sorunu biraz daha kısa yazar mısın?'
      });
    }

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      return res.status(200).json({
        response: 'Şu an net bir cevap oluşturamadım. Sorunu tekrar yazar mısın?'
      });
    }

    return res.status(200).json({ response: aiResponse });

  } catch (error) {
    console.error('Server error:', error);

    if (error.name === 'AbortError') {
      return res.status(200).json({
        response: 'Cevap süresi uzadı. Sorunu daha kısa yazıp tekrar dene.'
      });
    }

    return res.status(200).json({
      response: 'Geçici bir hata oluştu. Birkaç saniye sonra tekrar dene.'
    });
  }
};
