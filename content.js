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
      autoSolveQuestions(msg.tabId);
    } else if (msg.action === 'autoSolveAnswer') {
      console.log('[Xolver] Received answer for question', msg.questionIndex, ':', msg.answer);
      applyAnswer(msg.questionIndex, msg.answer);
    }
  });

  // ===================== AUTO-SOLVE =====================
  const QUESTION_SELECTORS = [
    '.formulation.clearfix',       // Moodle
    '.formulation',                // Moodle alt
    '.que .content',               // Moodle alt
    '.quiz-question',              // Generic
    '.question-container',         // Generic
    '[data-region="question"]',    // Moodle 4+
  ];

  let detectedQuestions = [];
  let autoSolveTabId = null;

  function findQuestions() {
    for (const selector of QUESTION_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log('[Xolver] Found', elements.length, 'questions with selector:', selector);
        return Array.from(elements);
      }
    }
    return [];
  }

  async function autoSolveQuestions(tabId) {
    autoSolveTabId = tabId;
    detectedQuestions = findQuestions();

    if (detectedQuestions.length === 0) {
      console.log('[Xolver] No questions found on page');
      chrome.runtime.sendMessage({ action: 'autoSolveNoQuestions' });
      chrome.runtime.sendMessage({ action: 'autoSolveStatus', status: 'noQuestions' });
      return;
    }

    console.log('[Xolver] Starting auto-solve for', detectedQuestions.length, 'questions, tabId:', tabId);

    // Collect all questions and highlight them
    const questionsData = detectedQuestions.map((el, i) => {
      el.style.outline = '2px solid #8b5cf6';
      el.style.outlineOffset = '4px';
      el.style.transition = 'outline-color 0.3s';
      return { html: el.outerHTML, questionIndex: i };
    });

    // Send ALL questions to background at once — background handles sequential processing
    chrome.runtime.sendMessage({
      action: 'autoSolveAllQuestions',
      questions: questionsData,
      totalQuestions: detectedQuestions.length,
      tabId: tabId
    });
  }

  function applyAnswer(questionIndex, answer) {
    const el = detectedQuestions[questionIndex];
    if (!el) {
      console.log('[Xolver] Question element not found for index', questionIndex);
      return;
    }

    // Robust answer parsing: strip markdown, punctuation, whitespace
    let cleaned = answer.trim()
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/^\s*cevap\s*:?\s*/i, '')
      .replace(/^\s*answer\s*:?\s*/i, '')
      .trim();

    // Extract just the first letter if it starts with A-F
    const firstLetterMatch = cleaned.match(/^([A-Fa-f])/);
    const answerLetter = firstLetterMatch ? firstLetterMatch[1].toUpperCase() : null;

    console.log('[Xolver] Question', questionIndex + 1, '- raw:', JSON.stringify(answer), '- cleaned:', JSON.stringify(cleaned), '- letter:', answerLetter);

    let matched = false;
    const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 };

    // Get all real radio/checkbox inputs (exclude Moodle's hidden clear-choice)
    const allInputs = el.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    const realInputs = Array.from(allInputs).filter(inp => {
      return inp.value !== '-1' && !inp.classList.contains('sr-only') && !inp.closest('.qtype_multichoice_clearchoice');
    });

    console.log('[Xolver] Found', realInputs.length, 'real inputs in question', questionIndex + 1);

    // Strategy 1: Match by letter index (A=0, B=1, C=2, D=3...)
    if (answerLetter && letterMap[answerLetter] !== undefined) {
      const idx = letterMap[answerLetter];
      if (realInputs[idx]) {
        clickInput(realInputs[idx]);
        matched = true;
        console.log('[Xolver] Matched by letter index:', answerLetter, '-> input index', idx);
      }
    }

    // Strategy 2: Match by Moodle value attribute (value="0"=A, "1"=B, etc.)
    if (!matched && answerLetter && letterMap[answerLetter] !== undefined) {
      const idx = letterMap[answerLetter];
      const byValue = Array.from(allInputs).find(inp => inp.value === String(idx) && !inp.classList.contains('sr-only'));
      if (byValue) {
        clickInput(byValue);
        matched = true;
        console.log('[Xolver] Matched by Moodle value:', idx);
      }
    }

    // Strategy 3: Match by answernumber span text ("a. ", "b. ", etc.)
    if (!matched && answerLetter) {
      const answerNumbers = el.querySelectorAll('.answernumber');
      answerNumbers.forEach(span => {
        if (matched) return;
        const spanText = span.textContent.trim().toUpperCase();
        if (spanText.startsWith(answerLetter)) {
          const row = span.closest('.r0, .r1, div');
          if (row) {
            const input = row.querySelector('input[type="radio"], input[type="checkbox"]');
            if (input) {
              clickInput(input);
              matched = true;
              console.log('[Xolver] Matched by answernumber:', spanText);
            }
          }
        }
      });
    }

    // Strategy 4: Match by answer text in containers
    if (!matched && answerLetter) {
      const answerRows = el.querySelectorAll('.r0, .r1');
      answerRows.forEach(row => {
        if (matched) return;
        const text = row.textContent.trim().toUpperCase();
        const rowLetter = text.match(/^([A-F])[\.\)\s]/);
        if (rowLetter && rowLetter[1] === answerLetter) {
          const input = row.querySelector('input[type="radio"], input[type="checkbox"]');
          if (input) {
            clickInput(input);
            matched = true;
            console.log('[Xolver] Matched by row text letter:', rowLetter[1]);
          }
        }
      });
    }

    // Visual feedback
    el.style.outline = matched ? '2px solid #10b981' : '2px solid #f59e0b';
    el.style.outlineOffset = '4px';
    setTimeout(() => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 4000);

    console.log('[Xolver] Question', questionIndex + 1, matched ? 'MATCHED' : 'NOT MATCHED');
  }

  // Click helper — uses native .click() for maximum Moodle compatibility
  function clickInput(input) {
    // Native click is the most reliable for Moodle
    input.click();
    // Ensure checked state
    input.checked = true;
    // Dispatch change/input events for any framework listeners
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
})();
