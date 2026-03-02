// ===================== XOLVER CONTENT SCRIPT =====================
// Element selector that injects into the active tab

(() => {
  // Prevent double injection
  if (window.__xolverInjected) return;
  window.__xolverInjected = true;

  let active = false;
  let hoveredEl = null;
  let tooltip = null;

  // ===================== TOOLTIP =====================
  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.className = 'xolver-tooltip';
    document.body.appendChild(tooltip);
  }

  function removeTooltip() {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  function updateTooltip(el, x, y) {
    if (!tooltip) createTooltip();

    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes = el.classList.length > 0
      ? '.' + Array.from(el.classList).filter(c => !c.startsWith('xolver-')).join('.')
      : '';

    tooltip.innerHTML = `<span class="tag-name">${tag}</span><span class="tag-id">${id}</span><span class="tag-class">${classes}</span>`;

    // Position tooltip near cursor
    const offsetX = 15;
    const offsetY = 20;
    let left = x + offsetX;
    let top = y + offsetY;

    // Prevent overflow
    const rect = tooltip.getBoundingClientRect();
    if (left + rect.width > window.innerWidth) {
      left = x - rect.width - 5;
    }
    if (top + rect.height > window.innerHeight) {
      top = y - rect.height - 5;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  // ===================== HANDLERS =====================
  function onMouseMove(e) {
    if (!active) return;

    const el = e.target;

    // Skip xolver elements
    if (el.classList.contains('xolver-tooltip') || el.classList.contains('xolver-highlight')) {
      return;
    }

    // Remove previous highlight
    if (hoveredEl && hoveredEl !== el) {
      hoveredEl.classList.remove('xolver-highlight');
    }

    hoveredEl = el;
    el.classList.add('xolver-highlight');
    updateTooltip(el, e.clientX, e.clientY);
  }

  function onClick(e) {
    if (!active) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const el = e.target;

    // Skip xolver UI elements
    if (el.classList.contains('xolver-tooltip')) return;

    // Clean up highlight before getting HTML
    el.classList.remove('xolver-highlight');

    // Get full outer HTML
    const html = el.outerHTML;
    const tagInfo = el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (el.className ? '.' + el.className.split(' ').filter(c => !c.startsWith('xolver-')).join('.') : '');

    // Send to extension
    chrome.runtime.sendMessage({
      action: 'elementSelected',
      html: html,
      tagInfo: tagInfo
    });

    stopSelector();
  }

  function onKeyDown(e) {
    if (!active) return;
    if (e.key === 'Escape') {
      stopSelector();
    }
  }

  // ===================== START / STOP =====================
  function startSelector() {
    if (active) return;
    active = true;
    document.body.classList.add('xolver-selecting');
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    createTooltip();
  }

  function stopSelector() {
    active = false;
    document.body.classList.remove('xolver-selecting');
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    if (hoveredEl) {
      hoveredEl.classList.remove('xolver-highlight');
      hoveredEl = null;
    }
    removeTooltip();
  }

  // ===================== MESSAGE LISTENER =====================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'startSelector') {
      startSelector();
    } else if (msg.action === 'stopSelector') {
      stopSelector();
    }
  });
})();
