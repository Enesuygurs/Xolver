// ===================== STATE =====================
let selectedHTML = '';
let chatHistory = [];
let isSelecting = false;

// ===================== DOM =====================
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const modelSelect = document.getElementById('modelSelect');
const selectElementBtn = document.getElementById('selectElementBtn');
const selectedPreview = document.getElementById('selectedPreview');
const previewTag = document.getElementById('previewTag');
const previewCode = document.getElementById('previewCode');
const clearSelectionBtn = document.getElementById('clearSelection');
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved API key & model
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
  if (data.geminiApiKey) {
    apiKeyInput.value = data.geminiApiKey;
  }
  if (data.geminiModel) {
    modelSelect.value = data.geminiModel;
  }
});

// ===================== SETTINGS =====================
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

saveApiKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  await chrome.storage.local.set({ geminiApiKey: key });
  showSystemMsg('API anahtarı kaydedildi ✓');
  settingsPanel.classList.add('hidden');
});

modelSelect.addEventListener('change', async () => {
  await chrome.storage.local.set({ geminiModel: modelSelect.value });
});

// ===================== ELEMENT SELECTOR =====================
selectElementBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (isSelecting) {
    // Cancel selection
    isSelecting = false;
    selectElementBtn.classList.remove('active');
    selectElementBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        <path d="M13 13l6 6"/>
      </svg>
      Element Seç`;
    chrome.tabs.sendMessage(tab.id, { action: 'stopSelector' }).catch(() => {});
    return;
  }

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    });
  } catch (e) {
    // Already injected or error
  }

  isSelecting = true;
  selectElementBtn.classList.add('active');
  selectElementBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
    </svg>
    Seçimi İptal Et`;

  chrome.tabs.sendMessage(tab.id, { action: 'startSelector' });
});

// Listen for selected element from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'elementSelected') {
    isSelecting = false;
    selectElementBtn.classList.remove('active');
    selectElementBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        <path d="M13 13l6 6"/>
      </svg>
      Element Seç`;

    selectedHTML = msg.html;
    const tagInfo = msg.tagInfo || 'element';

    // Show preview
    selectedPreview.classList.remove('hidden');
    previewTag.textContent = `<${tagInfo}>`;

    // Truncate for preview
    const maxPreview = 500;
    previewCode.textContent = selectedHTML.length > maxPreview
      ? selectedHTML.substring(0, maxPreview) + '...'
      : selectedHTML;

    // Auto-send to Gemini
    sendToGemini(selectedHTML, '');
  }
});

clearSelectionBtn.addEventListener('click', () => {
  selectedHTML = '';
  selectedPreview.classList.add('hidden');
});

// ===================== CHAT =====================
sendBtn.addEventListener('click', () => {
  const text = userInput.value.trim();
  if (!text && !selectedHTML) return;
  sendToGemini(selectedHTML, text);
  userInput.value = '';
  autoResizeTextarea();
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

userInput.addEventListener('input', autoResizeTextarea);

function autoResizeTextarea() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 80) + 'px';
}

async function sendToGemini(html, userText) {
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
  const apiKey = data.geminiApiKey;
  const model = data.geminiModel || 'gemini-2.5-flash';

  if (!apiKey) {
    showSystemMsg('⚠ Lütfen önce Ayarlar\'dan Gemini API anahtarınızı girin.');
    settingsPanel.classList.remove('hidden');
    return;
  }

  // Build user message
  let userMsg = '';
  if (html) {
    userMsg += `Aşağıdaki HTML elementi bir web sayfasından seçildi. Bu bir soru veya test sorusu olabilir. Lütfen içeriği analiz et ve soruyu yanıtla. Cevabı doğrudan ver, açıklama ekle.\n\n\`\`\`html\n${html}\n\`\`\``;
  }
  if (userText) {
    userMsg += (html ? '\n\nKullanıcının ek mesajı: ' : '') + userText;
  }

  // Remove welcome
  const welcome = chatMessages.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  // Add user message to chat
  addMessage('user', html ? '📌 Element seçildi — analiz ediliyor...' + (userText ? '\n' + userText : '') : userText);

  // Add loading
  const loadingEl = addLoading();

  // Build API request
  chatHistory.push({ role: 'user', parts: [{ text: userMsg }] });

  const systemInstruction = `Sen "Xolver" adlı bir soru çözme asistanısın. Kullanıcı sana web sayfalarından seçtiği HTML elementlerini gönderecek. Bu elementler genellikle soru, test sorusu veya problem içerir.

Görevin:
1. HTML içeriğini analiz et ve soruyu/problemi tespit et
2. Soruyu net ve doğru bir şekilde yanıtla
3. Eğer test sorusuysa, doğru şıkkı belirt ve nedenini açıkla
4. Eğer açık uçlu bir soruysa, kapsamlı bir cevap ver
5. Matematiksel işlemler gerekiyorsa adım adım çöz
6. Yanıtlarını Türkçe ver

Markdown formatında yanıtla.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: chatHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          }
        })
      }
    );

    loadingEl.remove();

    if (!response.ok) {
      const err = await response.json();
      const errMsg = err.error?.message || `HTTP ${response.status}`;
      addMessage('ai', `❌ Hata: ${errMsg}`);
      chatHistory.pop(); // Remove failed message
      return;
    }

    const result = await response.json();
    const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Yanıt alınamadı.';

    chatHistory.push({ role: 'model', parts: [{ text: aiText }] });
    addMessage('ai', aiText);

  } catch (err) {
    loadingEl.remove();
    addMessage('ai', `❌ Bağlantı hatası: ${err.message}`);
    chatHistory.pop();
  }
}

// ===================== UI HELPERS =====================
function addMessage(role, text) {
  const div = document.createElement('div');
  div.classList.add('msg', role === 'user' ? 'msg-user' : 'msg-ai');

  if (role === 'ai') {
    div.innerHTML = renderMarkdown(text);
  } else {
    div.textContent = text;
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function addLoading() {
  const div = document.createElement('div');
  div.classList.add('msg', 'msg-ai');
  div.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function showSystemMsg(text) {
  const welcome = chatMessages.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.classList.add('msg', 'msg-system');
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  setTimeout(() => div.remove(), 3000);
}

// ===================== MARKDOWN RENDERER (lightweight) =====================
function renderMarkdown(text) {
  let html = text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<strong style="font-size:14px;">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:15px;">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="font-size:16px;">$1</strong>')
    // Unordered list
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered list
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap in paragraphs
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}
