// Shared code-editor widget — line numbers, auto-resize, Tab indentation,
// and live Python syntax checking via Pyodide's ast module.
//
// Usage (ES module):
//   import { setupEditors, clearSyntaxHint } from '../../code-editor.js';
//
//   // In DOMContentLoaded, after restoring saved state:
//   setupEditors();                    // targets .checker-textarea by default
//   setupEditors('.my-editor');        // or a custom selector
//
//   // After a successful code check, clear the amber hint:
//   clearSyntaxHint(document.getElementById('myTextarea'));
//
// Path depth: activities at topic-level use '../../code-editor.js';
//             activities in a lesson subfolder use '../../../code-editor.js'.
//
// The Tab key inserts 4 spaces; Shift-Tab removes up to 4 leading spaces.
// window.saveState() is called after Tab/Shift-Tab if the activity exposes it.

import { analyzeCode, runPython } from './pyodide-runner.js';
import { explainPythonError } from './python-error-hints.js';

// ── Styles injected once per page ─────────────────────────────────────────────
// :where() gives these zero specificity so any local .checker-textarea rule
// in the activity's own <style> block always takes precedence.
function _injectStyles() {
  if (document.getElementById('_code-editor-css')) return;
  const s = document.createElement('style');
  s.id = '_code-editor-css';
  s.textContent = `
    :where(.editor-wrap) {
      display: flex;
      background: #0d0d1a;
      border-radius: 0 0 12px 12px;
      overflow: hidden;
    }
    :where(.checker-header) {
      background: #1a1040;
      padding: 0.6rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #b4a0e0;
      font-family: 'Trebuchet MS', 'Calibri', sans-serif;
      border-radius: 12px 12px 0 0;
      border: 2px solid #3d2d5e;
      border-bottom: none;
    }
    :where(.checker-dot) {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    :where(.dot-r) { background: #f38ba8; }
    :where(.dot-y) { background: #f9e2af; }
    :where(.dot-g) { background: #a6e3a1; }
    :where(.checker-header span:last-child) {
      margin-left: auto;
      font-weight: 700;
      color: #cba6f7;
    }
    :where(.line-nums) {
      padding: .8rem .5rem .8rem .7rem;
      font-family: 'Courier New', monospace;
      font-size: .88rem;
      line-height: 1.7;
      color: #585b70;
      text-align: right;
      user-select: none;
      border-right: 1px solid #2d1060;
      white-space: pre;
      min-width: 2.6rem;
      overflow: hidden;
      flex-shrink: 0;
    }
    :where(.editor-container) {
      position: relative;
      flex: 1;
      display: block;
    }
    /* Higher specificity to ensure text remains hidden even if themes set colors */
    .editor-container .checker-textarea {
      color: transparent !important;
      background: transparent !important;
    }
    .checker-textarea {
      width: 100%;
      caret-color: #cdd6f4;
      position: relative;
      z-index: 2;
      font-family: 'Courier New', 'Consolas', monospace;
      font-size: .88rem;
      line-height: 1.7;
      padding: .8rem 1rem;
      border: none;
      outline: none;
      resize: none;
      overflow: hidden;
      min-height: 200px;
      white-space: pre;
    }
    :where(.highlight-layer) {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      padding: .8rem 1rem;
      font-family: 'Courier New', 'Consolas', monospace;
      font-size: .88rem;
      line-height: 1.7;
      white-space: pre;
      color: #cdd6f4;
      pointer-events: none;
      z-index: 1;
      overflow: hidden;
    }
    /* Token Colors */
    .tok-kw { color: #c678dd; font-weight: bold; }
    .tok-str { color: #98c379; }
    .tok-num { color: #d19a66; }
    .tok-comment { color: #5c6370; font-style: italic; }
    .tok-builtin { color: #61afef; }
    .tok-op { color: #56b6c2; }

    :where(.syntax-hint) {
      display: none;
      padding: .45rem 1rem .45rem 1.2rem;
      font-family: 'Courier New', monospace;
      font-size: .78rem;
      line-height: 1.55;
      color: #f9e2af;
      background: #18100a;
      border-top: 1px solid #4a2e00;
      white-space: pre-wrap;
      word-break: break-word;
    }
    :where(.syntax-hint.visible) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    :where(.syntax-hint-msg) { white-space: pre-wrap; word-break: break-word; }
    :where(.syntax-hint-help) {
      flex-shrink: 0;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.74rem;
      font-weight: 700;
      color: #1a1206;
      background: #f9b020;
      border: none;
      border-radius: 6px;
      padding: 0.3rem 0.7rem;
      white-space: nowrap;
    }
    :where(.syntax-hint-help:hover) { background: #ffc44d; }
    :where(.output-help-btn) {
      display: inline-flex;
      align-self: flex-start;
      margin-top: 0.6rem;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.74rem;
      font-weight: 700;
      color: #1a1206;
      background: #f9b020;
      border: none;
      border-radius: 6px;
      padding: 0.3rem 0.7rem;
    }
    :where(.output-help-btn:hover) { background: #ffc44d; }
    :where(.output-help-btn[hidden]) { display: none; }
    :where(.output-panel) {
      flex: 1;
      background: #070710;
      color: #5eead4;
      font-family: 'Courier New', monospace;
      font-size: .82rem;
      padding: .8rem;
      border-left: 1px solid #2d1060;
      display: flex;
      flex-direction: column;
    }
    :where(.output-panel.error) {
      color: #f38ba8;
    }
    :where(.output-header) {
      font-size: 0.65rem;
      color: #585b70;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
      user-select: none;
      letter-spacing: 0.05em;
    }
    :where(.output-content) {
      white-space: pre-wrap;
      word-break: break-all;
    }
    :where(.output-input-row) {
      display: flex;
      align-items: center;
      border-top: 1px solid #1a1060;
      margin-top: 0.3rem;
      padding-top: 0.3rem;
      flex-shrink: 0;
    }
    :where(.output-prompt-label) {
      color: #5eead4;
      white-space: pre;
      font-family: 'Courier New', monospace;
      font-size: .82rem;
      flex-shrink: 0;
    }
    :where(.output-input-field) {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #f9e2af;
      font-family: 'Courier New', monospace;
      font-size: .82rem;
      caret-color: #f9e2af;
      padding: 0;
      min-width: 4ch;
    }

    /* ── Interactive input spotlight ──────────────────────────────────── */
    @keyframes _isp-pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(255,176,32,0.55), 0 0 18px rgba(255,176,32,0.30); }
      50%       { box-shadow: 0 0 0 4px rgba(255,176,32,0.90), 0 0 30px rgba(255,176,32,0.60); }
    }
    @keyframes _isp-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
    :where(.output-panel.waiting-for-input) {
      animation: _isp-pulse 1.4s ease-in-out infinite;
      border-radius: 6px;
    }
    :where(.output-panel.waiting-for-input .output-header) { color: #ffd080; }
    :where(.output-panel.waiting-for-input .output-header::after) {
      content: ' ⌨  type here ↓';
      color: #ffb020;
      font-style: italic;
      font-weight: 700;
    }
    :where(.output-panel.waiting-for-input .output-input-row) {
      border-top: 1px solid rgba(255,176,32,0.45);
      margin-top: 0.4rem;
      padding-top: 0.35rem;
    }
    :where(.output-panel.waiting-for-input .output-prompt-label) { color: #ffd080; }
    :where(.output-panel.waiting-for-input .output-input-field) {
      caret-color: #ffb020;
      border-bottom: 2px solid rgba(255,176,32,0.8);
    }
    :where(.input-type-hint) {
      color: #ffb020;
      font-family: 'Courier New', monospace;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      text-align: center;
      margin: 0.3rem 0 0.15rem;
      animation: _isp-blink 1.2s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      :where(.output-panel.waiting-for-input) { animation: none; box-shadow: 0 0 0 3px #ffb020; }
      :where(.input-type-hint) { animation: none; }
    }

    @media (max-width: 768px) {
      :where(.editor-wrap) {
        flex-direction: column;
      }
      :where(.output-panel) {
        border-left: none;
        border-top: 1px solid #2d1060;
        min-height: 120px;
        flex: none;
      }
    }

    @keyframes ac-skeleton-pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.6; }
    }
    .editor-container.loading::after {
      content: "";
      position: absolute;
      top: 0.8rem; left: 1rem; right: 1rem; bottom: 0.8rem;
      background-image: linear-gradient(
        #585b70 0.7rem, 
        transparent 0.7rem, 
        transparent 1.7rem
      );
      background-size: 100% 1.7rem;
      animation: ac-skeleton-pulse 1.5s infinite;
      z-index: 3;
      pointer-events: none;
    }
    .editor-container.loading .checker-textarea,
    .editor-container.loading .highlight-layer {
      visibility: hidden;
    }

    /* Just-in-time error helper (opt-in via setupEditors(..., {errorHints:true})).
       Zero-specificity :where() so an activity can re-theme it locally. */
    :where(.error-helper) {
      background: rgba(255,176,32,0.1);
      border: 1.5px solid #f9b020;
      border-radius: 10px;
      padding: 0.85rem 1.05rem;
      margin: 0.55rem 0 0.2rem;
      color: #ffe6b0;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 0.85rem;
      line-height: 1.5;
      animation: _eh-in 0.4s ease;
    }
    :where(.error-helper[hidden]) { display: none; }
    :where(.error-helper .eh-head) { display: flex; align-items: center; gap: 0.5rem; color: #ffd98a; font-weight: 700; margin-bottom: 0.5rem; }
    :where(.error-helper .eh-icon) { font-size: 1.1rem; flex-shrink: 0; }
    :where(.error-helper .eh-plain) { margin: 0 0 0.5rem; }
    :where(.error-helper .eh-term) { font-family: 'Courier New', monospace; color: #ffcf6b; font-weight: 700; }
    :where(.error-helper .eh-plain strong) { color: #fff; }
    :where(.error-helper .eh-fix) { margin: 0; }
    :where(.error-helper .eh-fix strong) { color: #ffd98a; }
    @keyframes _eh-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) {
      :where(.error-helper) { animation: none; }
    }
  `;
  document.head.appendChild(s);
}

