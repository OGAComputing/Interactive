// Shared pseudocode-editor widget for OCR pseudocode activities.
// Drop-in counterpart to code-editor.js; targets .pseudocode-textarea by default.
//
// Usage (ES module):
//   import { setupEditors, clearSyntaxHint, setEditorOutput,
//            refreshEditor, setFiles, getWrittenFiles, runPseudocode }
//     from '../../pseudocode-editor.js';
//
//   setupEditors();                 // targets .pseudocode-textarea
//   setupEditors('.my-editor');     // or a custom selector
//
//   setFiles({ "data.txt": "line1\nline2" });   // seed files before running
//   const r = await runPseudocode(textareaEl);  // transpile + run
//   const written = await getWrittenFiles();    // { "out.txt": "..." }
//
// Path depth: topic-level → '../../pseudocode-editor.js'
//             lesson subfolder → '../../../pseudocode-editor.js'

import { transpile, mapErrorLine } from './pseudocode-transpiler.js';
import { checkSyntax, runPython } from './pyodide-runner.js';

// ── CSS (injected once; identical structure to code-editor.js) ────────────────
function _injectStyles() {
  if (document.getElementById('_code-editor-css') || document.getElementById('_pscode-editor-css')) return;
  const s = document.createElement('style');
  s.id = '_pscode-editor-css';
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
    :where(.checker-dot) { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    :where(.dot-r) { background: #f38ba8; }
    :where(.dot-y) { background: #f9e2af; }
    :where(.dot-g) { background: #a6e3a1; }
    :where(.checker-header span:last-child) { margin-left: auto; font-weight: 700; color: #cba6f7; }
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
    :where(.editor-container) { position: relative; flex: 1; display: block; overflow: hidden; }
    .editor-container .pseudocode-textarea { color: transparent !important; background: transparent !important; }
    .pseudocode-textarea {
      width: 100%;
      box-sizing: border-box;
      -webkit-appearance: none;
      appearance: none;
      margin: 0;
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
      overflow-x: auto;
      overflow-y: hidden;
      min-height: 200px;
      white-space: pre;
    }
    :where(.highlight-layer) {
      position: absolute;
      top: 0; left: 0; bottom: 0;
      min-width: 100%; width: max-content;
      box-sizing: border-box;
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
    .tok-kw      { color: #c678dd; font-weight: bold; }
    .tok-str     { color: #98c379; }
    .tok-num     { color: #d19a66; }
    .tok-comment { color: #5c6370; font-style: italic; }
    .tok-builtin { color: #61afef; }
    .tok-op      { color: #56b6c2; }
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
    :where(.syntax-hint.visible) { display: block; }
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
    .output-panel.error,
    .output-panel.error .output-content { color: #ff6b6b; }
    :where(.output-header) {
      font-size: 0.65rem;
      color: #585b70;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
      user-select: none;
      letter-spacing: 0.05em;
    }
    :where(.output-content) { white-space: pre-wrap; word-break: break-all; }
    :where(.output-input-row) {
      display: flex;
      align-items: center;
      border-top: 1px solid #1a1060;
      margin-top: 0.3rem;
      padding-top: 0.3rem;
      flex-shrink: 0;
    }
    /* The [hidden] attribute's UA-stylesheet display:none has no !important, so
       the display:flex rule above silently wins and the row (with its now-empty
       prompt label and input) stays on screen looking like an unanswered prompt. */
    .output-input-row[hidden] { display: none; }
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
    @media (max-width: 768px) {
      :where(.editor-wrap) { flex-direction: column; }
      :where(.output-panel) { border-left: none; border-top: 1px solid #2d1060; min-height: 120px; flex: none; }
    }
    @keyframes ac-skeleton-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
    .editor-container.loading::after {
      content: "";
      position: absolute;
      top: 0.8rem; left: 1rem; right: 1rem; bottom: 0.8rem;
      background-image: linear-gradient(#585b70 0.7rem, transparent 0.7rem, transparent 1.7rem);
      background-size: 100% 1.7rem;
      animation: ac-skeleton-pulse 1.5s infinite;
      z-index: 3;
      pointer-events: none;
    }
    .editor-container.loading .pseudocode-textarea,
    .editor-container.loading .highlight-layer { visibility: hidden; }
  `;
  document.head.appendChild(s);
}

// ── Module-level state ────────────────────────────────────────────────────────
const _hintMap      = new Map(); // textarea → .syntax-hint
const _outputMap    = new Map(); // textarea → .output-panel
const _hlMap        = new Map(); // textarea → .highlight-layer
const _numsMap      = new Map(); // textarea → .line-nums
const _containerMap = new Map(); // textarea → .editor-container
const _lastVal      = new Map(); // textarea → last processed value
const _pyTimers     = new Map(); // debounce for transpile+highlight
const _hintTimers   = new Map(); // debounce for syntax hint
const _uiTimers     = new Map(); // debounce for line-nums + resize

let _currentFiles = {}; // populated by setFiles()
const _EDITOR_CLIPBOARD_TYPE = 'application/x-interactive-pseudocode-editor';

// ── JS-side OCR pseudocode highlighter ───────────────────────────────────────
const _KEYWORDS = new Set([
  'if', 'then', 'else', 'elseif', 'endif',
  'while', 'endwhile', 'do', 'until',
  'for', 'to', 'step', 'next',
  'switch', 'case', 'default', 'endswitch',
  'function', 'endfunction', 'procedure', 'endprocedure',
  'return', 'global', 'array', 'class', 'endclass', 'inherits',
  'public', 'private', 'super',
  'and', 'or', 'not', 'mod', 'div',
  'true', 'false', 'null',
]);
const _BUILTINS = new Set([
  'print', 'input', 'int', 'str', 'float', 'real', 'bool',
  'openread', 'openwrite', 'readline', 'writeline', 'close', 'endoffile',
]);

function _esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _highlightPseudocode(src) {
  let html = '';
  let i = 0;
  while (i < src.length) {
    // Line comment
    if (src[i] === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const slice = end === -1 ? src.slice(i) : src.slice(i, end);
      html += `<span class="tok-comment">${_esc(slice)}</span>`;
      i += slice.length;
      continue;
    }
    // String literal
    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== '\n') j++;
      if (j < src.length && src[j] === '"') j++;
      html += `<span class="tok-str">${_esc(src.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // Number
    if (/[0-9]/.test(src[i])) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      html += `<span class="tok-num">${_esc(src.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // Identifier / keyword
    if (/[A-Za-z_]/.test(src[i])) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const lower = word.toLowerCase();
      if (_KEYWORDS.has(lower)) {
        html += `<span class="tok-kw">${_esc(word)}</span>`;
      } else if (_BUILTINS.has(lower)) {
        html += `<span class="tok-builtin">${_esc(word)}</span>`;
      } else {
        html += _esc(word);
      }
      i = j;
      continue;
    }
    // Operators
    if (/[+\-*/<>=!^,.]/.test(src[i])) {
      html += `<span class="tok-op">${_esc(src[i])}</span>`;
      i++;
      continue;
    }
    // Whitespace, brackets, everything else
    html += _esc(src[i]);
    i++;
  }
  return html;
}

// ── Error message translation (Python → pseudocode-flavoured) ────────────────
function _translateMsg(pyMsg, srcLine) {
  if (String(pyMsg).includes('_psc_loop_limit'))
    return "Infinite loop — your program was stopped because a loop ran too many times. Check that your loop condition will eventually be false.";
  let msg = String(pyMsg).replace(/^(?:SyntaxError|IndentationError|TabError|RuntimeError|Exception): /, '').split('\n')[0];

  if (/expected.*':'|invalid syntax|missing colon/i.test(msg))
    msg = "Syntax error — check for a missing keyword (then, do, to) or unmatched brackets";
  else if (/expected an indented block/i.test(msg))
    msg = "Empty block — add at least one statement inside your if/while/for/function";
  else if (/unexpected indent/i.test(msg))
    msg = "Unexpected indentation — this line has more spaces than expected";
  else if (/unindent does not match/i.test(msg))
    msg = "Indentation mismatch — check your spacing is consistent";
  else if (/EOL.*string|unterminated string/i.test(msg))
    msg = 'Missing closing quote — check your speech marks are paired';
  else if (/EOF.*pars|unexpected EOF/i.test(msg))
    msg = 'Code looks incomplete — are you missing a closing bracket?';
  else if (/invalid character/i.test(msg))
    msg = 'Invalid character — you may have curly quotes instead of straight quote marks (")';

  return msg + (srcLine != null ? ` — pseudocode line ${srcLine}` : '');
}

// ── Private helpers ───────────────────────────────────────────────────────────
const _lastLineCount = new Map();
function _autoResize(ta, force = false) {
  const lines = ta.value.split('\n').length;
  if (!force && lines === _lastLineCount.get(ta)) return;
  // Hidden elements (inside display:none) have scrollHeight = 0. Don't set height
  // and don't cache the line count so the resize runs properly when shown.
  if (ta.offsetParent === null) return;
  _lastLineCount.set(ta, lines);
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function _updateNums(ta, nums) {
  const count = ta.value.split('\n').length;
  nums.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
}

function _debouncedCheck(ta) {
  // Immediate: sync highlight layer so text is never invisible during debounce window
  const val = ta.value;
  const hl = _hlMap.get(ta);
  if (hl) hl.innerHTML = _highlightPseudocode(val) + (val.endsWith('\n') ? ' ' : '');
  _containerMap.get(ta)?.classList.remove('loading');

  clearTimeout(_uiTimers.get(ta));
  _uiTimers.set(ta, setTimeout(() => {
    _updateNums(ta, _numsMap.get(ta));
    _autoResize(ta);
  }, 20));

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
  const val = ta.value;

  // Step 1: transpile (synchronous)
  const { python, map, errors } = transpile(val);

  // Step 2: JS-side highlight (synchronous — no Pyodide needed)
  const hl = _hlMap.get(ta);
  if (hl) hl.innerHTML = _highlightPseudocode(val) + (val.endsWith('\n') ? ' ' : '');

  // Clear initial loading skeleton
  _containerMap.get(ta)?.classList.remove('loading');

  const hint = _hintMap.get(ta);

  // Step 3: show transpiler errors immediately (no debounce needed)
  if (errors.length) {
    if (hint) {
      hint.textContent = '⚠ ' + errors.map(e => `line ${e.line}: ${e.msg}`).join('\n');
      hint.classList.add('visible');
    }
    return;
  }

  // Step 4: debounced Pyodide syntax check on the transpiled Python
  clearTimeout(_hintTimers.get(ta));
  _hintTimers.set(ta, setTimeout(async () => {
    if (ta.value !== val) return;
    if (!hint) return;
    if (val.trim().length < 5) { hint.classList.remove('visible'); return; }

    const result = await checkSyntax(python);
    if (ta.value !== val) return;

    if (result.ok) {
      hint.classList.remove('visible');
    } else {
      const srcLine = result.line ? mapErrorLine(map, result.line) : null;
      hint.textContent = '⚠ ' + _translateMsg(result.msg, srcLine);
      hint.classList.add('visible');
    }
  }, 800));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Trigger a refresh of highlighting, line numbers, and height. */
export function refreshEditor(ta) {
  if (!ta) return;
  _updateNums(ta, _numsMap.get(ta));
  _autoResize(ta, true);
  _runHeavyTasks(ta);
}

/** Hide the syntax hint — call after a successful code check. */
export function clearSyntaxHint(ta) {
  _hintMap.get(ta)?.classList.remove('visible');
}

/** Turn the output panel red to signal a failed test (does not change the text). */
export function markOutputFailed(ta) {
  _outputMap.get(ta)?.classList.add('error');
}

/** Update the output panel for a specific textarea. */
export function setEditorOutput(ta, text, isError = false) {
  const panel = _outputMap.get(ta);
  if (!panel) return;
  panel.classList.toggle('error', isError);
  const content = panel.querySelector('.output-content');
  if (content) content.textContent = text || '';
  const inputRow = panel.querySelector('.output-input-row');
  if (inputRow) inputRow.hidden = true;
}

// ── Interactive input collection ──────────────────────────────────────────────

// Scan pseudocode source for input("prompt") calls; returns array of prompt strings.
function _extractPrompts(src) {
  const prompts = [];
  const re = /\binput\s*\(\s*(?:"([^"]*?)"|'([^']*?)')?/g;
  let m;
  while ((m = re.exec(src)) !== null) prompts.push(m[1] ?? m[2] ?? '');
  return prompts;
}

// Map of ta → current input abort flag (replacing listener when re-run)
const _inputAbort = new Map();

// Show sequential prompts in the output panel; resolves with collected values.
function _collectInputs(ta, prompts) {
  const panel = _outputMap.get(ta);
  if (!panel || prompts.length === 0) return Promise.resolve([]);

  // Cancel any in-progress collection for this editor
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
      inputRow.hidden = true;
      inputField.removeEventListener('keydown', onKey);
      _inputAbort.delete(ta);
      resolve(collected);
    }

    function advance(val) {
      content.textContent += prompts[idx] + val + '\n';
      collected.push(val);
      idx++;
      if (idx >= prompts.length) {
        finish();
      } else {
        promptLabel.textContent = prompts[idx];
        inputField.value = '';
      }
    }

    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); advance(inputField.value); }
    }

    _inputAbort.set(ta, finish);
    inputField.addEventListener('keydown', onKey);
    promptLabel.textContent = prompts[0];
    inputField.value = '';
    inputRow.hidden = false;
    inputField.focus();
  });
}

/**
 * Pre-load files for the file-I/O surface.
 * @param {{ [filename: string]: string }} filesObj  name → file contents
 */
export function setFiles(filesObj) {
  _currentFiles = { ...filesObj };
}

/**
 * Read back files written by the last run via openWrite / writeLine.
 * @returns {Promise<{ [filename: string]: string }>}
 */
export async function getWrittenFiles() {
  const r = await runPython(
    `import json as _j; print(_j.dumps({k: "\\n".join(v) for k, v in _psc_writes.items()}))`,
    { inputs: [] }
  );
  if (!r.ok) return {};
  try { return JSON.parse(r.output.trim()); } catch { return {}; }
}

/**
 * Transpile the pseudocode in `ta`, run it, and update the output panel.
 * Handles file injection and error-line remapping automatically.
 *
 * @param {HTMLTextAreaElement} ta
 * @param {{ inputs?: string[] }} opts
 * @returns {Promise<{ ok: boolean, output?: string, errors?: object[], map?: (number|null)[] }>}
 */
// inputs = null  → auto-collect from the output panel (default for new activities)
// inputs = []    → run with no inputs (pre-supplied empty list, skips collection)
// inputs = [...] → use the supplied values directly (backwards-compatible)
export async function runPseudocode(ta, { inputs = null } = {}) {
  const { python, map, errors } = transpile(ta.value);
  if (errors.length) {
    setEditorOutput(ta, errors.map(e => `line ${e.line}: ${e.msg}`).join('\n'), true);
    return { ok: false, errors, map };
  }

  let resolvedInputs = inputs;
  if (resolvedInputs === null) {
    const prompts = _extractPrompts(ta.value);
    resolvedInputs = prompts.length > 0 ? await _collectInputs(ta, prompts) : [];
  }

  // Inject files and reset writes before each run.
  const injection = `_psc_files = ${JSON.stringify(_currentFiles)}\n_psc_writes = {}\n`;
  const r = await runPython(injection + python, { inputs: resolvedInputs });

  const panel = _outputMap.get(ta);
  const content = panel?.querySelector('.output-content');
  const hasHistory = resolvedInputs.length > 0 && content?.textContent;

  if (r.ok) {
    // r.output already reconstructs the full prompt/answer conversation (the
    // mocked input() re-echoes every prompt+value), so it replaces — rather
    // than appends to — the live echo shown during collection.
    setEditorOutput(ta, r.output || '(no output)');
  } else {
    const m = r.output.match(/line\s+(\d+)/);
    const pyLine = m ? Number(m[1]) : null;
    const srcLine = pyLine ? mapErrorLine(map, pyLine) : null;
    const msg = '⚠ ' + _translateMsg(r.output, srcLine);
    if (hasHistory) {
      panel.classList.add('error');
      content.textContent += '\n' + msg;
    } else {
      setEditorOutput(ta, msg, true);
    }
  }
  return { ...r, map };
}

/**
 * Upgrade every textarea matching `selector` into a pseudocode editor.
 * Call once in DOMContentLoaded after restoring any saved state.
 */
export function setupEditors(selector = '.pseudocode-textarea') {
  _injectStyles();

  document.querySelectorAll(selector).forEach(ta => {
    if (ta.dataset.editorInitialized) return;
    ta.dataset.editorInitialized = 'true';

    // ── Build DOM structure ───────────────────────────────────────────────
    const wrap = document.createElement('div');
    wrap.className = 'editor-wrap';
    ta.parentNode.insertBefore(wrap, ta);

    if (ta.dataset.title) {
      const existingHeader = ta.closest('.code-checker')?.querySelector('.checker-header');
      if (!existingHeader) {
        const header = document.createElement('div');
        header.className = 'checker-header';
        header.innerHTML =
          '<span class="checker-dot dot-r"></span>' +
          '<span class="checker-dot dot-y"></span>' +
          '<span class="checker-dot dot-g"></span>' +
          `<span>${ta.dataset.title}</span>`;
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

    const output = document.createElement('div');
    output.className = 'output-panel';
    output.innerHTML =
      '<div class="output-header">Output</div>' +
      '<div class="output-content"></div>' +
      '<div class="output-input-row" hidden>' +
        '<span class="output-prompt-label"></span>' +
        '<input class="output-input-field" type="text" autocomplete="off" spellcheck="false">' +
      '</div>';
    wrap.appendChild(output);
    _outputMap.set(ta, output);

    const hint = document.createElement('div');
    hint.className = 'syntax-hint';
    wrap.insertAdjacentElement('afterend', hint);
    _hintMap.set(ta, hint);

    // ── Events ───────────────────────────────────────────────────────────
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

    ta.addEventListener('input', () => _debouncedCheck(ta));
    ta.addEventListener('scroll', () => {
      // overflow-y:hidden hides the scrollbar but doesn't prevent scrollTop drifting.
      // A non-zero scrollTop shifts the cursor mapping vs the highlight layer, causing
      // clicks to land one line above the visual text. Reset it immediately.
      if (ta.scrollTop !== 0) ta.scrollTop = 0;
      const hl = _hlMap.get(ta);
      if (hl) hl.style.transform = `translateX(-${ta.scrollLeft}px)`;
    });
    ta.addEventListener('focus', () => {
      const v = ta.value.trim();
      if (v === '// Write your OCR pseudocode here' || v === '// Write your pseudocode here') {
        ta.value = '';
        _debouncedCheck(ta);
      } else {
        _debouncedCheck(ta);
      }
    });

    ta.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const start = ta.selectionStart, end = ta.selectionEnd;
      if (e.shiftKey) {
        const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
        const m = ta.value.slice(lineStart).match(/^( {1,4})/);
        if (m) {
          const n = m[1].length;
          ta.value = ta.value.slice(0, lineStart) + ta.value.slice(lineStart + n);
          ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - n);
        }
      } else {
        ta.value = ta.value.slice(0, start) + '    ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
      }
      _debouncedCheck(ta);
      window.saveState?.();
    });

    // ── Initial render ────────────────────────────────────────────────────
    _updateNums(ta, nums);
    _autoResize(ta);
    _runHeavyTasks(ta);
  });
}
