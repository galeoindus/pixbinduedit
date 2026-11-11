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


test('pen pressure uses PointerEvent pressure only when enabled for pen input', () => {
  assert.match(app, /function brushForPointer\(e\)/);
  assert.match(app, /e\.pointerType !== 'pen'/);
  assert.match(app, /e\.pressure/);
  assert.match(html, /id="q-pressure"/);
});

test('coalesced pointer samples are processed before a single redraw', () => {
  assert.match(app, /getCoalescedEvents\(\)/);
  assert.match(app, /onMove\(samples\[i\], true\)/);
  assert.match(app, /if \(shouldRender\) render\(\)/);
  const move = app.slice(app.indexOf('function onMove(e'), app.indexOf('function onUp()', app.indexOf('function onMove(e')));
  assert.match(move, /if \(changed && !deferRender\) render\(\)/);
});

test('layer blend modes are validated, rendered and saved with masks', () => {
  assert.match(app, /var BLEND_MODES = \{/);
  assert.match(app, /globalCompositeOperation = BLEND_MODES\[safeBlendMode\(l\.blendMode\)\]/);
  assert.match(app, /blendMode: safeBlendMode\(l\.blendMode\)/);
  assert.match(app, /mask: l\.mask \?/);
  assert.match(html, /id="layer-blend"/);
});

test('editable text has tracking, line-height and alignment controls', () => {
  assert.match(html, /id="text-letter-spacing"/);
  assert.match(html, /id="text-line-height"/);
  assert.match(html, /id="text-align"/);
  assert.match(app, /letterSpacing/);
  assert.match(app, /lineHeight/);
  assert.match(app, /drawTextLine\(ctx, line, x, y, size, curve, strokeWidth, letterSpacing, blockWidth, align\)/);
});

test('objects support flip, centring and keyboard nudging', () => {
  assert.match(html, /data-object-transform="flip-x"/);
  assert.match(html, /data-object-transform="flip-y"/);
  assert.match(app, /function transformSelectedObject\(action\)/);
  assert.match(app, /k === 'arrowleft' \|\| k === 'arrowright'/);
});

test('editable SVG export keeps ordinary text and shapes as vector elements', () => {
  assert.match(html, /id="m-export-svg"/);
  assert.match(app, /function exportSvg\(\)/);
  assert.match(app, /<linearGradient/);
  assert.match(app, /<text data-object=/);
  assert.match(app, /<rect data-object=/);
});

test('autosave falls back to IndexedDB and device profiles cap mobile backing stores', () => {
  assert.match(app, /function openRecoveryDb\(done\)/);
  assert.match(app, /function readAutosave\(done\)/);
  assert.match(app, /RECOVERY_DB/);
  assert.match(app, /budget = coarse \? 8e6 : MAX_BACKING/);
  assert.match(app, /new ResizeObserver/);
});

test('object transform toolbar binds every button without breaking editor boot', () => {
  const binding = app.split('\n').find(line => line.includes("[data-object-transform]"));
  assert.ok(binding, 'transform toolbar binding exists');
  assert.match(binding, /^\s*\$\$\(/, 'uses querySelectorAll helper for all transform controls');
});

test('IndexedDB recovery keeps the previous local autosave until the new write commits', () => {
  const save = app.slice(app.indexOf('function queueAutosave()'), app.indexOf('function exportImage('));
  assert.match(save, /tx\.oncomplete = function \(\) \{[\s\S]*?localStorage\.removeItem\(AUTOSAVE_KEY\)/);
  assert.doesNotMatch(save, /localStorage\.removeItem\(AUTOSAVE_KEY\);[\s\S]*?openRecoveryDb/);
});
