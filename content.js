// ===================== XOLVER CONTENT SCRIPT =====================
// Element selector that injects into the active tab

(() => {
  // Prevent double injection
  if (window.__xolverInjected) return;
  window.__xolverInjected = true;

  let active = false;
  let hoveredEl = null;
  let tooltip = null;
  const HIGHLIGHT_OUTLINE = '3px solid #8b5cf6';
  const HIGHLIGHT_BG = 'rgba(139, 92, 246, 0.08)';

  // ===================== TOOLTIP =====================
  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    // Use inline styles so it works even inside shadow DOM frames
    Object.assign(tooltip.style, {
      position: 'fixed',
      zIndex: '2147483647',
      background: '#1a1a24',
      color: '#e4e4e7',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      fontSize: '12px',
      padding: '6px 12px',
      borderRadius: '8px',
      border: '1px solid #8b5cf6',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      maxWidth: '350px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    tooltip.setAttribute('data-xolver', 'tooltip');
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

    const tag = el.tagName ? el.tagName.toLowerCase() : '?';
    const id = el.id ? `#${el.id}` : '';
    const classes = el.classList && el.classList.length > 0
      ? '.' + Array.from(el.classList).filter(c => !c.startsWith('xolver-')).join('.')
      : '';

    tooltip.innerHTML = `<span style="color:#8b5cf6;font-weight:700">${tag}</span><span style="color:#f59e0b">${id}</span><span style="color:#10b981">${classes}</span>`;

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

  // ===================== HIGHLIGHT HELPERS (inline style for shadow DOM compat) =====================
  function addHighlight(el) {
    if (!el || !el.style) return;
    el.style.outline = HIGHLIGHT_OUTLINE;
    el.style.outlineOffset = '2px';
    el.style.backgroundColor = HIGHLIGHT_BG;
    el.style.cursor = 'crosshair';
  }

  function removeHighlight(el) {
    if (!el || !el.style) return;
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.backgroundColor = '';
    el.style.cursor = '';
  }

  // ===================== HANDLERS =====================
  function onMouseMove(e) {
    if (!active) return;

    // composedPath penetrates shadow DOM boundaries
    const path = e.composedPath();
    const el = path[0] || e.target;

    // Skip xolver elements
    if (el.getAttribute && el.getAttribute('data-xolver')) return;
    if (el === tooltip) return;

    // Remove previous highlight
    if (hoveredEl && hoveredEl !== el) {
      removeHighlight(hoveredEl);
    }

    hoveredEl = el;
    addHighlight(el);
    updateTooltip(el, e.clientX, e.clientY);
  }

  function onClick(e) {
    if (!active) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const path = e.composedPath();
    const el = path[0] || e.target;

    // Skip xolver UI elements
    if (el.getAttribute && el.getAttribute('data-xolver')) return;
    if (el === tooltip) return;

    // Clean up highlight before getting HTML
    removeHighlight(el);

    // Get full outer HTML
    const html = el.outerHTML;
    const tagInfo = (el.tagName ? el.tagName.toLowerCase() : 'element') +
      (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string'
        ? '.' + el.className.split(' ').filter(c => !c.startsWith('xolver-')).join('.')
        : '');

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
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    createTooltip();
  }

  function stopSelector() {
    active = false;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    if (hoveredEl) {
      removeHighlight(hoveredEl);
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
      autoSolveQuestions(msg.tabId, msg.tabHostname);
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
  let currentSiteConfig = null;

  // Normalize user-entered selectors: auto-prepend . for bare class names
  function normalizeSelector(sel) {
    if (!sel) return sel;
    sel = sel.trim();
    // If it already starts with CSS selector syntax, leave as-is
    if (/^[.#\[*:>+~]/.test(sel) || /^[a-z]+[.#\[]/i.test(sel)) return sel;
    // If it looks like a bare class name (letters, numbers, hyphens, underscores), add dot
    if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(sel)) {
      console.log('[Xolver] Auto-fixing selector: "' + sel + '" -> ".' + sel + '"');
      return '.' + sel;
    }
    return sel;
  }

  // Deep query: search through Shadow DOM and same-origin iframes
  function deepQuerySelectorAll(selector, root) {
    root = root || document;
    let results = Array.from(root.querySelectorAll(selector));

    // Search inside shadow roots
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        results = results.concat(deepQuerySelectorAll(selector, el.shadowRoot));
      }
    }

    // Search inside same-origin iframes (only from document, not shadow roots)
    if (root === document || root instanceof Document) {
      const iframes = root.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            results = results.concat(deepQuerySelectorAll(selector, iframeDoc));
          }
        } catch (e) {
          // Cross-origin iframe, skip
        }
      }
    }

    return results;
  }

  async function findQuestions(tabHostname) {
    // Try to load custom config for this site
    const hostname = window.location.hostname;
    console.log('[Xolver] findQuestions called on frame:', hostname, '| tabHostname:', tabHostname, '| isTop:', window === window.top, '| URL:', window.location.href.substring(0, 120));
    try {
      const data = await chrome.storage.local.get('xolverSiteConfigs');
      const configs = data.xolverSiteConfigs || {};
      console.log('[Xolver] Saved site configs:', JSON.stringify(Object.keys(configs)));
      
      // Try matching: 1) exact hostname, 2) tab hostname (for iframes), 3) any config whose selectors match
      const hostnamesToTry = [hostname];
      if (tabHostname && tabHostname !== hostname) hostnamesToTry.push(tabHostname);
      
      for (const h of hostnamesToTry) {
        const config = configs[h];
        if (config && config.questionSelector) {
          const normConfig = {
            questionSelector: normalizeSelector(config.questionSelector),
            optionSelector: normalizeSelector(config.optionSelector),
            optionInputSelector: normalizeSelector(config.optionInputSelector),
          };
          // Retry up to 8 times with 1.5s delay for dynamically loaded content
          for (let attempt = 0; attempt < 8; attempt++) {
            // First try normal query, then deep query (shadow DOM + nested iframes)
            let elements = document.querySelectorAll(normConfig.questionSelector);
            if (elements.length === 0) {
              elements = deepQuerySelectorAll(normConfig.questionSelector);
              if (elements.length > 0) {
                console.log('[Xolver] Found', elements.length, 'via DEEP search (shadow/iframe)');
              }
            }
            if (elements.length > 0) {
              console.log('[Xolver] Found', elements.length, 'questions with custom selector:', normConfig.questionSelector, 'for', h, '(frame:', hostname, ', attempt:', attempt, ')');
              currentSiteConfig = normConfig;
              return Array.from(elements);
            }
            if (attempt < 7) {
              if (attempt === 0) {
                // On first attempt, log iframe/shadow stats for debugging
                const iframeCount = document.querySelectorAll('iframe').length;
                const shadowCount = Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot).length;
                console.log('[Xolver] Frame stats — iframes:', iframeCount, 'shadow roots:', shadowCount, 'body children:', document.body?.children?.length || 0);
              }
              console.log('[Xolver] Selector "' + normConfig.questionSelector + '" found 0 elements, retrying in 1.5s... (attempt', attempt + 1, '/ 8)');
              await new Promise(r => setTimeout(r, 1500));
            }
          }
          console.log('[Xolver] Custom selector "' + normConfig.questionSelector + '" found 0 elements after 8 attempts (config:', h, ', frame:', hostname, ')');
        }
      }
      
      // Last resort: try ALL saved configs to see if any match this page
      for (const [configHost, config] of Object.entries(configs)) {
        if (hostnamesToTry.includes(configHost)) continue; // already tried
        if (config && config.questionSelector) {
          const normSel = normalizeSelector(config.questionSelector);
          let elements = deepQuerySelectorAll(normSel);
          if (elements.length > 0) {
            console.log('[Xolver] Found', elements.length, 'questions with config from', configHost, 'on frame', hostname);
            currentSiteConfig = {
              questionSelector: normSel,
              optionSelector: normalizeSelector(config.optionSelector),
              optionInputSelector: normalizeSelector(config.optionInputSelector),
            };
            return Array.from(elements);
          }
        }
      }
    } catch (e) {
      console.warn('[Xolver] Error loading site config:', e);
    }

    // Fall back to built-in selectors
    currentSiteConfig = null;
    for (const selector of QUESTION_SELECTORS) {
      let elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        elements = deepQuerySelectorAll(selector);
      }
      if (elements.length > 0) {
        console.log('[Xolver] Found', elements.length, 'questions with selector:', selector);
        return Array.from(elements);
      }
    }
    return [];
  }

  async function autoSolveQuestions(tabId, tabHostname) {
    autoSolveTabId = tabId;
    const isTopFrame = window === window.top;
    const flagKey = '__xolverAutoSolveSent_' + tabId;

    // Skip frames that clearly won't have quiz content (login iframes, etc.)
    const hostname = window.location.hostname;
    if (tabHostname && hostname !== tabHostname && !isTopFrame) {
      console.log('[Xolver] Skipping irrelevant iframe:', hostname, '(tab is', tabHostname, ')');
      return;
    }

    // Top frame resets the shared flag at the start of each new solve attempt
    if (isTopFrame) {
      try { window.top[flagKey] = false; } catch(e) { window[flagKey] = false; }
    }

    // Iframes wait briefly so the top frame gets priority (top frame does deep search covering iframes too)
    if (!isTopFrame) {
      await new Promise(r => setTimeout(r, 400));
    }

    detectedQuestions = await findQuestions(tabHostname);

    if (detectedQuestions.length === 0) {
      console.log('[Xolver] No questions found in frame:', hostname, window.location.pathname);
      // Only report "no questions" from the top frame to avoid duplicate messages from iframes
      if (isTopFrame) {
        // Wait long enough for iframe retries to complete (8 retries * 1.5s + buffer)
        await new Promise(r => setTimeout(r, 15000));
        chrome.runtime.sendMessage({ action: 'autoSolveNoQuestions' });
        chrome.runtime.sendMessage({ action: 'autoSolveStatus', status: 'noQuestions' });
      }
      return;
    }

    // Check shared flag via window.top (same-origin frames share access)
    let alreadySent = false;
    try { alreadySent = window.top[flagKey]; } catch(e) { alreadySent = window[flagKey]; }

    if (alreadySent) {
      console.log('[Xolver] Another frame already sent questions, skipping');
      return;
    }

    // Set shared flag to prevent other frames from also sending
    try { window.top[flagKey] = true; } catch(e) { window[flagKey] = true; }

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

    // Strategy 0: Custom site selectors
    if (currentSiteConfig && currentSiteConfig.optionSelector && answerLetter && letterMap[answerLetter] !== undefined) {
      const options = el.querySelectorAll(currentSiteConfig.optionSelector);
      const idx = letterMap[answerLetter];
      if (options[idx]) {
        const inputSel = currentSiteConfig.optionInputSelector || 'input[type="radio"], input[type="checkbox"]';
        const input = options[idx].querySelector(inputSel);
        if (input) {
          clickInput(input);
          matched = true;
          console.log('[Xolver] Matched by custom selector:', answerLetter, '-> option index', idx);
        } else {
          // Some frameworks use click on the container element directly
          options[idx].click();
          matched = true;
          console.log('[Xolver] Matched by custom selector (container click):', answerLetter, '-> option index', idx);
        }
      }
    }

    // Get all real radio/checkbox inputs (exclude Moodle's hidden clear-choice)
    const allInputs = el.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    const realInputs = Array.from(allInputs).filter(inp => {
      return inp.value !== '-1' && !inp.classList.contains('sr-only') && !inp.closest('.qtype_multichoice_clearchoice');
    });

    console.log('[Xolver] Found', realInputs.length, 'real inputs in question', questionIndex + 1);

    // Strategy 1: Match by letter index (A=0, B=1, C=2, D=3...)
    if (!matched && answerLetter && letterMap[answerLetter] !== undefined) {
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
