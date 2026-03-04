// ===================== XOLVER BACKGROUND SERVICE WORKER =====================
// Handles Gemini API calls and stores chat history persistently

const SYSTEM_INSTRUCTION = `You are "Xolver", a question-solving assistant. The user will send you HTML elements selected from web pages. These elements usually contain questions, quiz questions, or problems.

Your tasks:
1. Analyze the HTML content and identify the question/problem
2. Answer the question clearly and correctly
3. If it is a multiple-choice question, identify the correct option and explain why
4. If it is an open-ended question, provide a comprehensive answer
5. If mathematical operations are required, solve step by step
6. Respond in English

Reply in Markdown format.`;

const SYSTEM_INSTRUCTION_SHORT = `You are "Xolver", a question-solving assistant. The user will send you HTML elements selected from web pages.

RULES:
- Give ONLY the answer, no explanation.
- For multiple-choice questions, write only the correct option (e.g., "B").
- For open-ended questions, answer as briefly as possible.
- For math questions, write only the result.
- Do not write unnecessary words, give the answer directly.
- Respond in English.`;

const SYSTEM_INSTRUCTION_AUTOSOLVE = `You are a question-solving bot. You will be sent a question in HTML format.

ABSOLUTE RULES:
- Write ONLY the letter of the correct option. Example: A or B or C or D
- Write NOTHING else. No explanation, no punctuation, no sentences.
- Write only a single uppercase letter.
- If it is an open-ended question, write the shortest possible answer.`;

// ===================== TURKISH SYSTEM INSTRUCTIONS =====================
const SYSTEM_INSTRUCTION_TR = `Sen "Xolver" adl\u0131 bir soru \u00e7\u00f6zme asistan\u0131s\u0131n. Kullan\u0131c\u0131 sana web sayfalar\u0131ndan se\u00e7ti\u011fi HTML elementlerini g\u00f6nderecek. Bu elementler genellikle soru, test sorusu veya problem i\u00e7erir.

G\u00f6revin:
1. HTML i\u00e7eri\u011fini analiz et ve soruyu/problemi tespit et
2. Soruyu net ve do\u011fru bir \u015fekilde yan\u0131tla
3. E\u011fer test sorusuysa, do\u011fru \u015f\u0131kk\u0131 belirt ve nedenini a\u00e7\u0131kla
4. E\u011fer a\u00e7\u0131k u\u00e7lu bir soruysa, kapsaml\u0131 bir cevap ver
5. Matematiksel i\u015flemler gerekiyorsa ad\u0131m ad\u0131m \u00e7\u00f6z
6. Yan\u0131tlar\u0131n\u0131 T\u00fcrk\u00e7e ver

Markdown format\u0131nda yan\u0131tla.`;

const SYSTEM_INSTRUCTION_SHORT_TR = `Sen "Xolver" adl\u0131 bir soru \u00e7\u00f6zme asistan\u0131s\u0131n. Kullan\u0131c\u0131 sana web sayfalar\u0131ndan se\u00e7ti\u011fi HTML elementlerini g\u00f6nderecek.

KURALLAR:
- SADECE cevab\u0131 ver, a\u00e7\u0131klama yapma.
- Test sorusuysa sadece do\u011fru \u015f\u0131kk\u0131 yaz (\u00f6rn: "B").
- A\u00e7\u0131k u\u00e7lu soruysa en k\u0131sa \u015fekilde cevapla.
- Matematiksel sorularda sadece sonucu yaz.
- Gereksiz s\u00f6z yazma, do\u011frudan cevap ver.
- T\u00fcrk\u00e7e yan\u0131tla.`;

const SYSTEM_INSTRUCTION_AUTOSOLVE_TR = `Sen bir soru \u00e7\u00f6zme botusun. Sana HTML format\u0131nda bir soru g\u00f6nderilecek.

MUTLAK KURALLAR:
- SADECE do\u011fru \u015f\u0131kk\u0131n harfini yaz. \u00d6rnek: A veya B veya C veya D
- Ba\u015fka H\u0130\u00c7B\u0130R \u015eEY yazma. A\u00e7\u0131klama yapma, nokta koyma, c\u00fcmle yazma.
- Sadece tek bir b\u00fcy\u00fck harf yaz.
- E\u011fer a\u00e7\u0131k u\u00e7lu bir soruysa en k\u0131sa cevab\u0131 yaz.`;

