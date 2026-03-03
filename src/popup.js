// ===================== I18N =====================
const STRINGS = {
  en: {
    // Tooltips
    clearChatTitle: 'Clear chat',
    pinWindowTitle: 'Pin window',
    homeTitle: 'Home',
    siteSettingsTitle: 'Site Settings',
    settingsTitle: 'Settings',
    selectElementTitle: 'Select Element (Alt+S)',
    clearSelectionTitle: 'Clear',
    sendTitle: 'Send',
    // Placeholders
    apiKeyPlaceholder: 'Enter your API key...',
    inputPlaceholder: 'Type a message...',
    questionSelectorPlaceholder: 'Question container — e.g., .mcq__inner',
    optionSelectorPlaceholder: 'Answer option — e.g., .mcq__item',
    optionInputPlaceholder: 'Answer input — e.g., input.mcq__item-input',
    // Buttons
    saveBtn: 'Save',
    deleteBtn: 'Delete',
    // Labels & hints
    languageLabel: 'Language',
    preferencesLabel: 'Preferences',
    shortAnswerLabel: 'Short Answer Mode',
    shortAnswerHint: 'Returns only the correct answer without explanation',
    freeApiLabel: 'Free API Mode',
    freeApiHint: 'Adds delays between requests to avoid quota errors',
    siteSettingsLabel: 'Site Settings',
    siteConfigHint: 'Define custom CSS selectors for the current site. If left empty, default Moodle selectors will be used.',
    apiHintHTML: 'You can get an API key from <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>.',
    // Dynamic button labels
    welcomeText: 'Xolver is ready to solve!',
    selectElement: 'Select Element',
    clickToCancel: 'Click to cancel...',
    autoSolve: 'Auto Solve',
    cancel: 'Cancel',
    // Status messages
    apiKeySaved: 'API key saved \u2713',
    siteDomainError: 'Site domain could not be detected',
    questionSelectorRequired: 'Question container selector is required',
    settingsSaved: (domain) => `${domain} settings saved \u2713`,
    settingsDeleted: (domain) => `${domain} settings deleted`,
  },
  tr: {
    // Tooltips
    clearChatTitle: 'Sohbeti temizle',
    pinWindowTitle: 'Sabit pencerede a\u00e7',
    homeTitle: 'Ana Sayfa',
    siteSettingsTitle: 'Site Ayarlar\u0131',
    settingsTitle: 'Ayarlar',
    selectElementTitle: 'Element Se\u00e7 (Alt+S)',
    clearSelectionTitle: 'Temizle',
    sendTitle: 'G\u00f6nder',
    // Placeholders
    apiKeyPlaceholder: 'API anahtar\u0131n\u0131z\u0131 girin...',
    inputPlaceholder: 'Mesaj Yaz\u0131n...',
    questionSelectorPlaceholder: 'Soru konteyneri \u2014 \u00f6rn: .mcq__inner',
    optionSelectorPlaceholder: 'Cevap se\u00e7ene\u011fi \u2014 \u00f6rn: .mcq__item',
    optionInputPlaceholder: 'Cevap input \u2014 \u00f6rn: input.mcq__item-input',
    // Buttons
    saveBtn: 'Kaydet',
    deleteBtn: 'Sil',
    // Labels & hints
    languageLabel: 'Dil',
    preferencesLabel: 'Tercihler',
    shortAnswerLabel: 'K\u0131sa Yan\u0131t Modu',
    shortAnswerHint: 'A\u00e7\u0131klama yapmadan yaln\u0131zca do\u011fru cevab\u0131 d\u00f6nd\u00fcr\u00fcr',
    freeApiLabel: '\u00dccretsiz API Modu',
    freeApiHint: 'Kota a\u015f\u0131m\u0131n\u0131 \u00f6nlemek i\u00e7in istekler aras\u0131 bekleme ekler',
    siteSettingsLabel: 'Site Ayarlar\u0131',
    siteConfigHint: 'Mevcut site i\u00e7in \u00f6zel CSS se\u00e7icileri tan\u0131mlay\u0131n. Bo\u015f b\u0131rak\u0131l\u0131rsa varsay\u0131lan Moodle se\u00e7icileri kullan\u0131l\u0131r.',
    apiHintHTML: '<a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>\'dan API anahtar\u0131 alabilirsiniz.',
    // Dynamic button labels
    welcomeText: 'Xolver \u00e7\u00f6zmeye haz\u0131r!',
    selectElement: 'Element Se\u00e7',
    clickToCancel: '\u0130ptal etmek i\u00e7in t\u0131klay\u0131n...',
    autoSolve: 'Otomatik \u00c7\u00f6z',
    cancel: '\u0130ptal Et',
    // Status messages
    apiKeySaved: 'API anahtar\u0131 kaydedildi \u2713',
    siteDomainError: 'Site alan\u0131 tespit edilemedi',
    questionSelectorRequired: 'Soru konteyneri se\u00e7icisi gerekli',
    settingsSaved: (domain) => `${domain} ayarlar\u0131 kaydedildi \u2713`,
    settingsDeleted: (domain) => `${domain} ayarlar\u0131 silindi`,
  }
};

