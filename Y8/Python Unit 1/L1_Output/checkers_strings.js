// Validation logic for 1_Strings_PRIMM.html — Output: print() with strings.

export function normalise(code) {
  let s = code.replace(/#[^\n]*/g, '');
  s = s.replace(/"""[\s\S]*?"""/g, '""');
  s = s.replace(/"[^"\n]*"/g, '"…"');
  s = s.replace(/'[^'\n]*'/g, '"…"');
  return s.toLowerCase().replace(/\s+/g, ' ');
}

export function has(code, pattern) {
  return pattern instanceof RegExp ? pattern.test(code) : code.includes(pattern);
}

function countPrints(raw) {
  return (raw.match(/\bprint\s*\(/g) || []).length;
}

export const MOD_CHECKS = {
  mod1(raw) {
    // Count only prints that actually output text — an empty print() left over from
    // the investigation is fine here (Modification 3 uses one deliberately).
    const textPrints = countPrints(raw) - (raw.match(/\bprint\s*\(\s*\)/g) || []).length;
    if (textPrints < 3)
      return { pass: false, msg: '❌ Keep at least 3 print() calls that show text — one for your name, year group, and school name.' };
    if (/hello,\s*world/i.test(raw))
      return { pass: false, msg: '❌ Change "Hello, World!" to your own text — the original starter text is still there.' };
    if (/i am learning python/i.test(raw))
      return { pass: false, msg: '❌ Change "I am learning Python." to something about you — the original text is still there.' };
    if (/this is fun/i.test(raw))
      return { pass: false, msg: '❌ Change "This is fun!" to something about you — the original text is still there.' };
    return { pass: true, msg: '✅ Looking good — all your print() lines now show your own text!' };
  },
  mod2(raw) {
    // Five lines of *text* — an empty print() carried over from the investigation
    // doesn't count towards the five (it has no text).
    const textPrints = countPrints(raw) - (raw.match(/\bprint\s*\(\s*\)/g) || []).length;
    if (textPrints < 5)
      return { pass: false, msg: `❌ You need at least 5 print() calls that show text — you have ${textPrints}. Add ${5 - textPrints} more.` };
    return { pass: true, msg: '✅ Five print() calls found — your program prints five things!' };
  },
  mod3(raw) {
    if (!has(raw, /print\s*\(\s*\)/) && !has(raw, /print\s*\(\s*["']\s*["']\s*\)/))
      return { pass: false, msg: '❌ Add at least one print() with empty brackets to create a blank line in the output.' };
    return { pass: true, msg: '✅ Empty print() found — that creates a blank line in the output!' };
  },
  mod4(raw) {
    if (countPrints(raw) < 5)
      return { pass: false, msg: '❌ Keep all your print() lines — just change their ORDER, don\'t delete any.' };
    // The empty print() (the blank line) must now be the FIRST print in the program,
    // so the output starts with a blank line. This forces a real reorder.
    const firstPrint = raw.match(/print\s*\([^)]*\)/);
    if (!firstPrint || !/^print\s*\(\s*(["']\s*["'])?\s*\)$/.test(firstPrint[0]))
      return { pass: false, msg: '❌ Move your empty print() to the very top so it runs FIRST — the first print() line of your program should have empty brackets.' };
    return { pass: true, msg: '✅ The blank line now prints first! Moving it changed the output — Python always runs top to bottom.' };
  },
};

export const MOD_INPUTS = {};

export function validateMake(raw) {
  if (raw.trim().length < 10)
    return { pass: false, msg: '⚠️ Write your program first, then click Check.' };
  const printCount = countPrints(raw);
  if (printCount < 4)
    return { pass: false, msg: `❌ You need at least 4 print() calls — one for each name. You have ${printCount}.` };
  const strings = raw.match(/["'][^"'\n]+["']/g) || [];
  const nonEmpty = strings.filter(s => s.length > 2);
  if (nonEmpty.length < 4)
    return { pass: false, msg: '❌ Make sure each print() contains a name (non-empty text in speech marks).' };
  return { pass: true, msg: '✅ Four names printed — great work! Did you sort them alphabetically?' };
}

export function validateExt(raw) {
  if (raw.trim().length < 10)
    return { pass: false, msg: '⚠️ Paste your extended program above first.' };
  const printCount = countPrints(raw);
  if (printCount > 1)
    return { pass: false, msg: `❌ Use a SINGLE print() statement — you currently have ${printCount}. Combine all four names into one print() using \\n.` };
  if (printCount < 1)
    return { pass: false, msg: '❌ Add one print() statement containing all four names.' };
  if (!has(raw, /\\n/))
    return { pass: false, msg: '❌ Use \\n inside your print() to display all four names on separate lines.' };
  return { pass: true, msg: '✅ Extension complete — all four names in a single print() using \\n. Excellent!' };
}

export function validateMake2(raw) {
  if (raw.trim().length < 10)
    return { pass: false, msg: '⚠️ Write your second program first, then click Check.' };
  const textPrints = countPrints(raw) - (raw.match(/\bprint\s*\(\s*\)/g) || []).length;
  if (textPrints < 4)
    return { pass: false, msg: `❌ You need at least 4 print() lines of text — a title plus 3 items. You have ${textPrints}.` };
  if (!has(raw, /print\s*\(\s*\)/))
    return { pass: false, msg: '❌ Add an empty print() to leave a blank line between your title and your list.' };
  return { pass: true, msg: '✅ Second program complete — great job building it from scratch!' };
}

export function validateTripleQuote(raw) {
  if (raw.trim().length < 10)
    return { pass: false, msg: '⚠️ Write your triple-quote print() first.' };
  const tripleMatches = raw.match(/("""[\s\S]*?"""|'''[\s\S]*?''')/g) || [];
  if (tripleMatches.length === 0)
    return { pass: false, msg: '❌ Use triple quotes (""" ... """) around your text — you haven\'t used any yet.' };
  const longEnough = tripleMatches.some(m => (m.match(/\n/g) || []).length >= 2);
  if (!longEnough)
    return { pass: false, msg: '❌ Your triple-quoted text needs at least 3 lines — press Enter inside the quotes to add more lines.' };
  if (!has(raw, /\bprint\s*\(/))
    return { pass: false, msg: '❌ Wrap your triple-quoted text in a print() call so it actually displays.' };
  return { pass: true, msg: "✅ Multi-line printing with triple quotes — excellent! You've previewed a technique early." };
}

export function validateVpMod1(raw) {
  if (raw.trim().length < 20)
    return { pass: false, msg: '⚠️ Write some code first.' };
  if (!/\bname\s*=\s*["'][^"']+["']/.test(raw))
    return { pass: false, msg: '❌ Keep the name variable — just change its value to your own name (keep the speech marks).' };
  if (/\bname\s*=\s*["']Alice["']/i.test(raw))
    return { pass: false, msg: '❌ Change the value of name from "Alice" to your own name.' };
  if (!/\bschool\s*=\s*["'][^"']+["']/.test(raw))
    return { pass: false, msg: '❌ Keep the school variable — change its value to your own school name.' };
  if (/\bschool\s*=\s*["']Grange Academy["']/i.test(raw))
    return { pass: false, msg: '❌ Change "Grange Academy" to your own school name.' };
  if (!/\bprint\s*\(\s*name\s*\)/.test(raw))
    return { pass: false, msg: '❌ Keep print(name) — only change the variable values, not the print lines.' };
  if (!/\bprint\s*\(\s*school\s*\)/.test(raw))
    return { pass: false, msg: '❌ Keep print(school) — only change the variable values, not the print lines.' };
  return { pass: true, msg: '✅ Your own values are printing! Notice you only changed the assignment lines — the print lines stayed the same.' };
}

export function validateVpMod2(raw) {
  const r1 = validateVpMod1(raw);
  if (!r1.pass) return r1;
  if (!/\bsubject\s*=\s*["'][^"']+["']/.test(raw))
    return { pass: false, msg: '❌ Add a variable called subject and set it to your favourite school subject (in speech marks).' };
  if (!/\bprint\s*\(\s*subject\s*\)/.test(raw))
    return { pass: false, msg: '❌ Add print(subject) to display your subject variable.' };
  return { pass: true, msg: '✅ Three variables, all printing. Ready for the challenge!' };
}

export function validateVpChallenge(raw) {
  if (raw.trim().length < 20)
    return { pass: false, msg: '⚠️ Write your name badge program first.' };
  const varCount = (raw.match(/\b[a-zA-Z_]\w*\s*=\s*["'][^"'\n]+["']/g) || []).length;
  if (varCount < 3)
    return { pass: false, msg: `❌ Create at least 3 string variables — you have ${varCount} so far.` };
  if (!has(raw, '+'))
    return { pass: false, msg: '❌ Use + to join strings and variables in at least one print line — try: print("Name: " + first_name).' };
  const printCount = (raw.match(/\bprint\s*\(/g) || []).length;
  if (printCount < 2)
    return { pass: false, msg: '❌ Print at least 2 lines of your name badge.' };
  return { pass: true, msg: "✅ Name badge complete — you've previewed variables and string concatenation. You'll fly through the next lesson!" };
}
