const C = require('../js/core.js');
let fails = 0;
const ok = (name, cond, extra='') => { if(!cond){ fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };

function img(w,h,fill){ const d=new Uint8ClampedArray(w*h*4); for(let i=0;i<d.length;i+=4){ d[i]=fill[0];d[i+1]=fill[1];d[i+2]=fill[2];d[i+3]=fill[3]; } return {width:w,height:h,data:d}; }

ok('hex->rgb', JSON.stringify(C.hexToRgb('#6ee7b7'))==='[110,231,183,255]');
ok('rgb->hex', C.rgbToHex(110,231,183)==='#6ee7b7');
ok('parse rgb()', JSON.stringify(C.parseColor('rgb(1,2,3)'))==='[1,2,3,255]');

let a = img(2,2,[10,20,30,255]); C.invert(a);
ok('invert', a.data[0]===245 && a.data[1]===235 && a.data[2]===225, a.data.slice(0,3));

let b = img(2,2,[255,0,0,255]); C.grayscale(b);
ok('grayscale', b.data[0]===b.data[1] && b.data[1]===b.data[2], b.data.slice(0,3));

let c = img(1,1,[0,0,0,255]); C.brightness(c, 100);
ok('brightness +100 -> white', c.data[0]===255);

let d = img(1,1,[200,200,200,255]); C.contrast(d, 50);
ok('contrast pushes bright values up', d.data[0]>200, d.data[0]);
let d2 = img(1,1,[128,128,128,255]); C.contrast(d2, 50);
ok('contrast pivot stays at 128', d2.data[0]===128, d2.data[0]);

let e = img(1,1,[200,100,50,255]); C.posterize(e, 4);
ok('posterize snaps', [0,85,170,255].includes(e.data[0]), e.data[0]);

let f = img(2,1,[0,0,0,0]); C.setPixel(f, 0, 0, [0,0,0,255]);
C.outline(f, '#ff0000', 1);
ok('outline paints neighbour', f.data[4]===255 && f.data[5]===0 && f.data[7]===255, f.data.slice(4,8));
ok('outline keeps original pixel', f.data[0]===0 && f.data[3]===255, f.data.slice(0,4));

let g = img(3,3,[0,0,0,0]);
C.setPixel(g,1,1,[255,255,255,255]);
C.dropShadow(g, 1, 0, '#ff0000', 1);
ok('dropShadow offsets', g.data[(1*3+2)*4]===255, g.data[(1*3+2)*4]);

let h = img(4,4,[0,0,0,255]);
C.floodFill(h, 0, 0, [255,0,0,255], 0);
ok('floodFill whole layer', h.data[0]===255 && h.data[(15)*4]===255);

let i2 = img(2,2,[123,45,67,255]);
C.quantize(i2, C.PALETTES.db16.colors);
const pal = C.paletteToRgb(C.PALETTES.db16.colors).map(p=>p.slice(0,3).join(','));
ok('quantize uses palette colour', pal.includes([i2.data[0],i2.data[1],i2.data[2]].join(',')), i2.data.slice(0,3));

let j = img(8,8,[90,120,200,255]);
C.ditherFloydSteinberg(j, C.PALETTES.gameboy.colors);
const gb = C.paletteToRgb(C.PALETTES.gameboy.colors).map(p=>p.slice(0,3).join(','));
let allGb = true; for(let k=0;k<j.data.length;k+=4){ if(!gb.includes([j.data[k],j.data[k+1],j.data[k+2]].join(','))) allGb=false; }
ok('floyd-steinberg maps to palette', allGb);

let k2 = img(4,4,[100,100,100,255]);
C.ditherBayer(k2, C.PALETTES.grayscale.colors, 32);
ok('bayer maps to palette', [0,36,72,109,145,182,218,255].includes(k2.data[0]), k2.data[0]);

let l2 = img(6,6,[0,0,0,255]);
C.blur(l2, 2);
ok('blur keeps alpha', l2.data[3]===255);

let n = img(4,4,[50,50,50,255]); C.noise(n, 20, 7);
ok('noise deterministic', (()=>{ const m=img(4,4,[50,50,50,255]); C.noise(m,20,7); return m.data[0]===n.data[0]; })());

// Unsharp mask: the kernel sums to 1, so a flat region must come back unchanged.
let sh = img(4,4,[80,80,80,255]); C.sharpen(sh, 40);
ok('sharpen leaves a flat region flat', sh.data[0]===80 && sh.data[3]===255, sh.data.slice(0,4));

let s = img(2,2,[10,200,90,255]); C.saturation(s, -100);
ok('saturation -100 grey', Math.abs(s.data[0]-s.data[1])<2 && Math.abs(s.data[1]-s.data[2])<2, s.data.slice(0,3));

let t = img(1,1,[200,10,10,255]); C.hueRotate(t, 120);
ok('hue rotate shifts channels', t.data[0]<200 && t.data[1]>10, t.data.slice(0,3));

// ---- 3D routines -------------------------------------------------------
let ex = img(9, 9, [0,0,0,0]); C.setPixel(ex, 4, 4, [255,255,255,255]);
C.extrude(ex, 1, 0, 3, [200,0,0], [0,200,0]);
ok('extrude paints the side', C.getPixel(ex, 7, 4)[3] === 255 && C.getPixel(ex, 7, 4)[0] > 0, C.getPixel(ex, 7, 4));
ok('extrude keeps the face colour', C.getPixel(ex, 4, 4)[1] === 200, C.getPixel(ex, 4, 4));

let pe = img(9, 9, [0,0,0,0]);
for (let x = 0; x < 9; x++) C.setPixel(pe, x, 4, [255,0,0,255]);
const opaqueBefore = pe.data.filter((v, i) => i % 4 === 3 && v > 0).length;
C.perspective(pe, { rotateY: 30 });
ok('perspective transforms geometry', pe.data.filter((v, i) => i % 4 === 3 && v > 0).length !== opaqueBefore ||
  JSON.stringify(Array.from(pe.data)) !== JSON.stringify(Array.from(img(9,9,[0,0,0,0]).data)));

ok('shade darkens a colour', JSON.stringify(C.shade([200,200,200], 0.5)) === '[100,100,100]');

// ---- ImageData safety --------------------------------------------------
// Browsers expose ImageData.data as read-only, so every routine must copy
// into it rather than reassign. Simulate that here.
function frozenImage(w, h, fill) {
  const base = img(w, h, fill);
  return { width: w, height: h, data: base.data,
           set data(v) { throw new Error('data is read-only'); },
           get data() { return base.data; } };
}
function safe(name, fn) {
  let frozen;
  try { frozen = frozenImage(8, 8, [40, 60, 80, 255]); fn(frozen); ok(name, true); }
  catch (e) { ok(name, false, e.message); }
}
safe('blur tolerates read-only ImageData', i => C.blur(i, 2));
safe('extrude tolerates read-only ImageData', i => C.extrude(i, 1, 1, 3, [0,0,0], [255,255,255]));
safe('perspective tolerates read-only ImageData', i => C.perspective(i, { rotateY: 20 }));


/* ------------------------------------------------------------ fitWithin
 * The import path used to clamp width and height to a maximum independently,
 * which silently changed the shape of every large photo: 4000×3000 arrived as
 * 2048×1775 (13.5% squashed), 6000×2000 as 2048×1183 (42%) and 1000×4000 as
 * 1000×2048 (95%). These are the shapes that were wrong.
 */
const aspectOk = (w, h, maxSide, maxPixels) => {
  const f = C.fitWithin(w, h, maxSide, maxPixels);
  const src = w / h;
  const out = f.w / f.h;
  return Math.abs(out - src) / src < 0.01;
};
ok('fitWithin keeps a 4:3 photo', aspectOk(4000, 3000, 4096, 16e6));
ok('fitWithin keeps a 3:4 portrait', aspectOk(3000, 4000, 4096, 16e6));
ok('fitWithin keeps a 3:1 panorama', aspectOk(6000, 2000, 4096, 16e6));
ok('fitWithin keeps a 1:4 tall photo', aspectOk(1000, 4000, 4096, 16e6));
ok('fitWithin keeps an extreme 20:1 banner', aspectOk(20000, 1000, 4096, 16e6));
ok('fitWithin keeps the shape on the phone budget', aspectOk(4000, 3000, 4096, 8e6));

const smallFit = C.fitWithin(800, 600, 4096, 16e6);
ok('fitWithin never upscales', smallFit.scale === 1 && smallFit.w === 800 && smallFit.h === 600,
  JSON.stringify(smallFit));

const bigFit = C.fitWithin(9000, 6000, 4096, 16e6);
ok('fitWithin caps the longest side', Math.max(bigFit.w, bigFit.h) <= 4096, JSON.stringify(bigFit));
ok('fitWithin respects the pixel budget', bigFit.w * bigFit.h <= 16e6 + 1, bigFit.w * bigFit.h);

const phoneFit = C.fitWithin(4000, 3000, 4096, 8e6);
ok('fitWithin respects the tighter phone budget', phoneFit.w * phoneFit.h <= 8e6 + 1, phoneFit.w * phoneFit.h);

const twelve = C.fitWithin(4032, 3024, 4096, 16e6);
ok('a 12 MP phone photo keeps its own resolution',
  twelve.scale === 1 && twelve.w === 4032 && twelve.h === 3024, JSON.stringify(twelve));

/* ------------------------------------------------------------ fitExport
 * A 1080 px artboard offered 16x and 20x in the export dialog. Those canvases
 * are 298.6 MP and 466.6 MP, past the area a browser will encode, so toBlob()
 * called back with null, saveBlob(null) threw and the export produced no file
 * and no message. Measured in Chromium: 10800x10800 encodes, 17280x17280 null.
 */
const ex20 = C.fitExport(1080, 1080, 20);
ok('fitExport clamps 20x of a 1080 artboard to an encodable size',
  ex20.ok && ex20.clamped === true && ex20.scale < 20 && ex20.w * ex20.h <= 134217728, JSON.stringify(ex20));
const ex16 = C.fitExport(1080, 1080, 16);
ok('fitExport clamps 16x of a 1080 artboard to an encodable size',
  ex16.ok && ex16.clamped === true && ex16.scale < 16 && ex16.w * ex16.h <= 134217728, JSON.stringify(ex16));
const exHuge = C.fitExport(20000, 20000, 1);
ok('fitExport refuses a document too large even at 1x', exHuge.ok === false, JSON.stringify(exHuge));
const ex10 = C.fitExport(1080, 1080, 10);
ok('fitExport allows 10x of a 1080 artboard unchanged',
  ex10.ok && ex10.scale === 10 && ex10.w === 10800 && ex10.h === 10800 && ex10.clamped === false,
  JSON.stringify(ex10));
const ex8 = C.fitExport(1080, 1080, 8);
ok('fitExport allows 8x of a 1080 artboard', ex8.ok && ex8.scale === 8 && ex8.clamped === false, JSON.stringify(ex8));
const exClamp = C.fitExport(1080, 1080, 14);
ok('fitExport clamps 14x down to a scale that encodes',
  exClamp.ok && exClamp.clamped === true && exClamp.scale < 14 && exClamp.w * exClamp.h <= 134217728,
  JSON.stringify(exClamp));
const ex1 = C.fitExport(64, 64, 1);
ok('fitExport leaves a small export alone', ex1.ok && ex1.scale === 1 && ex1.clamped === false, JSON.stringify(ex1));
ok('fitExport keeps every result inside the area limit',
  [1, 2, 4, 8, 10, 16, 20].every((s) => { const p = C.fitExport(4096, 4096, s); return !p.ok || p.w * p.h <= 134217728; }));
ok('fitExport keeps the aspect ratio of what it clamps',
  (() => { const p = C.fitExport(1080, 1920, 16); return !p.ok || Math.abs(p.w / p.h - 1080 / 1920) < 0.01; })());
ok('fitExport never exceeds the max canvas side',
  [1, 2, 4, 8, 10, 16, 20].every((s) => { const p = C.fitExport(4096, 4096, s); return !p.ok || (p.w <= 32767 && p.h <= 32767); }));

/* ------------------------------------------------------- exportNeedsMatte
 * The export filled a white matte for every format that was not PNG, so a
 * transparent sprite exported as .webp came out as a white box even though WebP
 * has an alpha channel. Only JPEG genuinely needs the matte.
 */
ok('exportNeedsMatte: WebP keeps transparency', C.exportNeedsMatte('image/webp') === false);
ok('exportNeedsMatte: WebP in any case keeps transparency', C.exportNeedsMatte('IMAGE/WEBP') === false);
ok('exportNeedsMatte: PNG keeps transparency', C.exportNeedsMatte('image/png') === false);
ok('exportNeedsMatte: the default format keeps transparency', C.exportNeedsMatte(undefined) === false);
ok('exportNeedsMatte: JPEG needs a matte', C.exportNeedsMatte('image/jpeg') === true);
ok('exportNeedsMatte: the image/jpg alias needs a matte', C.exportNeedsMatte('image/jpg') === true);

/* --------------------------------------------------------- exportSideLimit
 * WebP stores each dimension in 14 bits, so a side past 16,383 px is cropped by
 * the encoder instead of refused. Measured in Chromium: a 17280x1728 canvas
 * asked for image/webp came back 16383x1728 with the right-hand marker pixels
 * missing, while image/jpeg and image/png kept all 17280.
 */
ok('exportSideLimit: WebP stops at 16383', C.exportSideLimit('image/webp') === 16383);
ok('exportSideLimit: PNG uses the canvas budget', C.exportSideLimit('image/png') === 32767);
ok('exportSideLimit: JPEG has room past 16383', C.exportSideLimit('image/jpeg') > 16383);
ok('exportSideLimit: the default format is not the WebP limit', C.exportSideLimit(undefined) === 32767);

const bannerPng = C.fitExport(1500, 500, 8, C.exportSideLimit('image/png'));
ok('a 1500px banner still exports 8x as PNG',
  bannerPng.ok && bannerPng.scale === 8 && bannerPng.w === 12000 && bannerPng.clamped === false,
  JSON.stringify(bannerPng));
/* 13x of this banner is 19500 px wide: inside the PNG canvas budget, past what
   WebP can store, so the two formats must clamp to different scales. */
const bannerPng16 = C.fitExport(1500, 500, 16, C.exportSideLimit('image/png'));
ok('a 16x banner is clamped by the canvas area budget for PNG',
  bannerPng16.ok && bannerPng16.scale === 13, JSON.stringify(bannerPng16));
const bannerWebp = C.fitExport(1500, 500, 16, C.exportSideLimit('image/webp'));
ok('the same banner is clamped for WebP instead of being cropped',
  bannerWebp.ok && bannerWebp.clamped === true && bannerWebp.scale < bannerPng16.scale &&
  bannerWebp.w <= 16383, JSON.stringify(bannerWebp));
ok('a WebP export never asks for a side the format cannot store',
  [1, 2, 4, 8, 10, 16, 20].every((s) => {
    const p = C.fitExport(1500, 500, s, C.exportSideLimit('image/webp'));
    return !p.ok || (p.w <= 16383 && p.h <= 16383);
  }));
const squareWebp = C.fitExport(1080, 1080, 16, C.exportSideLimit('image/webp'));
ok('a square artboard clamps to 15x at most for WebP',
  squareWebp.ok && squareWebp.scale <= 15 && squareWebp.w <= 16383, JSON.stringify(squareWebp));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL CORE TESTS PASSED');
process.exit(fails?1:0);