let currentLang = 'en';

function t(key, ...args) {
  const str = (STRINGS[currentLang] || STRINGS.en)[key];
  return typeof str === 'function' ? str(...args) : (str != null ? str : (STRINGS.en[key] != null ? STRINGS.en[key] : key));
}

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

// ===================== BUTTON HTML HELPERS =====================
const SVG_CURSOR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`;
const SVG_CANCEL = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`;
const SVG_BOLT   = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;

// ===================== APPLY LANGUAGE =====================
function applyLanguage(lang) {
  currentLang = lang;

  // Tooltips
  document.getElementById('clearChatBtn').title     = t('clearChatTitle');
  document.getElementById('pinBtn').title           = t('pinWindowTitle');
  document.getElementById('homeBtn').title          = t('homeTitle');
  document.getElementById('siteConfigBtn').title    = t('siteSettingsTitle');
  document.getElementById('settingsBtn').title      = t('settingsTitle');
  document.getElementById('selectElementBtn').title = t('selectElementTitle');
  document.getElementById('clearSelection').title   = t('clearSelectionTitle');
  document.getElementById('sendBtn').title          = t('sendTitle');

  // Placeholders
  document.getElementById('apiKeyInput').placeholder         = t('apiKeyPlaceholder');
  document.getElementById('userInput').placeholder           = t('inputPlaceholder');
  document.getElementById('questionSelector').placeholder    = t('questionSelectorPlaceholder');
  document.getElementById('optionSelector').placeholder      = t('optionSelectorPlaceholder');
  document.getElementById('optionInputSelector').placeholder = t('optionInputPlaceholder');

  // Button text
  document.getElementById('saveApiKey').textContent     = t('saveBtn');
  document.getElementById('saveSiteConfig').textContent = t('saveBtn');
  document.getElementById('deleteSiteConfig').textContent = t('deleteBtn');

  // Labels & hints
  document.getElementById('languageLabel').textContent    = t('languageLabel');
  document.getElementById('preferencesLabel').textContent = t('preferencesLabel');
  document.getElementById('shortAnswerLabel').textContent = t('shortAnswerLabel');
  document.getElementById('shortAnswerHint').textContent  = t('shortAnswerHint');
  document.getElementById('freeApiLabel').textContent     = t('freeApiLabel');
  document.getElementById('freeApiHint').textContent      = t('freeApiHint');
  document.getElementById('siteSettingsLabel').textContent = t('siteSettingsLabel');
  document.getElementById('siteConfigHint').textContent   = t('siteConfigHint');
  document.getElementById('apiHint').innerHTML            = t('apiHintHTML');

  // Action buttons (only update if not in active state)
  if (!isSelectingMode) {
    selectElementBtn.innerHTML = `${SVG_CURSOR} ${t('selectElement')}`;
  }
  if (!isAutoSolving) {
    autoSolveBtn.innerHTML = `${SVG_BOLT} ${t('autoSolve')}`;
  }

  // Welcome message (if visible)
  const welcomeP = document.querySelector('#chatMessages .welcome-message p');
  if (welcomeP) welcomeP.textContent = t('welcomeText');
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved API key & model
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'xolverShortAnswer', 'xolverFreeApi', 'xolverLastSelected', 'xolverLanguage']);
  if (data.geminiApiKey) {
    apiKeyInput.value = data.geminiApiKey;
  }
  if (data.geminiModel) {
    modelSelect.value = data.geminiModel;
  }
  document.getElementById('shortAnswerToggle').checked = !!data.xolverShortAnswer;
  // Free API mode defaults to true if not set
  document.getElementById('freeApiToggle').checked = data.xolverFreeApi !== false;

  // Apply saved language (defaults to English)
  currentLang = data.xolverLanguage || 'en';
  document.getElementById('languageSelect').value = currentLang;
  applyLanguage(currentLang);

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

  // Restore selector state (persists across popup close/reopen)
  const selectorState = await chrome.storage.local.get('xolverSelectorActive');
  if (selectorState.xolverSelectorActive) {
    isSelectingMode = true;
    lastSelectorTabId = selectorState.xolverSelectorActive.tabId;
    selectElementBtn.classList.add('active');
    selectElementBtn.innerHTML = `${SVG_CANCEL} ${t('clickToCancel')}`;
  }

  // Restore auto-solve button state
  try {
    const solveState = await chrome.runtime.sendMessage({ action: 'getAutoSolveState' });
    if (solveState && solveState.active) {
      isAutoSolving = true;
      isLoading = true;
      autoSolveBtn.classList.add('active');
      autoSolveBtn.innerHTML = `${SVG_CANCEL} ${t('cancel')}`;
    }
  } catch (e) {}

  // Load and render existing chat messages from storage
  await renderChatFromStorage();
});

