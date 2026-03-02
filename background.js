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

const SYSTEM_INSTRUCTION_AUTOSOLVE = `Sen bir soru çözme botusun. Sana HTML formatında bir soru gönderilecek. 

MUTLAK KURALLAR:
- SADECE doğru şıkkın harfini yaz. Örnek: A veya B veya C veya D
- Başka HİÇBİR ŞEY yazma. Açıklama yapma, nokta koyma, cümle yazma.
- Sadece tek bir büyük harf yaz.
- Eğer açık uçlu bir soruysa en kısa cevabı yaz.`;

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
    msgs.push({ role: 'system', text: '❌ Lütfen önce Ayarlar\'dan Gemini API anahtarınızı girin.' });
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
    ? '📌 Analiz ediliyor...' + (userText ? '\n' + userText : '')
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
    focusXolverWindow();

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

// ===================== FOCUS XOLVER WINDOW =====================
async function focusXolverWindow() {
  const data = await chrome.storage.local.get('xolverWindowId');
  if (data.xolverWindowId) {
    try {
      await chrome.windows.update(data.xolverWindowId, { focused: true });
    } catch (e) {
      // Window may have been closed
      await chrome.storage.local.remove('xolverWindowId');
    }
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
    // Bring Xolver window to front
    focusXolverWindow();
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

  if (msg.action === 'autoSolveStart') {
    // Add "Otomatik Çözüm" banner to chat (don't set loading:true here to avoid race with noQuestions)
    (async () => {
      const msgs = await getChatMessages();
      msgs.push({ role: 'autosolve-banner', text: '⚡ Otomatik Çözüm' });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    })();
  }

  if (msg.action === 'autoSolveAllQuestions') {
    // Receive all questions at once, process sequentially
    autoSolveCancelled = false;
    const tabId = msg.tabId || sender.tab?.id;
    console.log('[Xolver BG] autoSolveAllQuestions received,', msg.questions.length, 'questions, tabId:', tabId);
    processAutoSolveQueue(msg.questions, msg.totalQuestions, tabId);
  }

  if (msg.action === 'autoSolveCancel') {
    console.log('[Xolver BG] Auto-solve cancelled by user');
    autoSolveCancelled = true;
    (async () => {
      const msgs = await getChatMessages();
      msgs.push({ role: 'autosolve-banner', text: '⛔ Otomatik çözüm iptal edildi' });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    })();
  }

  if (msg.action === 'autoSolveNoQuestions') {
    (async () => {
      const msgs = await getChatMessages();
      msgs.push({ role: 'autosolve-banner', text: '❌ Sayfada soru bulunamadı' });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    })();
  }
});

// ===================== AUTO-SOLVE SEQUENTIAL QUEUE =====================
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT = 20000;
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.0-flash', 'gemini-3.0-pro', 'gemini-3.1-pro'];
let autoSolveCancelled = false;

async function processAutoSolveQueue(questions, totalQuestions, tabId) {
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'xolverAutoModelSwitch']);
  const apiKey = data.geminiApiKey;
  const baseModel = data.geminiModel || 'gemini-2.5-flash';
  const autoModelSwitch = !!data.xolverAutoModelSwitch;
  const startIdx = FALLBACK_MODELS.indexOf(baseModel);
  let currentModel = baseModel;
  let currentFallbacks = autoModelSwitch && startIdx !== -1 ? FALLBACK_MODELS.slice(startIdx + 1) : [];

  if (!apiKey) {
    console.log('[Xolver BG] No API key!');
    const msgs = await getChatMessages();
    msgs.push({ role: 'system', text: '❌ API anahtarı bulunamadı!' });
    await saveChatMessages(msgs);
    chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'autoSolveStatus', status: 'done', solved: 0 }).catch(() => {});
    return;
  }

  let solvedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < questions.length; i++) {
    // Check cancellation (message already written by autoSolveCancel handler)
    if (autoSolveCancelled) {
      console.log('[Xolver BG] Auto-solve cancelled at question', i + 1);
      chrome.runtime.sendMessage({ action: 'autoSolveStatus', status: 'done', solved: solvedCount, failed: failedCount }).catch(() => {});
      return;
    }

    const q = questions[i];
    console.log('[Xolver BG] Processing question', q.questionIndex + 1, '/', totalQuestions);

    const result = await solveOneQuestion(q.html, q.questionIndex, tabId, apiKey, currentModel, currentFallbacks);
    currentModel = result.finalModel;
    const newIdx = FALLBACK_MODELS.indexOf(currentModel);
    currentFallbacks = autoModelSwitch && newIdx !== -1 ? FALLBACK_MODELS.slice(newIdx + 1) : [];
    if (result.success) {
      solvedCount++;
    } else {
      failedCount++;
    }

    // Pace requests based on free API mode setting
    if (i < questions.length - 1) {
      const settings = await chrome.storage.local.get('xolverFreeApi');
      const isFreeApi = settings.xolverFreeApi !== false; // default true
      const delay = isFreeApi ? 13000 : 1000;
      console.log('[Xolver BG] Waiting', delay, 'ms before next question (freeApi:', isFreeApi, ')');
      // Wait in 1s chunks so cancellation is responsive
      const chunks = Math.ceil(delay / 1000);
      for (let c = 0; c < chunks; c++) {
        if (autoSolveCancelled) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // Final status
  console.log('[Xolver BG] Auto-solve complete:', solvedCount, 'solved,', failedCount, 'failed');

  // Add completion summary to chat
  const finalMsgs = await getChatMessages();
  if (failedCount > 0) {
    finalMsgs.push({ role: 'autosolve-banner', text: '✅ Otomatik çözüm tamamlandı — ' + solvedCount + ' çözüldü, ' + failedCount + ' başarısız' });
  } else {
    finalMsgs.push({ role: 'autosolve-banner', text: '✅ Otomatik çözüm tamamlandı — ' + solvedCount + ' soru çözüldü' });
  }
  await saveChatMessages(finalMsgs);
  chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});

  chrome.runtime.sendMessage({
    action: 'autoSolveStatus',
    status: 'done',
    solved: solvedCount,
    failed: failedCount
  }).catch(() => {});
  focusXolverWindow();
}