// ===================== BACKGROUND STRINGS =====================
const BG_STRINGS = {
  en: {
    noApiKey:          '\u274c Please enter your Gemini API key in Settings first.',
    noApiKeyAutosolve: '\u274c API key not found!',
    analyzing:         '\ud83d\udccc Analyzing...',
    addMsg:            "User's additional message: ",
    noResponse:        'No response received.',
    apiError:          (msg)          => `\u274c Error: ${msg}`,
    connectionError:   (msg)          => `\u274c Connection error: ${msg}`,
    autoSolveBanner:   '\u26a1 Auto Solve',
    autoSolveCancelled:'\u26d4 Auto solve cancelled',
    noQuestionsFound:  '\u274c No questions found on page',
    autoSolveComplete: (s, f)         => f > 0
      ? `\u26a1 Auto solve complete<br>\u2705 ${s} solved, \u274c ${f} failed`
      : `\u2705 Auto solve complete \u2014 ${s} question(s) solved`,
    quotaWait:         (idx, secs)    => `\u23f3 Question ${idx}: Quota exceeded, waiting ${secs}s...`,
    quotaError:        (idx)          => `\u274c Question ${idx}: Quota error \u2014 could not solve`,
    questionError:     (idx, msg)     => `\u274c Question ${idx}: ${msg}`,
    questionAnswer:    (idx, ans)     => `\u26a1 Question ${idx}: **${ans}**`,
    questionConnError: (idx, msg)     => `\u274c Question ${idx}: Connection error \u2014 ${msg}`,
    htmlPrompt:        (html)         => `The following HTML element was selected from a web page. It may contain a question or quiz question. Please analyze the content and answer the question. Give the answer directly.\n\n\`\`\`html\n${html}\n\`\`\``,
    autoSolvePrompt:   (html)         => `This HTML contains an exam/quiz question. State the letter of the correct answer:\n\n\`\`\`html\n${html}\n\`\`\``,
  },
  tr: {
    noApiKey:          "\u274c L\u00fctfen \u00f6nce Ayarlar'dan Gemini API anahtar\u0131n\u0131z\u0131 girin.",
    noApiKeyAutosolve: '\u274c API anahtar\u0131 bulunamad\u0131!',
    analyzing:         '\ud83d\udccc Analiz ediliyor...',
    addMsg:            'Kullan\u0131c\u0131n\u0131n ek mesaj\u0131: ',
    noResponse:        'Yan\u0131t al\u0131namad\u0131.',
    apiError:          (msg)          => `\u274c Hata: ${msg}`,
    connectionError:   (msg)          => `\u274c Ba\u011flant\u0131 hatas\u0131: ${msg}`,
    autoSolveBanner:   '\u26a1 Otomatik \u00c7\u00f6z\u00fcm',
    autoSolveCancelled:'\u26d4 Otomatik \u00e7\u00f6z\u00fcm iptal edildi',
    noQuestionsFound:  '\u274c Sayfada soru bulunamad\u0131',
    autoSolveComplete: (s, f)         => f > 0
      ? `\u26a1 Otomatik \u00e7\u00f6z\u00fcm tamamland\u0131<br>\u2705 ${s} \u00e7\u00f6z\u00fcld\u00fc, \u274c ${f} ba\u015far\u0131s\u0131z`
      : `\u2705 Otomatik \u00e7\u00f6z\u00fcm tamamland\u0131 \u2014 ${s} soru \u00e7\u00f6z\u00fcld\u00fc`,
    quotaWait:         (idx, secs)    => `\u23f3 Soru ${idx}: Kota a\u015f\u0131ld\u0131, ${secs}sn bekleniyor...`,
    quotaError:        (idx)          => `\u274c Soru ${idx}: Kota hatas\u0131 \u2014 \u00e7\u00f6z\u00fclemedi`,
    questionError:     (idx, msg)     => `\u274c Soru ${idx}: ${msg}`,
    questionAnswer:    (idx, ans)     => `\u26a1 Soru ${idx}: **${ans}**`,
    questionConnError: (idx, msg)     => `\u274c Soru ${idx}: Ba\u011flant\u0131 hatas\u0131 \u2014 ${msg}`,
    htmlPrompt:        (html)         => `A\u015fa\u011f\u0131daki HTML elementi bir web sayfas\u0131ndan se\u00e7ildi. Bu bir soru veya test sorusu olabilir. L\u00fctfen i\u00e7eri\u011fi analiz et ve soruyu yan\u0131tla. Cevab\u0131 do\u011frudan ver.\n\n\`\`\`html\n${html}\n\`\`\``,
    autoSolvePrompt:   (html)         => `Bu HTML bir s\u0131nav/test sorusudur. Do\u011fru cevab\u0131n \u015f\u0131kk\u0131n\u0131 (harfini) s\u00f6yle:\n\n\`\`\`html\n${html}\n\`\`\``,
  }
};