// ===================== DETACHED MODE =====================
// Detect if running as a standalone window (not popup)
const isDetached = new URLSearchParams(window.location.search).has('detached');

document.getElementById('pinBtn').addEventListener('click', async () => {
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('src/popup.html?detached=1'),
    type: 'popup',
    width: 420,
    height: 600,
    focused: true
  });
  // Store window ID so background can refocus it
  await chrome.storage.local.set({ xolverWindowId: win.id });
  window.close();
});

// Hide pin button if already detached
if (isDetached) {
  document.getElementById('pinBtn').style.display = 'none';
} else {
  // In popup mode, use fixed dimensions
  document.body.classList.add('popup-mode');
}

// ===================== SETTINGS =====================
const mainArea = document.querySelector('.main-area');

const homeBtn = document.getElementById('homeBtn');
const siteConfigBtn = document.getElementById('siteConfigBtn');
const siteConfigPanel = document.getElementById('siteConfigPanel');
const tabBtns = document.querySelectorAll('.tab-btn');

function setActiveTab(activeBtn) {
  tabBtns.forEach(btn => btn.classList.remove('active'));
  activeBtn.classList.add('active');
}

function closeAllPanels() {
  settingsPanel.classList.add('hidden');
  siteConfigPanel.classList.add('hidden');
  mainArea.classList.remove('hidden');
}

homeBtn.addEventListener('click', () => {
  closeAllPanels();
  setActiveTab(homeBtn);
});

settingsBtn.addEventListener('click', () => {
  const wasHidden = settingsPanel.classList.contains('hidden');
  closeAllPanels();
  if (wasHidden) {
    settingsPanel.classList.remove('hidden');
    mainArea.classList.add('hidden');
    setActiveTab(settingsBtn);
  } else {
    setActiveTab(homeBtn);
  }
});

siteConfigBtn.addEventListener('click', () => {
  const wasHidden = siteConfigPanel.classList.contains('hidden');
  closeAllPanels();
  if (wasHidden) {
    siteConfigPanel.classList.remove('hidden');
    mainArea.classList.add('hidden');
    loadCurrentSiteConfig();
    setActiveTab(siteConfigBtn);
  } else {
    setActiveTab(homeBtn);
  }
});

saveApiKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  await chrome.storage.local.set({ geminiApiKey: key });
  showSystemMsg(t('apiKeySaved'));
  closeAllPanels();
  setActiveTab(homeBtn);
});

modelSelect.addEventListener('change', async () => {
  await chrome.storage.local.set({ geminiModel: modelSelect.value });
});

document.getElementById('shortAnswerToggle').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ xolverShortAnswer: e.target.checked });
});

document.getElementById('freeApiToggle').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ xolverFreeApi: e.target.checked });
});

document.getElementById('languageSelect').addEventListener('change', async (e) => {
  const lang = e.target.value;
  await chrome.storage.local.set({ xolverLanguage: lang });
  applyLanguage(lang);
});

// ===================== SITE CONFIG =====================
let currentDomainName = null;

async function getCurrentTab() {
  if (isDetached) {
    const allTabs = await chrome.tabs.query({ active: true });
    let tab = allTabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
    if (!tab) tab = allTabs.find(t => t.url && t.url.startsWith('http'));
    return tab;
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }
}

async function loadCurrentSiteConfig() {
  const tab = await getCurrentTab();
  const domainEl = document.getElementById('currentDomain');

  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      currentDomainName = url.hostname;
      domainEl.textContent = currentDomainName;
    } catch(e) {
      currentDomainName = null;
      domainEl.textContent = '\u2014';
    }
  } else {
    currentDomainName = null;
    domainEl.textContent = '\u2014';
  }

  // Load stored config for this domain
  if (currentDomainName) {
    const data = await chrome.storage.local.get('xolverSiteConfigs');
    const configs = data.xolverSiteConfigs || {};
    const config = configs[currentDomainName] || {};
    document.getElementById('questionSelector').value = config.questionSelector || '';
    document.getElementById('optionSelector').value = config.optionSelector || '';
    document.getElementById('optionInputSelector').value = config.optionInputSelector || '';
  } else {
    document.getElementById('questionSelector').value = '';
    document.getElementById('optionSelector').value = '';
    document.getElementById('optionInputSelector').value = '';
  }
}

document.getElementById('saveSiteConfig').addEventListener('click', async () => {
  if (!currentDomainName) {
    showSystemMsg(t('siteDomainError'));
    return;
  }

  const config = {
    questionSelector: document.getElementById('questionSelector').value.trim(),
    optionSelector: document.getElementById('optionSelector').value.trim(),
    optionInputSelector: document.getElementById('optionInputSelector').value.trim(),
  };

  if (!config.questionSelector) {
    showSystemMsg(t('questionSelectorRequired'));
    return;
  }

  const data = await chrome.storage.local.get('xolverSiteConfigs');
  const configs = data.xolverSiteConfigs || {};
  configs[currentDomainName] = config;
  await chrome.storage.local.set({ xolverSiteConfigs: configs });
  showSystemMsg(t('settingsSaved', currentDomainName));
});

document.getElementById('deleteSiteConfig').addEventListener('click', async () => {
  if (!currentDomainName) return;

  const data = await chrome.storage.local.get('xolverSiteConfigs');
  const configs = data.xolverSiteConfigs || {};
  delete configs[currentDomainName];
  await chrome.storage.local.set({ xolverSiteConfigs: configs });

  document.getElementById('questionSelector').value = '';
  document.getElementById('optionSelector').value = '';
  document.getElementById('optionInputSelector').value = '';
  showSystemMsg(t('settingsDeleted', currentDomainName));
});

