export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Sadece POST isteği kabul edilir." });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mesaj boş olamaz." });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key tanımlı değil." });
    }

    const cleanMessage = message.trim().slice(0, 1600);

    const prompt = `
Sen lise 10. sınıf öğrencilerine C# öğreten net, ciddi ve yardımcı bir öğretmensin.

Kurallar:
- Türkçe cevap ver.
- Gereksiz selamlama yapma.
- Öğrenci kod isterse mutlaka tam çalışan C# kodu ver.
- Kod cevabı her zaman Markdown code block içinde olsun.
- Code block formatı kesinlikle şöyle olmalı:

\`\`\`csharp
// C# kodu buraya
\`\`\`

- Öğrenci “tamamını yaz”, “kodunu yaz”, “program yaz”, “uygulama yap”, “yapar mısın”, “hesap makinesi” derse doğrudan tam kod ver.
- Hesap makinesi istenirse toplama, çıkarma, çarpma ve bölme içeren tam console uygulaması yaz.
- Koddan önce uzun açıklama yapma.
- Koddan sonra en fazla 3 kısa maddeyle açıkla.
- Cevabı yarım bırakma.

Öğrenci sorusu:
${cleanMessage}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1800,
            temperature: 0.15,
            topP: 0.8,
            topK: 20
          }
        })
      }
    );

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      if (response.status === 429) {
        return res.status(200).json({
          response: "Şu anda çok fazla istek var. Birkaç saniye sonra tekrar dene."
        });
      }

      return res.status(200).json({
        response: "Yapay zeka şu an cevap veremedi. Sorunu biraz daha kısa yazar mısın?"
      });
    }

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      console.error("Empty Gemini response:", data);

      return res.status(200).json({
        response: "Şu an net bir cevap oluşturamadım. Sorunu daha kısa şekilde tekrar yazar mısın?"
      });
    }

    return res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error("Server error:", error);

    if (error.name === "AbortError") {
      return res.status(200).json({
        response: "Cevap süresi uzadı. Sorunu daha kısa yazıp tekrar dene."
      });
    }

    return res.status(200).json({
      response: "Geçici bir hata oluştu. Birkaç saniye sonra tekrar dene."
    });
  }
}
