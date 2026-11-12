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
