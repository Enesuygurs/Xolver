// ===================== STATE =====================
let selectedHTML = '';
let isLoading = false;

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
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'xolverLastSelected']);
  if (data.geminiApiKey) {
    apiKeyInput.value = data.geminiApiKey;
  }
  if (data.geminiModel) {
    modelSelect.value = data.geminiModel;
  }

  // Restore last selected element preview
  if (data.xolverLastSelected) {
    const sel = data.xolverLastSelected;
    selectedHTML = sel.html;
    selectedPreview.classList.remove('hidden');
    previewTag.textContent = `<${sel.tagInfo || 'element'}>`;
    const maxPreview = 500;
    previewCode.textContent = sel.html.length > maxPreview
      ? sel.html.substring(0, maxPreview) + '...'
      : sel.html;
  }

  // Load and render existing chat messages from storage
  await renderChatFromStorage();
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

  // Start selector and close popup — background will handle the rest
  chrome.tabs.sendMessage(tab.id, { action: 'startSelector' });
  window.close();
});

clearSelectionBtn.addEventListener('click', () => {
  selectedHTML = '';
  selectedPreview.classList.add('hidden');
  chrome.storage.local.set({ xolverLastSelected: null });
});

// ===================== CHAT =====================
sendBtn.addEventListener('click', () => {
  const text = userInput.value.trim();
  if (!text && !selectedHTML) return;

  // Send to background for Gemini processing
  chrome.runtime.sendMessage({
    action: 'sendMessage',
    html: selectedHTML,
    text: text
  });

  userInput.value = '';
  autoResizeTextarea();

  // Show loading immediately
  isLoading = true;
  renderChatFromStorage();
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

// ===================== LISTEN FOR UPDATES FROM BACKGROUND =====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'chatUpdated') {
    isLoading = msg.loading;
    renderChatFromStorage();

    // Also refresh preview if there's a new selection
    if (!isLoading) {
      chrome.storage.local.get('xolverLastSelected', (data) => {
        if (data.xolverLastSelected) {
          const sel = data.xolverLastSelected;
          selectedHTML = sel.html;
          selectedPreview.classList.remove('hidden');
          previewTag.textContent = `<${sel.tagInfo || 'element'}>`;
          const maxPreview = 500;
          previewCode.textContent = sel.html.length > maxPreview
            ? sel.html.substring(0, maxPreview) + '...'
            : sel.html;
        }
      });
    }
  }
});

// ===================== RENDER CHAT FROM STORAGE =====================
async function renderChatFromStorage() {
  const data = await chrome.storage.local.get('xolverChatMessages');
  const messages = data.xolverChatMessages || [];

  // Clear chat area
  chatMessages.innerHTML = '';

  if (messages.length === 0 && !isLoading) {
    // Show welcome
    chatMessages.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">🎯</div>
        <p>Sayfadan bir element seçin, Xolver otomatik olarak soruyu çözecek!</p>
      </div>`;
    return;
  }

  // Render all messages
  messages.forEach(msg => {
    if (msg.role === 'system') {
      addMessageEl('system', msg.text);
    } else {
      addMessageEl(msg.role, msg.text);
    }
  });

  // Show loading indicator if waiting for response
  if (isLoading) {
    const div = document.createElement('div');
    div.classList.add('msg', 'msg-ai');
    div.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(div);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===================== UI HELPERS =====================
function addMessageEl(role, text) {
  const div = document.createElement('div');

  if (role === 'system') {
    div.classList.add('msg', 'msg-system');
    div.textContent = text;
  } else if (role === 'user') {
    div.classList.add('msg', 'msg-user');
    div.textContent = text;
  } else {
    div.classList.add('msg', 'msg-ai');
    div.innerHTML = renderMarkdown(text);
  }

  chatMessages.appendChild(div);
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
