// ===================== XOLVER BACKGROUND SERVICE WORKER =====================
// Handles Gemini API calls and stores chat history persistently

const SYSTEM_INSTRUCTION = `Sen "Xolver" adlı bir soru çözme asistanısın. Kullanıcı sana web sayfalarından seçtiği HTML elementlerini gönderecek. Bu elementler genellikle soru, test sorusu veya problem içerir.

Görevin:
1. HTML içeriğini analiz et ve soruyu/problemi tespit et
2. Soruyu net ve doğru bir şekilde yanıtla
3. Eğer test sorusuysa, doğru şıkkı belirt ve nedenini açıkla
4. Eğer açık uçlu bir soruysa, kapsamlı bir cevap ver
5. Matematiksel işlemler gerekiyorsa adım adım çöz
6. Yanıtlarını Türkçe ver

Markdown formatında yanıtla.`;

const SYSTEM_INSTRUCTION_SHORT = `Sen "Xolver" adlı bir soru çözme asistanısın. Kullanıcı sana web sayfalarından seçtiği HTML elementlerini gönderecek.

KURALLAR:
- SADECE cevabı ver, açıklama yapma.
- Test sorusuysa sadece doğru şıkkı yaz (örn: "B").
- Açık uçlu soruysa en kısa şekilde cevapla.
- Matematiksel sorularda sadece sonucu yaz.
- Gereksiz söz yazma, doğrudan cevap ver.
- Türkçe yanıtla.`;

// ===================== STORAGE HELPERS =====================
async function getChatMessages() {
  const data = await chrome.storage.local.get('xolverChatMessages');
  return data.xolverChatMessages || [];
}

async function saveChatMessages(messages) {
  await chrome.storage.local.set({ xolverChatMessages: messages });
}

async function getApiHistory() {
  const data = await chrome.storage.local.get('xolverApiHistory');
  return data.xolverApiHistory || [];
}

async function saveApiHistory(history) {
  await chrome.storage.local.set({ xolverApiHistory: history });
}

// ===================== GEMINI API =====================
async function callGemini(html, userText) {
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'xolverShortAnswer']);
  const apiKey = data.geminiApiKey;
  const model = data.geminiModel || 'gemini-2.5-flash';

  if (!apiKey) {
    const msgs = await getChatMessages();
    msgs.push({ role: 'system', text: '⚠ Lütfen önce Ayarlar\'dan Gemini API anahtarınızı girin.' });
    await saveChatMessages(msgs);
    chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    return;
  }

  // Build user message for API
  let apiMsg = '';
  if (html) {
    apiMsg += `Aşağıdaki HTML elementi bir web sayfasından seçildi. Bu bir soru veya test sorusu olabilir. Lütfen içeriği analiz et ve soruyu yanıtla. Cevabı doğrudan ver, açıklama ekle.\n\n\`\`\`html\n${html}\n\`\`\``;
  }
  if (userText) {
    apiMsg += (html ? '\n\nKullanıcının ek mesajı: ' : '') + userText;
  }

  // Build display message for UI
  const displayMsg = html
    ? '📌 Element seçildi — analiz ediliyor...' + (userText ? '\n' + userText : '')
    : userText;

  // Save user message to chat
  const chatMessages = await getChatMessages();
  chatMessages.push({ role: 'user', text: displayMsg });
  await saveChatMessages(chatMessages);

  // Save to API history
  const apiHistory = await getApiHistory();
  apiHistory.push({ role: 'user', parts: [{ text: apiMsg }] });
  await saveApiHistory(apiHistory);

  // Notify popup that a new user message was added + loading started
  chrome.runtime.sendMessage({ action: 'chatUpdated', loading: true }).catch(() => {});

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: data.xolverShortAnswer ? SYSTEM_INSTRUCTION_SHORT : SYSTEM_INSTRUCTION }] },
          contents: apiHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      const errMsg = err.error?.message || `HTTP ${response.status}`;

      // Remove failed user message from API history
      apiHistory.pop();
      await saveApiHistory(apiHistory);

      // Add error to chat
      const msgs = await getChatMessages();
      msgs.push({ role: 'ai', text: `❌ Hata: ${errMsg}` });
      await saveChatMessages(msgs);

      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
      return;
    }

    const result = await response.json();
    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Yanıt alınamadı.';

    // Save AI response to API history
    apiHistory.push({ role: 'model', parts: [{ text: aiText }] });
    await saveApiHistory(apiHistory);

    // Save AI response to chat
    const msgs = await getChatMessages();
    msgs.push({ role: 'ai', text: aiText });
    await saveChatMessages(msgs);

    // Notify popup
    chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});

  } catch (err) {
    // Remove failed user message from API history
    apiHistory.pop();
    await saveApiHistory(apiHistory);

    const msgs = await getChatMessages();
    msgs.push({ role: 'ai', text: `❌ Bağlantı hatası: ${err.message}` });
    await saveChatMessages(msgs);

    chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
  }
}

// ===================== MESSAGE HANDLER =====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'elementSelected') {
    // Element selected from content script — call Gemini in background
    callGemini(msg.html, '');
    // Store last selected HTML/tag for preview
    chrome.storage.local.set({
      xolverLastSelected: { html: msg.html, tagInfo: msg.tagInfo }
    });
  }

  if (msg.action === 'sendMessage') {
    // Manual message from popup
    callGemini(msg.html || '', msg.text || '');
  }

  if (msg.action === 'clearChat') {
    chrome.storage.local.set({
      xolverChatMessages: [],
      xolverApiHistory: [],
      xolverLastSelected: null
    });
  }
});

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Xolver extension installed');
});