function bgt(lang, key, ...args) {
  const dict = BG_STRINGS[lang] || BG_STRINGS.en;
  const str  = dict[key] != null ? dict[key] : BG_STRINGS.en[key];
  return typeof str === 'function' ? str(...args) : str;
}

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
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'xolverShortAnswer', 'xolverLanguage']);
  const apiKey = data.geminiApiKey;
  const model  = data.geminiModel || 'gemini-2.5-flash';
  const lang   = data.xolverLanguage || 'en';

  if (!apiKey) {
    const msgs = await getChatMessages();
    msgs.push({ role: 'system', text: bgt(lang, 'noApiKey') });
    await saveChatMessages(msgs);
    chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    return;
  }

  // Build user message for API
  let apiMsg = '';
  if (html) {
    apiMsg += bgt(lang, 'htmlPrompt', html);
  }
  if (userText) {
    apiMsg += (html ? '\n\n' + bgt(lang, 'addMsg') : '') + userText;
  }

  // Build display message for UI
  const displayMsg = html
    ? bgt(lang, 'analyzing') + (userText ? '\n' + userText : '')
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

  // Choose system instruction based on language and short-answer mode
  const sysInstruction = data.xolverShortAnswer
    ? (lang === 'tr' ? SYSTEM_INSTRUCTION_SHORT_TR : SYSTEM_INSTRUCTION_SHORT)
    : (lang === 'tr' ? SYSTEM_INSTRUCTION_TR       : SYSTEM_INSTRUCTION);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sysInstruction }] },
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
      msgs.push({ role: 'ai', text: bgt(lang, 'apiError', errMsg) });
      await saveChatMessages(msgs);

      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
      return;
    }

    const result = await response.json();
    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || bgt(lang, 'noResponse');

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
    msgs.push({ role: 'ai', text: bgt(lang, 'connectionError', err.message) });
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

// ===================== KEYBOARD SHORTCUT =====================
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'start-selector') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['src/content.js'] });
    } catch (e) {}

    // Toggle: if already selecting, stop
    const state = await chrome.storage.local.get('xolverSelectorActive');
    if (state.xolverSelectorActive) {
      chrome.tabs.sendMessage(tab.id, { action: 'stopSelector' }).catch(() => {});
      chrome.storage.local.remove('xolverSelectorActive');
    } else {
      chrome.tabs.sendMessage(tab.id, { action: 'startSelector' }).catch(() => {});
      chrome.storage.local.set({ xolverSelectorActive: { tabId: tab.id } });
    }
  }
});

// ===================== MESSAGE HANDLER =====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'elementSelected') {
    // Element selected from content script — call Gemini in background
    callGemini(msg.html, '');
    // Store last selected HTML/tag for preview and clear selector state
    chrome.storage.local.set({
      xolverLastSelected: { html: msg.html, tagInfo: msg.tagInfo }
    });
    chrome.storage.local.remove('xolverSelectorActive');
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
    // Add "Auto Solve" banner to chat (don't set loading:true here to avoid race with noQuestions)
    autoSolveActive = false;  // Reset for new auto-solve session
    (async () => {
      const langData = await chrome.storage.local.get('xolverLanguage');
      const lang = langData.xolverLanguage || 'en';
      const msgs = await getChatMessages();
      msgs.push({ role: 'autosolve-banner', text: bgt(lang, 'autoSolveBanner') });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    })();
  }

  if (msg.action === 'autoSolveAllQuestions') {
    // Ignore duplicate messages from multiple frames
    if (autoSolveActive) {
      console.log('[Xolver BG] Ignoring duplicate autoSolveAllQuestions — already processing');
      return;
    }
    // Receive all questions at once, process sequentially
    autoSolveCancelled = false;
    autoSolveActive = true;
    const tabId = msg.tabId || sender.tab?.id;
    console.log('[Xolver BG] autoSolveAllQuestions received,', msg.questions.length, 'questions, tabId:', tabId);
    processAutoSolveQueue(msg.questions, msg.totalQuestions, tabId);
  }

  if (msg.action === 'getAutoSolveState') {
    sendResponse({ active: autoSolveActive });
    return true;
  }

  if (msg.action === 'autoSolveCancel') {
    console.log('[Xolver BG] Auto-solve cancelled by user');
    autoSolveCancelled = true;
    (async () => {
      const langData = await chrome.storage.local.get('xolverLanguage');
      const lang = langData.xolverLanguage || 'en';
      const msgs = await getChatMessages();
      msgs.push({ role: 'autosolve-banner', text: bgt(lang, 'autoSolveCancelled') });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    })();
  }

  if (msg.action === 'autoSolveNoQuestions') {
    // Ignore if another frame already found questions
    if (autoSolveActive) {
      console.log('[Xolver BG] Ignoring autoSolveNoQuestions — questions already found from another frame');
      return;
    }
    (async () => {
      const langData = await chrome.storage.local.get('xolverLanguage');
      const lang = langData.xolverLanguage || 'en';
      const msgs = await getChatMessages();
      msgs.push({ role: 'autosolve-banner', text: bgt(lang, 'noQuestionsFound') });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
    })();
  }
});