// ── Module-level state ────────────────────────────────────────────────────────
const _hintMap = new Map(); // textarea → .syntax-hint element
const _outputMap = new Map(); // textarea → .output-panel element
const _hlMap = new Map(); // textarea → .highlight-layer element
const _numsMap = new Map(); // textarea → .line-nums element
const _containerMap = new Map(); // textarea → .editor-container element
const _lastVal = new Map(); // textarea → last processed string
const _pyTimers = new Map(); // textarea → debounce for heavy pyodide tasks
const _hintTimers = new Map(); // textarea → debounce for syntax hint visibility
const _uiTimers = new Map(); // textarea → debounce for fast UI tasks

// ── Just-in-time error helper state ─────────────────────────────────────────────
const _errHintsOn   = new Set(); // textareas opted into friendly error help
const _errHelperMap = new Map(); // textarea → .error-helper element
const _errHelpBtnMap = new Map(); // textarea → "Get help" button shown after a failed run

function _escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Render a python-error-hints `plain` string: HTML-escape, then **…** → <strong>.
function _boldify(plain) {
  return _escapeHTML(plain).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Reduce a raw Python/Pyodide error to the bare phrase the student sees, so the
// help can quote it back to them (e.g. "unterminated string literal").
function _cleanErrorTerm(raw) {
  if (!raw) return '';
  const line = String(raw).split('\n').map(l => l.trim()).filter(Boolean).pop() || '';
  return line
    .replace(/^[A-Za-z]*Error:\s*/, '')                              // drop "SyntaxError:" etc.
    .replace(/\s*\((?:detected at |<[^>]*>,\s*)?line\s*\d+\)\s*$/i, '') // drop "(detected at line 1)"
    .trim();
}

// Pull the exception class name (NameError, SyntaxError, ...) off the raw
// error's last line, so the help card can show it even when no fuller
// explanation matched.
function _errorType(raw) {
  if (!raw) return '';
  const line = String(raw).split('\n').map(l => l.trim()).filter(Boolean).pop() || '';
  const m = line.match(/^([A-Za-z]+Error)\b/);
  return m ? m[1] : '';
}

function _errHelperEnabled(ta) {
  return _errHintsOn.has(ta) || (ta.hasAttribute && ta.hasAttribute('data-error-hints'));
}

function _getErrHelper(ta) {
  let el = _errHelperMap.get(ta);
  if (el) return el;
  // Sits after the syntax-hint so it spans the full editor width, below the output.
  const anchor = _hintMap.get(ta) || _outputMap.get(ta);
  if (!anchor) return null;
  el = document.createElement('div');
  el.className = 'error-helper';
  el.hidden = true;
  anchor.insertAdjacentElement('afterend', el);
  _errHelperMap.set(ta, el);
  return el;
}

function _getErrHelpBtn(ta) {
  let btn = _errHelpBtnMap.get(ta);
  if (btn) return btn;
  const content = _outputMap.get(ta)?.querySelector('.output-content');
  if (!content) return null;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'output-help-btn';
  btn.textContent = '💡 Get help';
  btn.hidden = true;
  content.insertAdjacentElement('afterend', btn);
  _errHelpBtnMap.set(ta, btn);
  return btn;
}

// Offer help for a failed run: show a "Get help" button next to the output
// rather than popping the explanation open automatically — the student reads
// the raw error first and opens help only if they want it.
function _offerErrHelp(ta, rawError, lineNo = null, errType = null) {
  const btn = _getErrHelpBtn(ta);
  if (!btn) return;
  btn.onclick = () => _showErrHelper(ta, rawError, lineNo, errType);
  btn.hidden = false;
}

// Kept deliberately short (type + line, one meaning sentence, one fix
// sentence) — this is read by Year 8 students straight after a failed run.
function _showErrHelper(ta, rawError, lineNo = null, errType = null) {
  const el = _getErrHelper(ta);
  if (!el) return;
  const term = _cleanErrorTerm(rawError);
  const type = errType || _errorType(rawError) || 'Error';
  const where = lineNo ? ' — line ' + lineNo : '';
  const hint = explainPythonError(rawError);
  const meaning = hint
    ? _boldify(hint.plain)
    : 'Python could not read that line.';
  const fix = hint
    ? _escapeHTML(hint.fix)
    : 'Read it out loud and compare it with what you meant to write.';
  const termHTML = term ? '<span class="eh-term">“' + _escapeHTML(term) + '”</span> — ' : '';
  el.innerHTML =
    '<div class="eh-head"><span class="eh-icon">🛠️</span>'
    + '<strong>' + _escapeHTML(type) + where + '</strong></div>'
    + '<p class="eh-plain">' + termHTML + meaning + '</p>'
    + '<p class="eh-fix"><strong>Try:</strong> ' + fix + '</p>';
  el.hidden = false;
}

function _hideErrHelper(ta) {
  const el = _errHelperMap.get(ta);
  if (el) el.hidden = true;
  const btn = _errHelpBtnMap.get(ta);
  if (btn) btn.hidden = true;
}

// Close an already-open help window — used when live analysis sees the syntax
// is clean again (the student may have just fixed a syntax error).
function _dismissOpenErrHelper(ta) {
  const el = _errHelperMap.get(ta);
  if (el && !el.hidden) el.hidden = true;
}

const _EDITOR_CLIPBOARD_TYPE = 'application/x-interactive-code-editor';

// ── Private helpers ───────────────────────────────────────────────────────────
const _lastLineCount = new Map();
function _autoResize(ta, force = false) {
  const lines = ta.value.split('\n').length;
  if (!force && lines === _lastLineCount.get(ta)) return;
  _lastLineCount.set(ta, lines);
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function _updateNums(ta, nums) {
  const count = ta.value.split('\n').length;
  nums.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
}

function _debouncedCheck(ta) {
  // Fast UI updates (line numbers and resizing)
  clearTimeout(_uiTimers.get(ta));
  _uiTimers.set(ta, setTimeout(() => {
    _updateNums(ta, _numsMap.get(ta));
    _autoResize(ta);
  }, 20));

  // Heavy Pyodide tasks (highlighting and syntax)
  clearTimeout(_pyTimers.get(ta));
  _pyTimers.set(ta, setTimeout(() => {
    if (ta.value === _lastVal.get(ta)) return;
    _lastVal.set(ta, ta.value);
    _runHeavyTasks(ta);
  }, 50));
}

function _selectedText(ta) {
  return ta.value.slice(ta.selectionStart, ta.selectionEnd);
}

function _tagEditorClipboard(e, text) {
  if (!text || !e.clipboardData) return false;
  e.clipboardData.setData('text/plain', text);
  e.clipboardData.setData(_EDITOR_CLIPBOARD_TYPE, '1');
  e.preventDefault();
  return true;
}

function _pasteIsAllowed(ta, e) {
  if (ta.dataset.allowPaste) return true;
  return e.clipboardData?.types?.includes(_EDITOR_CLIPBOARD_TYPE);
}

async function _runHeavyTasks(ta) {
  let val = ta.value;
  let result;
  
  try {
    result = await analyzeCode(val);
  } catch (err) {
    console.warn("Analysis failed for editor:", err);
    _containerMap.get(ta)?.classList.remove('loading');
    return;
  }
  
  // If the value changed while we were awaiting (e.g. user typed), 
  // a newer _runHeavyTasks call is either already running or about to run.
  // We still clear the loading state so the initial skeleton disappears.
  const container = _containerMap.get(ta);
  if (container) container.classList.remove('loading');

  if (ta.value !== val) return;

  _lastVal.set(ta, val);

  // Update Highlighting
  const hl = _hlMap.get(ta);
  if (hl) hl.innerHTML = result.html + (val.endsWith('\n') ? ' ' : '');

  // Update Syntax Hint (Debounced separately to 800ms to avoid flicker)
  clearTimeout(_hintTimers.get(ta));
  _hintTimers.set(ta, setTimeout(() => {
    // Re-check value to ensure hint is for the latest text
    if (ta.value !== val) return;

    const hint = _hintMap.get(ta);
    if (!hint) return;
    
    if (result.ok || ta.value.trim().length < 5) {
      // Only dismiss an open help window on the visible→clean edge — code that
      // was always syntactically valid (e.g. it only fails at run-time) must
      // never close a help window opened via the run-time "Get help" button.
      const wasVisible = hint.classList.contains('visible');
      hint.classList.remove('visible');
      if (wasVisible && _errHelperEnabled(ta)) _dismissOpenErrHelper(ta);
    } else {
      const label = '⚠ ' + result.msg + (result.line ? ` — line ${result.line}` : '');
      if (_errHelperEnabled(ta)) {
        // Offer an on-demand "Get help" button that opens the friendly explanation.
        hint.innerHTML = '<span class="syntax-hint-msg"></span>' +
          '<button type="button" class="syntax-hint-help">💡 Get help</button>';
        hint.querySelector('.syntax-hint-msg').textContent = label;
        const raw = result.msg;
        hint.querySelector('.syntax-hint-help').onclick = () => _showErrHelper(ta, raw, result.line, result.type);
      } else {
        hint.textContent = label;
      }
      hint.classList.add('visible');
    }
  }, 800));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Manually trigger a refresh of the editor's highlighting, line numbers,
 * and height. Useful after programmatic value changes.
 */
export function refreshEditor(ta) {
  if (!ta) return;
  _updateNums(ta, _numsMap.get(ta));
  _autoResize(ta, true);
  _runHeavyTasks(ta);
}

/**
 * Hide the syntax hint for a textarea — call this after a successful code
 * check so the amber warning doesn't linger once the student's code is correct.
 */
export function clearSyntaxHint(ta) {
  _hintMap.get(ta)?.classList.remove('visible');
}

/**
 * Update the output panel for a specific textarea.
 * @param {HTMLTextAreaElement} ta - The source textarea
 * @param {string} text - The text to display
 * @param {boolean} isError - Whether to style as an error
 * @param {number|null} [lineNo] - Line number the error was reported at, if known
 */
export function setEditorOutput(ta, text, isError = false, lineNo = null) {
  const panel = _outputMap.get(ta);
  if (!panel) return;
  panel.classList.toggle('error', isError);
  const content = panel.querySelector('.output-content');
  if (content) content.textContent = text || '';
  const inputRow = panel.querySelector('.output-input-row');
  if (inputRow) inputRow.style.display = 'none';
  if (_errHelperEnabled(ta)) {
    // A failed run offers a "Get help" button next to the output; the
    // syntax-hint's own "Get help" button is a faster, pre-run path to it.
    if (isError) _offerErrHelp(ta, text, lineNo);
    else _hideErrHelper(ta);
  }
}

// ── Interactive input collection ──────────────────────────────────────────────

function _extractPythonPrompts(src) {
  const prompts = [];
  const re = /\binput\s*\(\s*(?:"([^"]*?)"|'([^']*?)')?/g;
  let m;
  while ((m = re.exec(src)) !== null) prompts.push(m[1] ?? m[2] ?? '');
  return prompts;
}

const _inputAbort = new Map();

function _collectInputs(ta, prompts) {
  const panel = _outputMap.get(ta);
  if (!panel || prompts.length === 0) return Promise.resolve([]);

  const prev = _inputAbort.get(ta);
  if (prev) prev();

  const content = panel.querySelector('.output-content');
  const inputRow = panel.querySelector('.output-input-row');
  const promptLabel = panel.querySelector('.output-prompt-label');
  const inputField = panel.querySelector('.output-input-field');

  panel.classList.remove('error');
  content.textContent = '';

  return new Promise(resolve => {
    const collected = [];
    let idx = 0;
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      inputRow.style.display = 'none';
      promptLabel.textContent = '';
      inputField.value = '';
      panel.classList.remove('waiting-for-input');
      panel.querySelector('.input-type-hint')?.remove();
      inputField.removeEventListener('keydown', onKey);
      _inputAbort.delete(ta);
      resolve(collected);
    }

    function advance(val) {
      collected.push(val);
      idx++;
      if (idx >= prompts.length) {
        finish();
      } else {
        promptLabel.textContent = prompts[idx];
        inputField.value = '';
        inputField.focus();
      }
    }

    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); advance(inputField.value); }
    }

    _inputAbort.set(ta, finish);
    inputField.addEventListener('keydown', onKey);
    promptLabel.textContent = prompts[0];
    inputField.value = '';
    panel.classList.add('waiting-for-input');
    const typeHint = document.createElement('p');
    typeHint.className = 'input-type-hint';
    typeHint.textContent = '⌨  type your answer and press Enter';
    inputRow.insertAdjacentElement('beforebegin', typeHint);
    inputRow.style.display = 'flex';
    inputField.focus();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

/**
 * Run the Python code in `ta`, collecting any required inputs interactively
 * via the output panel, then display the result.
 *
 * inputs = null  → auto-collect from output panel (default)
 * inputs = []    → run with no inputs
 * inputs = [...] → use supplied values directly
 *
 * @param {HTMLTextAreaElement} ta
 * @param {{ inputs?: string[]|null }} opts
 * @returns {Promise<{ ok: boolean, output: string }>}
 */
export async function runCode(ta, { inputs = null } = {}) {
  let resolvedInputs = inputs;
  if (resolvedInputs === null) {
    const prompts = _extractPythonPrompts(ta.value);
    resolvedInputs = prompts.length > 0 ? await _collectInputs(ta, prompts) : [];
  }

  const r = await runPython(ta.value, { inputs: resolvedInputs });

  const panel = _outputMap.get(ta);
  const content = panel?.querySelector('.output-content');
  const hasHistory = resolvedInputs.length > 0 && content?.textContent;

  if (r.ok) {
    const out = r.output || '(no output)';
    if (hasHistory) {
      panel.classList.remove('error');
      content.textContent += out;
      if (_errHelperEnabled(ta)) _hideErrHelper(ta);
    } else {
      setEditorOutput(ta, out);
    }
  } else {
    const msg = r.output;
    if (hasHistory) {
      panel.classList.add('error');
      content.textContent += '\n' + msg;
      if (_errHelperEnabled(ta)) _offerErrHelp(ta, msg, r.line);
    } else {
      setEditorOutput(ta, msg, true, r.line);
    }
  }
  return r;
}

/**
 * Upgrade every textarea matching `selector` into a code editor:
 *   - wraps it in a flex row with a line-number gutter
 *   - injects a syntax-hint strip below the gutter
 *   - wires auto-resize, live syntax checking, and Tab indentation
 *
 * Call once in DOMContentLoaded after restoring any saved state.
 *
 * @param {string} selector - CSS selector for the textareas to upgrade.
 * @param {{errorHints?: boolean}} [opts] - Pass `{errorHints: true}` to show a
 *   just-in-time, Year-8-friendly explanation + Debugging Recipe below an editor
 *   a few seconds after a run fails. (A per-editor `data-error-hints` attribute
 *   opts a single textarea in regardless of this flag.)
 */
export function setupEditors(selector = '.checker-textarea', opts = {}) {
  _injectStyles();

  document.querySelectorAll(selector).forEach(ta => {
    if (ta.dataset.editorInitialized) return;
    ta.dataset.editorInitialized = "true";
    if (opts.errorHints) _errHintsOn.add(ta);

    // ── Build DOM structure ────────────────────────────────────────────────
    const wrap = document.createElement('div');
    wrap.className = 'editor-wrap';
    ta.parentNode.insertBefore(wrap, ta);

    // Optional header if data-title is present and no header exists
    if (ta.dataset.title) {
      const existingHeader = ta.closest('.code-checker')?.querySelector('.checker-header');
      if (!existingHeader) {
        const header = document.createElement('div');
        header.className = 'checker-header';
        header.innerHTML = '<span class="checker-dot dot-r"></span><span class="checker-dot dot-y"></span><span class="checker-dot dot-g"></span><span>' + ta.dataset.title + '</span>';
        wrap.parentNode.insertBefore(header, wrap);
      }
    }

    const container = document.createElement('div');
    container.className = 'editor-container loading';
    wrap.appendChild(container);
    _containerMap.set(ta, container);

    const hl = document.createElement('div');
    hl.className = 'highlight-layer';
    hl.setAttribute('aria-hidden', 'true');
    container.appendChild(hl);
    _hlMap.set(ta, hl);

    container.appendChild(ta);

    const nums = document.createElement('div');
    nums.className = 'line-nums';
    nums.setAttribute('aria-hidden', 'true');
    wrap.insertBefore(nums, container);
    _numsMap.set(ta, nums);

    // Output panel sits on the right
    const output = document.createElement('div');
    output.className = 'output-panel';
    output.innerHTML =
      '<div class="output-header">Python Shell Output</div>' +
      '<div class="output-content"></div>' +
      '<div class="output-input-row" style="display:none">' +
        '<span class="output-prompt-label"></span>' +
        '<input class="output-input-field" type="text" autocomplete="off" spellcheck="false">' +
      '</div>';
    wrap.appendChild(output);
    _outputMap.set(ta, output);

    // Hint sits after the wrap so it spans the full editor width
    const hint = document.createElement('div');
    hint.className = 'syntax-hint';
    wrap.insertAdjacentElement('afterend', hint);
    _hintMap.set(ta, hint);

    // ── Events ────────────────────────────────────────────────────────────
    ta.addEventListener('copy', e => {
      _tagEditorClipboard(e, _selectedText(ta));
    });

    ta.addEventListener('cut', e => {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      if (!_tagEditorClipboard(e, _selectedText(ta))) return;

      ta.value = ta.value.slice(0, start) + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      window.saveState?.();
    });

    ta.addEventListener('paste', e => {
      if (!_pasteIsAllowed(ta, e)) e.preventDefault();
    });

    ta.addEventListener('input', () => {
      _debouncedCheck(ta);
    });

    ta.addEventListener('focus', () => {
      // Refresh on focus in case the value changed programmatically 
      // or the editor was hidden during its initial render.
      _debouncedCheck(ta);
    });

    ta.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      if (e.shiftKey) {
        // Remove up to 4 leading spaces from the current line
        const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
        const m = ta.value.slice(lineStart).match(/^( {1,4})/);
        if (m) {
          const n = m[1].length;
          ta.value = ta.value.slice(0, lineStart) + ta.value.slice(lineStart + n);
          ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - n);
        }
      } else {
        // Insert 4 spaces at cursor
        ta.value = ta.value.slice(0, start) + '    ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
      }
      _debouncedCheck(ta);
      window.saveState?.(); // activities expose saveState as a global
    });

    // ── Initial render (value already restored by the activity) ───────────
    _updateNums(ta, nums);
    _autoResize(ta);
    _runHeavyTasks(ta);
  });
}
