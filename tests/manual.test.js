const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const manual = readFileSync(require.resolve('../docs/NIRBHAR_MANUAL.md'), 'utf8');
const english = manual.split('## English')[1].split('## हिन्दी')[0];
const hindi = manual.split('## हिन्दी')[1];

const tools = [
  'Cut', 'Clear', 'Zoom', 'Tone', 'Tile', 'Pal', 'Paper',
  'Sheet', 'Vector', 'Art', 'ID', 'Collage', 'Seal', 'Batch',
  'Pixel', 'Glow', 'Motion', 'Grid'
];

test('English and Hindi manuals document all eighteen Nirbhar tools', () => {
  assert.ok(hindi, 'Hindi manual section exists');
  assert.match(hindi, /### अठारह टूल्स/);
  for (const name of tools) {
    assert.match(english, new RegExp('^### .*Nirbhar ' + name + '(?:\\s|—)', 'm'), 'English manual: ' + name);
    assert.match(hindi, new RegExp('^### .*Nirbhar ' + name + '(?:\\s|—)', 'm'), 'Hindi manual: ' + name);
  }
});

test('Hindi collage section has useful instructions and is not an empty placeholder', () => {
  const match = hindi.match(/### ▥ Nirbhar Collage — Photo grid([\s\S]*?)(?=\n### |$)/);
  assert.ok(match, 'Hindi collage heading exists');
  assert.ok(match[1].trim().length > 100, 'Hindi collage instructions are present');
  assert.match(match[1], /कॉलम की संख्या/);
  assert.match(match[1], /Whole photo/);
});

/* The four tools added in 1.2 (Pixel, Glow, Motion, Grid) shipped in the engine,
 * the panel and the manual, but the start screen, the structured data and the
 * in-app quick guide still said fourteen. The count is derived from the shipped
 * i18n tool table, so adding a tool without updating the copy fails here.
 */
test('the copy that quotes the tool count agrees with the tools that ship', () => {
  global.window = {};
  require('../js/nirbhar-i18n.js');
  const i18n = global.window.PSNirbharI18N;
  const count = Object.keys(i18n.langs.en.tools).length;
  delete global.window;

  const words = { 14: 'fourteen', 16: 'sixteen', 18: 'eighteen', 20: 'twenty' };
  const word = words[count];
  assert.ok(word, 'there is a word for a count of ' + count);
  assert.ok(count >= 18, 'the toolkit still ships at least eighteen tools');

  const index = readFileSync(require.resolve('../index.html'), 'utf8');
  const app = readFileSync(require.resolve('../js/app.js'), 'utf8');

  assert.match(index, new RegExp(word + ' offline tools'), 'structured data says ' + word);
  assert.match(index, new RegExp('(^|[^0-9])' + count + ' offline tools'), 'start screen says ' + count);
  assert.match(app, new RegExp('The ' + word + ' Nirbhar tools'), 'quick guide says ' + word);

  for (const stale of ['fourteen offline tools', '14 offline tools', 'The fourteen Nirbhar tools']) {
    assert.ok(!index.includes(stale) && !app.includes(stale), 'no stale wording: ' + stale);
  }
});