async function solveOneQuestion(html, questionIndex, tabId, apiKey, model, fallbackModels = []) {
  const apiMsg = `Bu HTML bir sınav/test sorusudur. Doğru cevabın şıkkını (harfini) söyle:\n\n\`\`\`html\n${html}\n\`\`\``;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check cancellation before each attempt
    if (autoSolveCancelled) return { success: false, finalModel: model };

    try {
      // 30 second timeout for each fetch
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION_AUTOSOLVE }] },
            contents: [{ role: 'user', parts: [{ text: apiMsg }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 100,
            }
          })
        }
      );
      clearTimeout(timeout);

      if (response.status === 429) {
        const errBody = await response.text();
        console.warn('[Xolver BG] Rate limited on question', questionIndex + 1, 'attempt', attempt + 1);

        // Auto model switch: try next model immediately without waiting
        if (fallbackModels.length > 0) {
          const nextModel = fallbackModels[0];
          const remaining = fallbackModels.slice(1);
          const switchMsgs = await getChatMessages();
          switchMsgs.push({ role: 'system', text: `🔄 Soru ${questionIndex + 1}: ${model} kota doldu, ${nextModel} deneniyor...` });
          await saveChatMessages(switchMsgs);
          chrome.runtime.sendMessage({ action: 'chatUpdated', loading: true }).catch(() => {});
          return solveOneQuestion(html, questionIndex, tabId, apiKey, nextModel, remaining);
        }

        if (attempt < MAX_RETRIES) {
          // Extract retry delay, cap at MAX_RETRY_WAIT
          let waitTime = MAX_RETRY_WAIT;
          const retryMatch = errBody.match(/retry in ([\d.]+)s/i);
          if (retryMatch) {
            waitTime = Math.min(Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000, MAX_RETRY_WAIT);
          }

          const msgs = await getChatMessages();
          msgs.push({ role: 'system', text: `⏳ Soru ${questionIndex + 1}: Kota aşıldı, ${Math.ceil(waitTime / 1000)}sn bekleniyor...` });
          await saveChatMessages(msgs);
          chrome.runtime.sendMessage({ action: 'chatUpdated', loading: true }).catch(() => {});

          // Wait in 1s chunks so cancellation is responsive
          const retryChunks = Math.ceil(waitTime / 1000);
          for (let rc = 0; rc < retryChunks; rc++) {
            if (autoSolveCancelled) return { success: false, finalModel: model };
            await new Promise(r => setTimeout(r, 1000));
          }
          continue;
        } else {
          const msgs = await getChatMessages();
          msgs.push({ role: 'ai', text: `❌ Soru ${questionIndex + 1}: Kota hatası — çözülemedi` });
          await saveChatMessages(msgs);
          chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
          return { success: false, finalModel: model };
        }
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[Xolver BG] API error for question', questionIndex + 1, ':', response.status, errBody);

        // Show error in chat
        let errMsg = `HTTP ${response.status}`;
        try {
          const errJson = JSON.parse(errBody);
          errMsg = errJson.error?.message || errMsg;
        } catch(e) {}

        const msgs = await getChatMessages();
        msgs.push({ role: 'ai', text: `❌ Soru ${questionIndex + 1}: ${errMsg}` });
        await saveChatMessages(msgs);
        chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
        return { success: false, finalModel: model };
      }

      // Success
      const result = await response.json();
      const answer = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[Xolver BG] Got answer for question', questionIndex + 1, ':', JSON.stringify(answer));

      // Send answer to content script
      if (tabId) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'autoSolveAnswer',
            questionIndex: questionIndex,
            answer: answer.trim()
          });
          console.log('[Xolver BG] Sent answer to tab', tabId);
        } catch (sendErr) {
          console.error('[Xolver BG] Failed to send to tab', tabId, ':', sendErr);
        }
      }

      // Add to chat
      const msgs = await getChatMessages();
      msgs.push({ role: 'ai', text: `⚡ Soru ${questionIndex + 1}: **${answer.trim()}**` });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
      return { success: true, finalModel: model };

    } catch (err) {
      console.error('[Xolver BG] Fetch error for question', questionIndex + 1, ':', err);

      if (attempt >= MAX_RETRIES) {
        const msgs = await getChatMessages();
        msgs.push({ role: 'ai', text: `❌ Soru ${questionIndex + 1}: Bağlantı hatası — ${err.message}` });
        await saveChatMessages(msgs);
        chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
        return { success: false, finalModel: model };
      }

      // Wait before retry on network error
      for (let rc = 0; rc < 3; rc++) {
        if (autoSolveCancelled) return { success: false, finalModel: model };
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  return { success: false, finalModel: model };
}

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Xolver extension installed');
});
