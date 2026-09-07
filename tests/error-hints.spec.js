import { test, expect } from '@playwright/test';

// Exercises the opt-in just-in-time error helper wired through the shared editor
// (code-editor.js + python-error-hints.js). Uses the Run-stage editor of the
// Unit 1 L1 Strings PRIMM activity, which enables { errorHints: true }.
//
// Two reveal paths, both click-to-open (never automatic):
//   • Syntax errors  → a "Get help" button on the live syntax-hint.
//   • Run-time errors → a "Get help" button next to the output panel after a failed run.
const ACTIVITY = '/Y8/Python%20Unit%201/L1_Output/1_Strings_PRIMM.html';

async function gotoRunEditor(page) {
  await page.goto(ACTIVITY);
  await page.locator('[data-stage="R"]').click();
  const container = page.locator('#stage-R .editor-container');
  await expect(container).not.toHaveClass(/loading/, { timeout: 30000 });
}

test('syntax error: "Get help" on the hint opens the short explanation', async ({ page }) => {
  await gotoRunEditor(page);

  // Missing closing speech mark — caught by static analysis before any run.
  await page.locator('#r_editor').fill('print("This is fun!)');

  const helpBtn = page.locator('#stage-R .syntax-hint .syntax-hint-help');
  await expect(helpBtn).toBeVisible({ timeout: 30000 });

  // Help window stays closed until the student asks for it.
  const helper = page.locator('#stage-R .error-helper');
  await expect(helper).toBeHidden();

  await helpBtn.click();
  await expect(helper).toBeVisible();
  // Header shows the error type + line number.
  await expect(helper.locator('.eh-head')).toContainText('SyntaxError');
  await expect(helper.locator('.eh-head')).toContainText('line 1');
  // It quotes the actual Python error back, then translates it.
  await expect(helper.locator('.eh-term')).toContainText('unterminated string literal');
  await expect(helper.locator('.eh-plain strong')).toContainText('missing one of the speech marks');
  // A short, separate "Try:" fix line — no long debugging-recipe list any more.
  await expect(helper.locator('.eh-fix')).toContainText('Try:');
  await expect(helper.locator('.eh-recipe')).toHaveCount(0);
});

test('pressing Run does not auto-reveal the help window', async ({ page }) => {
  await gotoRunEditor(page);

  await page.locator('#r_editor').fill('print("This is fun!)');
  await page.locator('#stage-R .checker-footer button:has-text("Run code")').click();

  // Help stays closed after a run — only the button appears.
  const helper = page.locator('#stage-R .error-helper');
  await expect(helper).toBeHidden();
  await expect(page.locator('#stage-R .output-help-btn')).toBeVisible({ timeout: 30000 });
});

test('help reappears on Get help after fix, then re-break (regression)', async ({ page }) => {
  await gotoRunEditor(page);
  const helper = page.locator('#stage-R .error-helper');

  // 1) break → Get help opens the window
  await page.locator('#r_editor').fill('print("This is fun!)');
  await page.locator('#stage-R .syntax-hint .syntax-hint-help').click();
  await expect(helper).toBeVisible({ timeout: 30000 });

  // 2) fix → window closes
  await page.locator('#r_editor').fill('print("This is fun!")');
  await expect(helper).toBeHidden({ timeout: 30000 });

  // 3) re-break → Get help must work again (previously suppressed)
  await page.locator('#r_editor').fill('print("This is fun!)');
  await expect(page.locator('#stage-R .syntax-hint .syntax-hint-help')).toBeVisible({ timeout: 30000 });
  await page.locator('#stage-R .syntax-hint .syntax-hint-help').click();
  await expect(helper).toBeVisible();
});

test('fixing the syntax error closes the hint and the help window', async ({ page }) => {
  await gotoRunEditor(page);

  await page.locator('#r_editor').fill('print("This is fun!)');
  const helpBtn = page.locator('#stage-R .syntax-hint .syntax-hint-help');
  await expect(helpBtn).toBeVisible({ timeout: 30000 });
  await helpBtn.click();
  await expect(page.locator('#stage-R .error-helper')).toBeVisible();

  await page.locator('#r_editor').fill('print("This is fun!")');
  await expect(page.locator('#stage-R .syntax-hint')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#stage-R .error-helper')).toBeHidden();
});

test('run-time error (NameError): Get help shows the type, line and a short fix', async ({ page }) => {
  await gotoRunEditor(page);

  // Valid syntax (no syntax-hint), but fails at run-time with NameError.
  await page.locator('#r_editor').fill('print(mystery)');
  await expect(page.locator('#stage-R .syntax-hint')).toBeHidden();

  await page.locator('#stage-R .checker-footer button:has-text("Run code")').click();

  const helper = page.locator('#stage-R .error-helper');
  await expect(helper).toBeHidden();
  const helpBtn = page.locator('#stage-R .output-help-btn');
  await expect(helpBtn).toBeVisible({ timeout: 30000 });

  await helpBtn.click();
  await expect(helper).toBeVisible();
  await expect(helper.locator('.eh-head')).toContainText('NameError');
  await expect(helper.locator('.eh-head')).toContainText('line 1');
  await expect(helper).toContainText('Try:');
});

test('clean code shows no hint and no help window or button', async ({ page }) => {
  await gotoRunEditor(page);

  await page.locator('#r_editor').fill('print("Hello, World!")');
  await page.locator('#stage-R .checker-footer button:has-text("Run code")').click();
  await expect(page.locator('#stage-R .py-status, #r_fb_run')).toBeVisible({ timeout: 30000 });

  await page.waitForTimeout(1500);
  await expect(page.locator('#stage-R .error-helper')).toBeHidden();
  await expect(page.locator('#stage-R .syntax-hint')).toBeHidden();
  await expect(page.locator('#stage-R .output-help-btn')).toBeHidden();
});
