// python-error-hints.js
// -----------------------------------------------------------------------------
// A small, presentation-free library that turns a raw Python / Pyodide error
// message into a short, plain-English explanation aimed at Year 8 "first
// contact" programmers.
//
// Usage:
//   import { explainPythonError } from '../../python-error-hints.js';
//   const hint = explainPythonError(result.output);
//   if (hint) showSomewhere(hint.title, hint.plain, hint.fix);
//
// `explainPythonError` returns `{ id, title, plain, fix }` for the first
// matching pattern, or `null` when nothing matches (so the caller can fall
// back to a generic message).
//
// `plain` says what went wrong in a few words; `fix` says what to try next.
// Both are theme-agnostic: the key takeaway is wrapped in **double asterisks**
// so each activity can render the bold span however it likes (HTML, etc.).
// Keep both to ONE short clause each — this is read by 12-13 year-olds
// straight after a failed run, so it needs to be scannable in a few seconds.
// -----------------------------------------------------------------------------

// Ordered most-specific → most-general. The catch-all SyntaxError entry MUST
// stay last so the precise messages win.
const HINTS = [
  {
    id: 'unterminated-string',
    match: /unterminated string literal|EOL while scanning string literal/i,
    title: 'Missing a speech mark',
    plain: 'you are **missing one of the speech marks** " ".',
    fix: 'Check every piece of text has one at the start and one at the end.',
  },
  {
    id: 'unclosed-bracket',
    match: /'\(' was never closed|unexpected EOF while parsing|expected '\)'|'\)' was never closed/i,
    title: 'Missing a bracket',
    plain: 'you are **missing a closing bracket** ) .',
    fix: 'Check every ( has a matching ) .',
  },
  {
    id: 'missing-colon',
    match: /expected ':'/i,
    title: 'Missing a colon',
    plain: 'you are **missing a colon :** at the end of the line.',
    fix: 'if, elif, else, for and while lines all end with a colon.',
  },
  {
    id: 'expected-indent',
    match: /IndentationError:\s*expected an indented block/i,
    title: 'Needs indenting',
    plain: 'the line underneath **needs to be indented** (press Tab).',
    fix: 'The code inside an if or a loop moves in from the left.',
  },
  {
    id: 'unexpected-indent',
    match: /IndentationError:\s*unexpected indent|unexpected indent/i,
    title: 'Too much indenting',
    plain: 'this line has **an extra space or Tab** at the start.',
    fix: 'Line it up with the lines above it.',
  },
  {
    id: 'print-parens',
    match: /Missing parentheses in call to '?print'?/i,
    title: 'print needs brackets',
    plain: 'print **needs brackets ()** around what you want to show.',
    fix: 'e.g. print("Hello").',
  },
  {
    id: 'name-error',
    match: /NameError:\s*name .* is not defined/i,
    title: "Python doesn't recognise a word",
    plain: 'that word may be **missing speech marks**, or is a typo'
           + ' for a variable name.',
    fix: 'Check the spelling matches, and that you created the variable before using it.',
  },
  {
    id: 'type-concat',
    match: /can only concatenate str|unsupported operand type\(s\)/i,
    title: 'Mixing text and numbers',
    plain: 'you tried to **join text and a number with +**.',
    fix: 'Wrap the number in str(), e.g. "Age: " + str(12).',
  },
  {
    // Catch-all — keep LAST.
    id: 'invalid-syntax',
    match: /invalid syntax|SyntaxError/i,
    title: 'Python cannot read a line',
    plain: 'there is a **small typo** on that line.',
    fix: 'Read it out loud and compare it with what you meant to write.',
  },
];

/**
 * Map a raw Python / Pyodide error message to a friendly explanation.
 * @param {string} rawError - The full error output or its last line.
 * @returns {{id: string, title: string, plain: string, fix: string} | null}
 *   null when nothing matches.
 */
export function explainPythonError(rawError) {
  if (!rawError) return null;
  const text = String(rawError);
  for (const hint of HINTS) {
    if (hint.match.test(text)) {
      return { id: hint.id, title: hint.title, plain: hint.plain, fix: hint.fix };
    }
  }
  return null;
}

// Exposed for tests / tooling that want to enumerate coverage.
export const ERROR_HINT_IDS = HINTS.map(h => h.id);
