// Validation logic for 1_Casting_PRIMM.html — data types, casting with int()/float(), and arithmetic.
// Checks are formative (they confirm the SHAPE of the construct), and every Modify/Make
// run is also executed in Pyodide so it must not error. Checks are written to be
// name-agnostic where possible: they key off variables that are cast from input().

// Strip comments and string CONTENTS (leaving "" / '') so tokens inside strings
// (+, input, print, variable-looking words) can't trigger false positives.
export function normalise(code) {
  let s = code.replace(/#[^\n]*/g, '');
  s = s.replace(/"""[\s\S]*?"""/g, '""').replace(/'''[\s\S]*?'''/g, "''");
  s = s.replace(/"[^"\n]*"/g, '""').replace(/'[^'\n]*'/g, "''");
  return s;
}

export function has(code, pattern) {
  return pattern instanceof RegExp ? pattern.test(code) : code.includes(pattern);
}

// ── shared helpers ───────────────────────────────────────────────────────────

// Number of input() calls in real code (strings stripped first).
function inputCount(raw) {
  return (normalise(raw).match(/\binput\s*\(/g) || []).length;
}

// Distinct variable names assigned from int(input(...)) or float(input(...)), e.g.
// a = int(input("...")). kind is 'int' or 'float'.
function castVars(raw, kind) {
  const s = normalise(raw);
  const re = new RegExp('\\b([A-Za-z_]\\w*)\\s*=\\s*' + kind + '\\s*\\(\\s*input\\s*\\(', 'g');
  const out = [];
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

// The argument text of every print( ... ) call, with strings already blanked to "".
function printArgs(raw) {
  const s = normalise(raw);
  const re = /\bprint\s*\(([^)]*)\)/g;
  const out = [];
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

const word = (v) => new RegExp('\\b' + v + '\\b');
const plusCount = (s) => (s.match(/\+/g) || []).length;

// ── Modify checks ─────────────────────────────────────────────────────────────
// By the end of Investigate, a and b are cast with int(input(...)) and print(a + b)
// correctly adds. c and d are untouched literal ints from the Predict/Run demo.

export const MOD_CHECKS = {
  // Mod 1 — subtract: a print() showing the difference a - b.
  mod1(raw) {
    const ok = printArgs(raw).some(a => /a\s*-\s*b/.test(a));
    if (!ok)
      return { pass: false, msg: '❌ Add a third print() that shows the difference between your two numbers: print(a - b).' };
    return { pass: true, msg: '✅ Nice — because both are cast with int(), - works like real subtraction, not text.' };
  },

  // Mod 2 — a third number, cast directly on one line, added into the total.
  mod2(raw) {
    const casted = castVars(raw, 'int').filter(v => v !== 'a' && v !== 'b');
    if (casted.length === 0)
      return { pass: false, msg: '❌ Ask for a THIRD number, casting it in one line — e.g. e = int(input("Enter third number: ")).' };
    const newVar = casted[0];
    const args = printArgs(raw);
    const ok = args.some(arg => plusCount(arg) >= 2 && word('a').test(arg) && word('b').test(arg) && word(newVar).test(arg));
    if (!ok)
      return { pass: false, msg: `❌ Add a print() that adds all three numbers together: print(a + b + ${newVar}).` };
    return { pass: true, msg: '✅ Three numbers, three int() casts, one real total — that is the whole idea of casting!' };
  },

  // Mod 3 — the average of the three numbers, using /.
  mod3(raw) {
    const casted = castVars(raw, 'int').filter(v => v !== 'a' && v !== 'b');
    const thirdVar = casted[0];
    if (!thirdVar)
      return { pass: false, msg: '❌ You need your third number variable from the last step before finding an average.' };
    const args = printArgs(raw);
    const ok = args.some(arg => /\//.test(arg) && word('a').test(arg) && word('b').test(arg) && word(thirdVar).test(arg));
    if (!ok)
      return { pass: false, msg: `❌ Print the average of your three numbers using / — e.g. print((a + b + ${thirdVar}) / 3).` };
    return { pass: true, msg: '✅ Dividing the total by 3 gives the average — / works properly because every value is a real number.' };
  },

  // Mod 4 — a decimal number with float(), combined into the running total.
  mod4(raw) {
    const floats = castVars(raw, 'float');
    if (floats.length === 0)
      return { pass: false, msg: '❌ Ask for a decimal number using float(input(...)) instead of int() — e.g. f = float(input("Enter a decimal number: ")).' };
    const floatVar = floats[0];
    const args = printArgs(raw);
    const ok = args.some(arg => plusCount(arg) >= 3 && word('a').test(arg) && word('b').test(arg) && word(floatVar).test(arg));
    if (!ok)
      return { pass: false, msg: `❌ Print the total of ALL your numbers added together, including your new decimal number ${floatVar}.` };
    return { pass: true, msg: '✅ Excellent — Python happily adds an int and a float together, giving you a decimal answer.' };
  },
};

// Mock inputs fed to runPython() for each Modify check (extra answers are harmless).
// Order matches the input() calls that exist by each step: a, b, then e (mod2), then f (mod4).
export const MOD_INPUTS = {
  mod1: ['6', '2', '4', '2.5'],
  mod2: ['6', '2', '4', '2.5'],
  mod3: ['6', '2', '4', '2.5'],
  mod4: ['6', '2', '4', '2.5'],
};

// ── Make ────────────────────────────────────────────────────────────────────
// A two-number calculator — tested with 8 and 2.

export function validateMake(raw) {
  if (raw.trim().length < 15)
    return { pass: false, msg: '⚠️ Write your program first, then click Check.' };
  const n = inputCount(raw);
  if (n < 2)
    return { pass: false, msg: `❌ Use input() twice — once for each number. You have ${n} so far.` };
  const casted = castVars(raw, 'int').concat(castVars(raw, 'float'));
  if (casted.length < 2)
    return { pass: false, msg: '❌ Cast BOTH numbers with int() so Python treats them as numbers, not text — e.g. num1 = int(input("First number: ")).' };
  const [v1, v2] = casted;
  const args = printArgs(raw);
  const sumOk = args.some(a => plusCount(a) >= 1 && word(v1).test(a) && word(v2).test(a));
  if (!sumOk)
    return { pass: false, msg: `❌ Print the SUM of your two numbers using + — e.g. print(${v1} + ${v2}).` };
  const otherOk = args.some(a => /[-*/]/.test(a) && word(v1).test(a) && word(v2).test(a));
  if (!otherOk)
    return { pass: false, msg: '❌ Print at least one more calculation with your two numbers — try -, * or /.' };
  return { pass: true, msg: '✅ Both numbers cast with int() and combined with real arithmetic — a proper calculator!' };
}

// ── Extension ─────────────────────────────────────────────────────────────────
// Open-ended: any real-world calculation with 3+ cast numbers and mixed operators.

export function validateExt(raw) {
  if (raw.trim().length < 15)
    return { pass: false, msg: '⚠️ Write your program above first, then click Check.' };
  const n = inputCount(raw);
  if (n < 3)
    return { pass: false, msg: `❌ The extension needs at least 3 numbers from input() — you have ${n} so far.` };
  const casted = castVars(raw, 'int').concat(castVars(raw, 'float'));
  if (casted.length < 3)
    return { pass: false, msg: '❌ Cast all of your numbers with int() or float() so Python treats them as real numbers, not text.' };
  const args = printArgs(raw);
  const opsUsed = new Set();
  args.forEach(a => ['+', '-', '*', '/'].forEach(op => { if (a.includes(op)) opsUsed.add(op); }));
  if (opsUsed.size < 2)
    return { pass: false, msg: '❌ Use at least TWO different arithmetic operators (from + - * /) across your print() lines.' };
  const combined = args.some(a => casted.filter(v => word(v).test(a)).length >= 3);
  if (!combined)
    return { pass: false, msg: '❌ In at least one print(), combine ALL THREE of your numbers together in a single calculation.' };
  return { pass: true, msg: '✅ Brilliant — three real numbers, multiple calculations, and one combined expression. A proper calculator program!' };
}
