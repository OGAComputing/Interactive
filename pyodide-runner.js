// Shared Pyodide runner — lazy-loaded, singleton instance.
// Usage: import { runPython, preload, checkSyntax } from '../../pyodide-runner.js';
//
// preload()  — starts downloading Pyodide in the background; returns the
//              Promise so callers can .then()/.catch() for status feedback.
// runPython(code, { inputs: [] })
//           — runs `code` in the shared interpreter; resolves with
//             { ok: boolean, output: string }
// checkSyntax(code)
//           — parses `code` with Python's ast module; resolves with
//             { ok: boolean, line?: number, msg?: string }
//             Does NOT execute the code — safe to call on every keystroke.
//
// Loading strategy: tries the self-hosted /pyodide/ folder first (present on
// the deployed GitHub Pages site after CI commits it). If that 404s — which
// happens during local development before the CI has run — it falls back to
// the jsDelivr CDN so local testing works without any manual setup.

const PYODIDE_VERSION = '0.27.3';
const PYODIDE_BASE    = new URL('./pyodide/', import.meta.url).href;
const PYODIDE_CDN     = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let _pyodide = null;
let _loading = null;

async function _init() {
  // Use fetch to probe for the self-hosted file — more reliable than catching
  // a failed import() because browsers can cache import failures within a session.
  let indexURL = PYODIDE_CDN;
  try {
    const probe = await fetch(PYODIDE_BASE + 'pyodide.asm.js', { method: 'HEAD' });
    if (probe.ok) indexURL = PYODIDE_BASE;
  } catch { /* network error — stay on CDN */ }

  const { loadPyodide } = await import(indexURL + 'pyodide.mjs');
  _pyodide = await loadPyodide({ indexURL });
  return _pyodide;
}

export function preload() {
  if (!_loading) _loading = _init();
  return _loading;
}

// Translate Python's terse error messages into plain English for novices.
function _cleanSyntaxMsg(raw) {
  const s = String(raw);
  if (/EOL while scanning string literal|unterminated string/i.test(s))
    return 'Missing closing quote — check your speech marks are paired';
  if (/EOF while parsing|unexpected EOF/i.test(s))
    return 'Code looks incomplete — are you missing a closing bracket?';
  if (/expected an indented block/i.test(s))
    return 'Indentation needed — the line after def / if / for / while must be indented (4 spaces or Tab)';
  if (/unexpected indent/i.test(s))
    return 'Unexpected indent — this line has too many spaces at the start';
  if (/unindent does not match/i.test(s))
    return 'Indentation mismatch — check your spacing is consistent (4 spaces or Tab throughout)';
  if (/invalid syntax/i.test(s))
    return 'Syntax error — check for a missing colon (:) after def / if / for / while, or unmatched brackets';
  if (/invalid character/i.test(s))
    return 'Invalid character — you may have "curly quotes" (“”) instead of straight quote marks (")';
  // Strip the exception class prefix and return the remainder as-is
  return s.replace(/^(?:SyntaxError|IndentationError|TabError): /, '').split('\n')[0];
}

export async function checkSyntax(code) {
  if (!_loading) _loading = _init();
  await _loading;
  // Run a Python try/except so we can read e.lineno and e.msg directly,
  // avoiding the unreliable regex-on-traceback approach (the traceback
  // includes internal Python file line numbers which swamp the student's line).
  // Assign to _r so it is the final top-level expression; a bare try/except
  // block is a statement and runPython() would return undefined otherwise.
  const pySnippet =
    `import ast as _ast, json as _json\n` +
    `try:\n` +
    `    _ast.parse(${JSON.stringify(code)})\n` +
    `    _r = _json.dumps({'ok': True})\n` +
    `except SyntaxError as _e:\n` +
    `    _r = _json.dumps({'ok': False, 'line': _e.lineno, 'msg': _e.msg})\n` +
    `_r\n`;
  try {
    const result = JSON.parse(_pyodide.runPython(pySnippet));
    if (result.ok) return { ok: true };
    return { ok: false, line: result.line, msg: _cleanSyntaxMsg(result.msg) };
  } catch (err) {
    // Fallback: something unexpected went wrong (e.g. IndentationError subclass)
    const raw = String(err);
    const lines = raw.split('\n').filter(l => l.trim());
    return { ok: false, line: null, msg: _cleanSyntaxMsg(lines[lines.length - 1] || raw) };
  }
}

