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
  assert.match(app, /function openRecoveryDb\(done, name, onlyIfExisting\)/);
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

/* The product has been renamed more than once and its storage names changed with
 * it. A project autosaved before a rename is the user's only copy, so the new
 * names must be read after the old ones, never instead of them. */
test('an autosave written before a rename is still recovered', () => {
  /* The product has been renamed twice. Every earlier storage name has to stay
     readable, newest first, or a project saved before a rename is lost. */
  assert.match(app, /var LEGACY_AUTOSAVE_KEYS = \['pixbindu\.autosave\.v3', 'pixelstudioedit\.autosave\.v3'\]/);
  assert.match(app, /var LEGACY_RECOVERY_DBS = \['pixbindu-recovery', 'pixelstudioedit-recovery'\]/);
  const read = app.slice(app.indexOf('function readAutosave(done)'), app.indexOf('function queueAutosave()'));
  assert.match(read, /localStorage\.getItem\(LEGACY_AUTOSAVE_KEYS\[i\]\)/);
  assert.match(read, /readLegacyRecovery\(done, 0\)/);
  /* a read of an old database must not create an empty one on a fresh machine */
  assert.match(app, /deleteDatabase\(name\)/);
});

test('IndexedDB recovery keeps the previous local autosave until the new write commits', () => {
  const save = app.slice(app.indexOf('function queueAutosave()'), app.indexOf('function exportImage('));
  assert.match(save, /tx\.oncomplete = function \(\) \{[\s\S]*?localStorage\.removeItem\(AUTOSAVE_KEY\)/);
  assert.doesNotMatch(save, /localStorage\.removeItem\(AUTOSAVE_KEY\);[\s\S]*?openRecoveryDb/);
});


test('runtime publishes phone, tablet and desktop profiles with orientation data', () => {
  assert.match(app, /dataset\.deviceProfile = width <= 600 \? 'phone' : \(compact \? 'tablet' : 'desktop'\)/);
  assert.match(app, /dataset\.orientation = width > height \? 'landscape' : 'portrait'/);
  assert.match(app, /setProperty\('--device-width'/);
  assert.match(app, /setProperty\('--device-height'/);
  assert.match(css, /html\[data-device-profile="phone"\]/);
  assert.match(css, /html\[data-device-profile="tablet"\]/);
  assert.match(css, /html\[data-device-profile="desktop"\]/);
});

test('virtual keyboard inset is applied to the compact inspector sheet', () => {
  assert.match(app, /setProperty\('--keyboard-inset'/);
  assert.match(app, /addEventListener\('orientationchange'/);
  assert.match(css, /margin-bottom:\s*var\(--keyboard-inset,\s*0px\)/);
  assert.match(css, /--sheet-open-max/);
  assert.match(css, /--sheet-peek-height/);
});

/* The workspace is a grid with three columns and, until this test existed, no
 * row track. Its implicit `auto` row was sized by the tallest child — the
 * stage, which is document size × zoom — so at 1920×1080 the row measured
 * 1575px inside a 1028px workspace and pushed the status bar and the bottom of
 * the side panel off a viewport that cannot scroll (html/body overflow:hidden).
 * A plain declaration check is enough: the browser then has a definite row to
 * shrink the stage inside. */
test('the workspace declares a bounded row so the stage cannot stretch it', () => {
  const block = css.slice(css.indexOf('.workspace {'), css.indexOf('}', css.indexOf('.workspace {')));
  assert.match(block, /grid-template-rows:\s*minmax\(0,\s*1fr\)/,
    '.workspace needs grid-template-rows: minmax(0, 1fr)');
});

test('the top bar carries the notch inset in --top, not in its own height', () => {
  /* The first grid row of .app is var(--top); if the inset lived only on
     .topbar the bar would be taller than its row and overlap the workspace. */
  assert.match(css, /--top:\s*calc\(52px \+ env\(safe-area-inset-top/);
  assert.match(css, /padding-top:\s*env\(safe-area-inset-top/);
  const block = css.slice(css.indexOf('.topbar {'), css.indexOf('}', css.indexOf('.topbar {')));
  assert.doesNotMatch(block, /^\s*height:/m, '.topbar must not set its own height');
});

test('the app height has a vh fallback before dvh', () => {
  /* Older Safari and Android WebViews drop a declaration they cannot parse,
     which left .app with no height at all. */
  assert.match(css, /height:\s*100vh;\s*\n\s*height:\s*100dvh;/);
});

/* The import path must scale a photo as a whole. Clamping width and height to
 * a maximum independently is what made every large photo arrive squashed —
 * see the fitWithin cases in tests/core.test.js for the measurements. */
test('photo import scales both sides by one factor', () => {
  assert.match(app, /function fitWithin\(w, h, maxSide, maxPixels\)/);
  assert.match(app, /fitWithin\(im\.width, im\.height, MAX_DOC_SIDE, importPixelBudget\(\)\)/);
  assert.match(app, /drawScaled\(layer\.ctx, im, docW, docH\)/);
  /* the old shape of the bug, which must not return */
  assert.doesNotMatch(app, /Math\.min\(2048, Math\.round\(im\.(width|height) \* scale\)\)/);
  assert.doesNotMatch(app, /Math\.min\(2048, Math\.round\(S\.w \* factor\)\)/);
});

test('an imported image is never blown up past 100%', () => {
  assert.match(app, /var sc = Math\.min\(1, S\.w \/ im\.width, S\.h \/ im\.height\)/);
});

test('the checkerboard is not repainted on every pointer move', () => {
  /* render() runs on every pointermove; the background only depends on the
     stage size, the zoom and two toggles, so it is painted per signature. */
  assert.match(app, /var bgSig = ''/);
  assert.match(app, /if \(sig !== bgSig\) \{/);
  const start = app.indexOf('function render()');
  const body = app.slice(start, start + 4000);
  assert.ok(body.indexOf('bgSig') > -1, 'render consults the signature');
});

test('a stroke draws with the cheap filter and the resting frame with the sharp one', () => {
  assert.match(app, /var moving = !!\(S\.strokeActive \|\| S\.drag \|\| S\.panning \|\| S\.preview\)/);
  assert.match(app, /imageSmoothingQuality = \(moving && drawRatio < 0\.9\) \? 'low' : 'high'/);
});

test('the offline shell installs wherever the platform calls the page secure', () => {
  /* The guard used to be `https:` or `localhost`, so a page served from
     127.0.0.1 or [::1] — both of which the platform treats as trustworthy —
     never registered the service worker at all. The rule now follows the
     platform: https, or http inside a secure context. */
  assert.match(app, /location\.protocol === 'https:' \|\| \(location\.protocol === 'http:' && window\.isSecureContext === true\)/);
  assert.doesNotMatch(app, /location\.hostname === 'localhost'/);
  /* file:// reports isSecureContext true, so the protocol check has to stay */
  assert.match(app, /'serviceWorker' in navigator &&/);
});