// ===================== AUTO-SOLVE SEQUENTIAL QUEUE =====================
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT = 20000;
let autoSolveCancelled = false;
let autoSolveActive = false;  // true when questions were found and processing started

async function processAutoSolveQueue(questions, totalQuestions, tabId) {
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'xolverLanguage']);
  const apiKey = data.geminiApiKey;
  const model  = data.geminiModel || 'gemini-2.5-flash';
  const lang   = data.xolverLanguage || 'en';

  if (!apiKey) {
    console.log('[Xolver BG] No API key!');
    const msgs = await getChatMessages();
    msgs.push({ role: 'system', text: bgt(lang, 'noApiKeyAutosolve') });
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

    const success = await solveOneQuestion(q.html, q.questionIndex, tabId, apiKey, model, lang);
    if (success) {
      solvedCount++;
    } else {
      failedCount++;
    }

    // Pace requests based on free API mode setting
    if (i < questions.length - 1) {
      const settings = await chrome.storage.local.get('xolverFreeApi');
      const isFreeApi = !!settings.xolverFreeApi; // default false
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
  autoSolveActive = false;
  console.log('[Xolver BG] Auto-solve complete:', solvedCount, 'solved,', failedCount, 'failed');

  // Add completion summary to chat
  const finalMsgs = await getChatMessages();
  finalMsgs.push({ role: 'autosolve-banner', text: bgt(lang, 'autoSolveComplete', solvedCount, failedCount) });
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

async function solveOneQuestion(html, questionIndex, tabId, apiKey, model, lang = 'en') {
  const apiMsg = bgt(lang, 'autoSolvePrompt', html);
  const sysInstruction = lang === 'tr' ? SYSTEM_INSTRUCTION_AUTOSOLVE_TR : SYSTEM_INSTRUCTION_AUTOSOLVE;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check cancellation before each attempt
    if (autoSolveCancelled) return false;

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
            system_instruction: { parts: [{ text: sysInstruction }] },
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

        if (attempt < MAX_RETRIES) {
          // Extract retry delay, cap at MAX_RETRY_WAIT
          let waitTime = MAX_RETRY_WAIT;
          const retryMatch = errBody.match(/retry in ([\d.]+)s/i);
          if (retryMatch) {
            waitTime = Math.min(Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000, MAX_RETRY_WAIT);
          }

          const msgs = await getChatMessages();
          msgs.push({ role: 'system', text: bgt(lang, 'quotaWait', questionIndex + 1, Math.ceil(waitTime / 1000)) });
          await saveChatMessages(msgs);
          chrome.runtime.sendMessage({ action: 'chatUpdated', loading: true }).catch(() => {});

          // Wait in 1s chunks so cancellation is responsive
          const retryChunks = Math.ceil(waitTime / 1000);
          for (let rc = 0; rc < retryChunks; rc++) {
            if (autoSolveCancelled) return false;
            await new Promise(r => setTimeout(r, 1000));
          }
          continue;
        } else {
          const msgs = await getChatMessages();
          msgs.push({ role: 'ai', text: bgt(lang, 'quotaError', questionIndex + 1) });
          await saveChatMessages(msgs);
          chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
          return false;
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
        msgs.push({ role: 'ai', text: bgt(lang, 'questionError', questionIndex + 1, errMsg) });
        await saveChatMessages(msgs);
        chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
        return false;
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
      msgs.push({ role: 'ai', text: bgt(lang, 'questionAnswer', questionIndex + 1, answer.trim()) });
      await saveChatMessages(msgs);
      chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
      return true;

    } catch (err) {
      console.error('[Xolver BG] Fetch error for question', questionIndex + 1, ':', err);

      if (attempt >= MAX_RETRIES) {
        const msgs = await getChatMessages();
        msgs.push({ role: 'ai', text: bgt(lang, 'questionConnError', questionIndex + 1, err.message) });
        await saveChatMessages(msgs);
        chrome.runtime.sendMessage({ action: 'chatUpdated', loading: false }).catch(() => {});
        return false;
      }

      // Wait before retry on network error
      for (let rc = 0; rc < 3; rc++) {
        if (autoSolveCancelled) return false;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  return false;
}

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Xolver extension installed');
});
