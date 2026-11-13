/* Accessibility regression checks for the panels and the dialogs.
 * Run with: node --test tests/a11y.test.js
 *
 * Why this file exists: every panel control in index.html sat next to a
 * `<label>` with no `for` attribute, so the label was decoration rather than a
 * name. Measured in Chromium, 41 of 43 controls had no associated label and the
 * accessibility tree exposed eight sliders and a combobox with an empty name —
 * a screen reader announced "slider" and nothing else. The fix added `for` to
 * the 34 plain labels, `aria-label` to the colour inputs that share a row with
 * another control, and the same treatment to the dialogs app.js builds. This
 * test is what keeps a new control from arriving unnamed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require.resolve('../index.html'), 'utf8');
const app = readFileSync(require.resolve('../js/app.js'), 'utf8');

const CONTROL = /<(input|select|textarea)([^>]*)>/g;

/* Every <label>…</label>, with its attributes and its inner markup. */
function labels(markup) {
  return [...markup.matchAll(/<label([^>]*)>([\s\S]*?)<\/label>/g)].map((m) => ({
    attrs: m[1],
    inner: m[2],
    text: m[2].replace(/<[^>]+>/g, '').trim()
  }));
}

/* Controls a person can reach: not `hidden`, not a hidden input type. */
function controls(markup) {
  const spans = [...markup.matchAll(/<label[^>]*>[\s\S]*?<\/label>/g)]
    .map((m) => [m.index, m.index + m[0].length]);
  return [...markup.matchAll(CONTROL)]
    .map((m) => ({ tag: m[1], attrs: m[2], at: m.index }))
    .filter((c) => !/\bhidden\b/.test(c.attrs) && !/type="hidden"/.test(c.attrs))
    .map((c) => ({
      tag: c.tag,
      attrs: c.attrs,
      id: (c.attrs.match(/\bid="([^"]+)"/) || [])[1] || null,
      ariaLabel: (c.attrs.match(/\baria-label="([^"]+)"/) || [])[1] || null,
      ariaLabelledBy: (c.attrs.match(/\baria-labelledby="([^"]+)"/) || [])[1] || null,
      /* a control wrapped inside a <label> is named by that label */
      wrapped: spans.some(([a, b]) => c.at > a && c.at < b)
    }));
}

test('every label in index.html either has a for or wraps its control', () => {
  const ls = labels(html);
  assert.ok(ls.length >= 30, 'the panels still carry their labels (' + ls.length + ')');
  const ids = new Set(controls(html).map((c) => c.id).filter(Boolean));
  const broken = ls.filter((l) => {
    const forId = (l.attrs.match(/\bfor="([^"]+)"/) || [])[1];
    if (forId) return !ids.has(forId);
    return !/<(input|select|textarea)\b/.test(l.inner);
  });
  assert.deepEqual(broken.map((l) => l.text), [],
    'labels that name nothing (no for= target and no control inside)');
});

test('a for attribute points at exactly one control', () => {
  const ids = controls(html).map((c) => c.id).filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], 'duplicate control ids would make a label ambiguous');
});

test('every visible control in index.html has an accessible name', () => {
  const cs = controls(html);
  assert.ok(cs.length >= 35, 'the panels still carry their controls (' + cs.length + ')');
  const labelTargets = new Set(
    labels(html).map((l) => (l.attrs.match(/\bfor="([^"]+)"/) || [])[1]).filter(Boolean)
  );
  const nameless = cs.filter((c) =>
    !c.ariaLabel && !c.ariaLabelledBy && !c.wrapped && !(c.id && labelTargets.has(c.id))
  );
  assert.deepEqual(nameless.map((c) => c.id || c.tag), [], 'controls with no name');
});

test('the dialog markup app.js builds names its fields too', () => {
  /* the dialogs are strings in app.js, so index.html cannot be checked for them */
  const ls = labels(app);
  assert.ok(ls.length >= 8, 'the dialogs still build their labels (' + ls.length + ')');
  const unassociated = ls.filter((l) => !/\bfor="/.test(l.attrs));
  assert.deepEqual(unassociated.map((l) => l.text), [], 'dialog labels without a for attribute');
});