// ===================== CLEAR CHAT =====================
document.getElementById('clearChatBtn').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: 'clearChat' });
  selectedHTML = '';
  selectedPreview.classList.add('hidden');
  chatMessages.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">🎯</div>
      <p>${t('welcomeText')}</p>
    </div>`;
});

// ===================== ELEMENT SELECTOR =====================
let isSelectingMode = false;
let lastSelectorTabId = null;

selectElementBtn.addEventListener('click', async () => {
  // If already selecting, cancel it
  if (isSelectingMode) {
    isSelectingMode = false;
    selectElementBtn.classList.remove('active');
    selectElementBtn.innerHTML = `${SVG_CURSOR} ${t('selectElement')}`;
    chrome.storage.local.remove('xolverSelectorActive');
    if (lastSelectorTabId) {
      chrome.tabs.sendMessage(lastSelectorTabId, { action: 'stopSelector' }).catch(() => {});
      lastSelectorTabId = null;
    }
    return;
  }

  let tab;

  if (isDetached) {
    // In detached mode, find the active tab in a normal browser window
    const allTabs = await chrome.tabs.query({ active: true });
    // Pick the first tab that is a real web page (not extension or chrome internal)
    tab = allTabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
    if (!tab) tab = allTabs.find(t => t.url && t.url.startsWith('http'));
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  }

  if (!tab) return;

  // Inject content script into ALL frames (iframes may contain questions)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['src/content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id, allFrames: true },
      files: ['src/content.css']
    });
  } catch (e) {
    // Already injected or error
  }

  // Start selector
  chrome.tabs.sendMessage(tab.id, { action: 'startSelector' });

  // Save selector state so it persists across popup close/reopen
  isSelectingMode = true;
  lastSelectorTabId = tab.id;
  chrome.storage.local.set({ xolverSelectorActive: { tabId: tab.id } });

  // Only close if running as popup (not detached window)
  if (!isDetached) {
    window.close();
  } else {
    selectElementBtn.classList.add('active');
    selectElementBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
      </svg>
      Click to cancel...`;
  }
});

// ===================== AUTO SOLVE =====================
const autoSolveBtn = document.getElementById('autoSolveBtn');
let isAutoSolving = false;

autoSolveBtn.addEventListener('click', async () => {
  // If already solving, cancel
  if (isAutoSolving) {
    chrome.runtime.sendMessage({ action: 'autoSolveCancel' });
    isAutoSolving = false;
    isLoading = false;
    autoSolveBtn.classList.remove('active');
    autoSolveBtn.innerHTML = `${SVG_BOLT} ${t('autoSolve')}`;
    renderChatFromStorage();
    return;
  }

  let tab;

  if (isDetached) {
    const allTabs = await chrome.tabs.query({ active: true });
    tab = allTabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
    if (!tab) tab = allTabs.find(t => t.url && t.url.startsWith('http'));
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  }

  if (!tab) return;

  // Inject content script into ALL frames (iframes may contain questions)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['src/content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id, allFrames: true },
      files: ['src/content.css']
    });
  } catch (e) {}

  // Tell content script to auto-detect and solve questions
  isAutoSolving = true;
  autoSolveBtn.classList.add('active');
  autoSolveBtn.innerHTML = `${SVG_CANCEL} ${t('cancel')}`;

  // Add "Auto Solve" banner to chat via background storage
  chrome.runtime.sendMessage({ action: 'autoSolveStart' });

  // Pass tabId and tab hostname explicitly so content script in iframes can use it
  const tabHostname = tab.url ? new URL(tab.url).hostname : '';
  chrome.tabs.sendMessage(tab.id, { action: 'autoSolve', tabId: tab.id, tabHostname: tabHostname });
});

// Listen for auto-solve completion
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'autoSolveStatus') {
    if (msg.status === 'done' || msg.status === 'noQuestions') {
      isAutoSolving = false;
      isLoading = false;
      autoSolveBtn.classList.remove('active');
      autoSolveBtn.innerHTML = `${SVG_BOLT} ${t('autoSolve')}`;
      renderChatFromStorage();
    }
  }
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

    // Reset select button state
    isSelectingMode = false;
    lastSelectorTabId = null;
    chrome.storage.local.remove('xolverSelectorActive');
    selectElementBtn.classList.remove('active');
    selectElementBtn.innerHTML = `${SVG_CURSOR} ${t('selectElement')}`;

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
        <p>${t('welcomeText')}</p>
      </div>`;
    return;
  }

  // Render all messages
  messages.forEach(msg => {
    addMessageEl(msg.role, msg.text);
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

  if (role === 'autosolve-banner') {
    div.classList.add('msg', 'msg-autosolve-banner');
    div.innerHTML = text;
  } else if (role === 'system') {
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
