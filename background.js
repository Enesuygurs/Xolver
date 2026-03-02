// ===================== XOLVER BACKGROUND SERVICE WORKER =====================

// Forward messages from content script to popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'elementSelected') {
    // Forward to all extension pages (popup)
    chrome.runtime.sendMessage(msg).catch(() => {
      // Popup might be closed, that's okay
    });
  }
});

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Xolver extension installed');
});
