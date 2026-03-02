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
    } else if (msg.action === 'autoSolve') {
      autoSolveQuestions();
    } else if (msg.action === 'autoSolveAnswer') {
      applyAnswer(msg.questionIndex, msg.answer);
    }
  });

  // ===================== AUTO-SOLVE =====================
  // Supported question selectors for various platforms
  const QUESTION_SELECTORS = [
    '.formulation.clearfix',       // Moodle
    '.formulation',                // Moodle alt
    '.que .content',               // Moodle alt
    '.quiz-question',              // Generic
    '.question-container',         // Generic
    '[data-region="question"]',    // Moodle 4+
  ];

  let detectedQuestions = [];

  function findQuestions() {
    for (const selector of QUESTION_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }
    return [];
  }

  async function autoSolveQuestions() {
    detectedQuestions = findQuestions();

    if (detectedQuestions.length === 0) {
      chrome.runtime.sendMessage({ action: 'autoSolveStatus', status: 'noQuestions' });
      return;
    }

    // Send each question to background for solving
    for (let i = 0; i < detectedQuestions.length; i++) {
      const el = detectedQuestions[i];
      // Highlight the question being solved
      el.style.outline = '2px solid #8b5cf6';
      el.style.outlineOffset = '4px';
      el.style.transition = 'outline-color 0.3s';

      chrome.runtime.sendMessage({
        action: 'autoSolveQuestion',
        html: el.outerHTML,
        questionIndex: i,
        totalQuestions: detectedQuestions.length
      });
    }
  }

  function applyAnswer(questionIndex, answer) {
    const el = detectedQuestions[questionIndex];
    if (!el) return;

    // Normalize answer: extract the letter/option identifier
    const normalizedAnswer = answer.trim().toUpperCase();

    // Try to find and click the correct radio button / checkbox
    const inputs = el.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    const answerLabels = el.querySelectorAll('.answernumber, [data-region="answer-label"]');

    let matched = false;

    // Strategy 1: Match by answer letter (a, b, c, d...)
    // Map: 0=a, 1=b, 2=c, 3=d etc.
    const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 };

    // Check if answer is just a letter
    const letterMatch = normalizedAnswer.match(/^([A-F])[\.\)\s:]/);
    const singleLetter = letterMatch ? letterMatch[1] : (normalizedAnswer.length === 1 && letterMap[normalizedAnswer] !== undefined ? normalizedAnswer : null);

    if (singleLetter && letterMap[singleLetter] !== undefined) {
      const idx = letterMap[singleLetter];
      // Find the real radio buttons (exclude hidden clear-choice ones)
      const realInputs = Array.from(inputs).filter(inp => {
        return inp.value !== '-1' && !inp.classList.contains('sr-only');
      });
      if (realInputs[idx]) {
        realInputs[idx].click();
        realInputs[idx].checked = true;
        // Trigger change event
        realInputs[idx].dispatchEvent(new Event('change', { bubbles: true }));
        realInputs[idx].dispatchEvent(new Event('click', { bubbles: true }));
        matched = true;
      }
    }

    // Strategy 2: Match by answer text content
    if (!matched) {
      const answerContainers = el.querySelectorAll('.r0, .r1, [class*="answer"]');
      answerContainers.forEach(container => {
        const text = container.textContent.trim().toUpperCase();
        if (text.includes(normalizedAnswer) || normalizedAnswer.includes(text.replace(/^[A-F][\.\)\s]+/i, '').trim())) {
          const input = container.querySelector('input[type="radio"], input[type="checkbox"]');
          if (input) {
            input.click();
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            matched = true;
          }
        }
      });
    }

    // Visual feedback
    el.style.outline = matched ? '2px solid #10b981' : '2px solid #f59e0b';
    setTimeout(() => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 3000);
  }
})();
