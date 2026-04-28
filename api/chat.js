const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps.length > 0) return;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT tanımlı değil.');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function saveChatLog({ message, response, userId, status }) {
  try {
    initFirebase();

    await admin.firestore().collection('chatLogs').add({
      message: message || '',
      response: response || '',
      userId: userId || 'unknown',
      status: status || 'success',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Firestore kayıt hatası:', err.message);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST isteği kabul edilir.' });
  }

  const { message, userId } = req.body || {};
  const cleanMessage =
    typeof message === 'string' ? message.trim().slice(0, 1500) : '';

  try {
    if (!cleanMessage) {
      return res.status(400).json({ error: 'Mesaj boş olamaz.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      const errorText = 'Gemini API key tanımlı değil.';

      await saveChatLog({
        message: cleanMessage,
        response: errorText,
        userId,
        status: 'api_key_missing'
      });

      return res.status(200).json({ response: errorText });
    }

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

    const geminiResponse = await fetch(
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

    const data = await geminiResponse.json();

    let aiResponse = '';

    if (!geminiResponse.ok) {
      console.error('Gemini error:', data);

      if (geminiResponse.status === 429) {
        aiResponse = 'Şu anda çok fazla istek var. Birkaç saniye sonra tekrar dene.';
      } else {
        aiResponse = 'Yapay zeka şu an cevap veremedi. Sorunu biraz daha kısa yazar mısın?';
      }

      await saveChatLog({
        message: cleanMessage,
        response: aiResponse,
        userId,
        status: 'gemini_error'
      });

      return res.status(200).json({ response: aiResponse });
    }

    aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      aiResponse = 'Şu an net bir cevap oluşturamadım. Sorunu tekrar yazar mısın?';
    }

    await saveChatLog({
      message: cleanMessage,
      response: aiResponse,
      userId,
      status: 'success'
    });

    return res.status(200).json({ response: aiResponse });

  } catch (error) {
    console.error('Server error:', error);

    const errorMessage =
      error.name === 'AbortError'
        ? 'Cevap süresi uzadı. Sorunu daha kısa yazıp tekrar dene.'
        : 'Geçici bir hata oluştu. Birkaç saniye sonra tekrar dene.';

    await saveChatLog({
      message: cleanMessage,
      response: errorMessage,
      userId,
      status: error.name === 'AbortError' ? 'timeout' : 'server_error'
    });

    return res.status(200).json({ response: errorMessage });
  }
};
