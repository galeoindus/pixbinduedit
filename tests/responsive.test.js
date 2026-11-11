/* Regression checks for responsive layout and pointer gesture lifecycle.
 * Run with: node --test tests/responsive.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const css = readFileSync(require.resolve('../css/style.css'), 'utf8');
const app = readFileSync(require.resolve('../js/app.js'), 'utf8');
const html = readFileSync(require.resolve('../index.html'), 'utf8');

test('CSS and JavaScript use the same compact-device breakpoint', () => {
  assert.match(css, /@media\s*\(max-width:\s*980px\)/);
  assert.match(app, /matchMedia\('\(max-width: 980px\)'\)/);
  assert.match(app, /matchMedia\('\(min-width: 981px\)'\)/);
  assert.doesNotMatch(app, /matchMedia\('\(max-width: 880px\)'\)/);
  assert.doesNotMatch(app, /matchMedia\('\(min-width: 881px\)'\)/);
});

test('the canvas captures pointers for every tool', () => {
  assert.match(app, /screen\.addEventListener\('pointerdown', function \(e\) \{\s*\/\*[\s\S]*?screen\.setPointerCapture\(e\.pointerId\)/);
});

test('a pinch transition finishes the active single-pointer gesture', () => {
  assert.match(app, /function beginPinch\(\) \{[\s\S]*?if \(S\.drag \|\| S\.panning\) onUp\(\);[\s\S]*?pinchStart = \{/);
  assert.doesNotMatch(app, /function beginPinch\(\) \{[\s\S]*?S\.drag = null;/);
});

test('pointer cancellation removes the pointer and closes the active gesture', () => {
  assert.match(app, /screen\.addEventListener\('pointercancel', function \(e\) \{\s*endPointer\(e\);\s*\/\*[\s\S]*?onUp\(\);\s*\}\);/);
});

test('the compact inspector handle is a keyboard-accessible button', () => {
  assert.match(html, /<button type="button" class="sheet-grab" id="sheet-grab" aria-label="Toggle editor panel" aria-controls="sheet-body" aria-expanded="false"><\/button>/);
  assert.match(css, /\.sheet-grab\s*\{[^}]*min-height:\s*44px;/);
  assert.match(app, /handle\.setAttribute\('aria-expanded', 'true'\)/);
  assert.match(app, /handle\.setAttribute\('aria-expanded', 'false'\)/);
});
