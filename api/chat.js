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

    const cleanMessage = message.trim().slice(0, 1200);

    const prompt =
      'Sen lise 10. sınıf öğrencilerine C# öğreten net ve yardımcı bir öğretmensin.\n' +
      'Türkçe konuş. Gereksiz selamlama yapma.\n' +
      'Öğrenci kod isterse doğrudan tam çalışan C# kodu ver.\n' +
      'ÖNEMLİ: Markdown code block kullanma. Üç ters tırnak kullanma. ``` kullanma.\n' +
      'Kodları sadece şu formatta ver:\n\n' +
      '[KOD]\n' +
      'using System;\n\n' +
      'class Program\n' +
      '{\n' +
      '    static void Main()\n' +
      '    {\n' +
      '        Console.WriteLine("Merhaba");\n' +
      '    }\n' +
      '}\n' +
      '[/KOD]\n\n' +
      'Koddan sonra en fazla 3 kısa maddeyle açıkla.\n' +
      'Hesap makinesi istenirse toplama, çıkarma, çarpma, bölme içeren tam console uygulaması yaz.\n\n' +
      'Öğrenci sorusu: ' + cleanMessage;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

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
            maxOutputTokens: 1100,
            temperature: 0.2
          }
        })
      }
    );

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', data);
      return res.status(200).json({
        response: 'Yapay zeka şu an cevap veremedi. Birkaç saniye sonra tekrar dene.'
      });
    }

    let aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      return res.status(200).json({
        response: 'Şu an net bir cevap oluşturamadım. Sorunu daha kısa şekilde tekrar yazar mısın?'
      });
    }

    aiResponse = aiResponse
      .replace(/```csharp/g, '[KOD]')
      .replace(/```cs/g, '[KOD]')
      .replace(/```C#/g, '[KOD]')
      .replace(/```/g, '[/KOD]')
      .replace(/\[KOD\]\s*/g, '[KOD]\n')
      .replace(/\s*\[\/KOD\]/g, '\n[/KOD]')
      .trim();

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