export async function runPython(code, { inputs = [] } = {}) {
  if (!_loading) _loading = _init();
  await _loading;

  const out = [];
  _pyodide.setStdout({ batched: s => out.push(s) });
  _pyodide.setStderr({ batched: () => {} }); // errors surface via exception

  // Inject input() mock when test values are supplied.
  // Echo the prompt + the "typed" value to stdout so the output matches a real
  // terminal: `name = input("What is your name? ")` with value "Nick" shows the
  // line `What is your name? Nick`, then later print()s follow.
  // Fallback '0' (not '') so exhausted inputs don't produce a str that breaks arithmetic.
  const preamble = inputs.length
    ? `import builtins as _b, sys as _sys\n` +
      `_q = iter(${JSON.stringify(inputs)})\n` +
      `def _mock_input(prompt=''):\n` +
      `    _v = next(_q, '0')\n` +
      `    _sys.stdout.write(str(prompt) + str(_v) + '\\n')\n` +
      `    return _v\n` +
      `_b.input = _mock_input\n`
    : '';
  // Line numbers in the traceback are relative to preamble + code — shift them
  // back by the (invisible-to-the-student) preamble length before reporting.
  const preambleLines = preamble ? preamble.split('\n').length - 1 : 0;

  try {
    await _pyodide.runPythonAsync(preamble + code);
    return { ok: true, output: out.length ? out.join('\n') + '\n' : '' };
  } catch (err) {
    // Return only the final error line — strip the Python traceback header
    const raw = String(err);
    const lines = raw.split('\n').filter(l => l.trim());
    const msg = lines[lines.length - 1] || raw;
    // Pull the deepest "line N" the traceback reports — the frame closest to
    // the actual failure — so the help card can point the student at it.
    const lineMatches = [...raw.matchAll(/, line (\d+)/g)];
    let line = null;
    if (lineMatches.length) {
      const n = parseInt(lineMatches[lineMatches.length - 1][1], 10) - preambleLines;
      if (n >= 1) line = n;
    }
    return { ok: false, output: msg, line };
  }
}

export async function analyzeCode(code) {
  if (!_loading) _loading = _init();
  const py = await _loading;

  if (!py.globals.get('_py_analyze')) {
    py.runPython(`
import tokenize, io, html, keyword, json, ast
def _py_analyze(code):
    result = {"ok": True, "line": None, "msg": "", "html": "", "type": ""}
    # 1. Syntax Check
    try:
        ast.parse(code)
    except SyntaxError as e:
        result.update({"ok": False, "line": e.lineno, "msg": str(e.msg), "type": type(e).__name__})
    except Exception as e:
        result.update({"ok": False, "line": None, "msg": str(e), "type": type(e).__name__})

    # 2. Highlighting
    tokens_html = []
    lines = code.splitlines(keepends=True)
    last_ln, last_col = 1, 0
    try:
        tokens = tokenize.generate_tokens(io.StringIO(code).readline)
        for tok in tokens:
            if tok.type == tokenize.ENCODING or tok.type == tokenize.ENDMARKER: continue
            s_ln, s_col = tok.start
            if (s_ln, s_col) > (last_ln, last_col):
                if s_ln == last_ln: tokens_html.append(html.escape(lines[s_ln-1][last_col:s_col]))
                else:
                    tokens_html.append(html.escape(lines[last_ln-1][last_col:]))
                    for i in range(last_ln, s_ln - 1): tokens_html.append(html.escape(lines[i]))
                    tokens_html.append(html.escape(lines[s_ln-1][:s_col]))
            val = html.escape(tok.string)
            cls = "tok-default"
            if tok.type == tokenize.NAME:
                if keyword.iskeyword(tok.string): cls = "tok-kw"
                elif tok.string in ['print', 'input', 'len', 'range', 'int', 'str', 'float',
                                    'bool', 'list', 'dict', 'set', 'tuple', 'type',
                                    'abs', 'round', 'max', 'min', 'sorted', 'enumerate', 'zip']: cls = "tok-builtin"
            else:
                cls = {tokenize.STRING: "tok-str", tokenize.NUMBER: "tok-num",
                       tokenize.COMMENT: "tok-comment", tokenize.OP: "tok-op"}.get(tok.type, "tok-default")
            if cls == "tok-default": tokens_html.append(val)
            else: tokens_html.append(f'<span class="{cls}">{val}</span>')
            last_ln, last_col = tok.end
    except Exception:
        tokens_html.append(html.escape(code[sum(len(l) for l in lines[:last_ln-1]) + last_col:]))
    
    result["html"] = "".join(tokens_html)
    return json.dumps(result)
`);
  }
  return JSON.parse(py.globals.get('_py_analyze')(code));
}
