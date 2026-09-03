// test/idmath.test.js — idphoto-kit algorithm tests (Node built-in runner).
//   node --test test/idmath.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const m = require(path.join(__dirname, "..", "idmath.js"));

test("spec table: every spec stores exact official pixels and well-formed fields", () => {
  assert.ok(m.SPECS.length >= 10);
  for (const s of m.SPECS) {
    assert.ok(Array.isArray(s.px) && s.px.length === 2, s.id);
    assert.ok(Number.isInteger(s.px[0]) && Number.isInteger(s.px[1]), s.id + " px must be integers");
    assert.ok(s.px[0] > 20 && s.px[1] > 20, s.id);
    assert.ok(s.px[0] < 4000 && s.px[1] < 4000, s.id);
    assert.ok(s.maxKB === 0 || s.maxKB >= s.minKB, s.id + " KB window inverted");
    for (const hex of s.bg) assert.match(hex, /^#[0-9A-F]{6}$/i, s.id + " bad bg hex");
  }
});

test("trap specs: official pixels do NOT match mm derivation — table keeps the official numbers", () => {
  // These four were found by survey: the mm→px math disagrees with the forms.
  const us = m.specById("us-visa");
  assert.deepEqual(us.px, [600, 600]);
  // 51mm @300dpi derives to 602.36px; the official requirement is 600 —
  // i.e. the spec rounds DOWN to a clean 600 and the table must follow it.
  assert.ok(Math.abs(m.mmToPx(51, 300) - 600) > 2, "mm derivation must not equal the official 600");

  const id = m.specById("cn-idcard");
  assert.deepEqual(id.px, [358, 441]);
  assert.notDeepEqual([Math.round(m.mmToPx(32,300)), Math.round(m.mmToPx(26,300))], id.px);

  const jp = m.specById("jp-general");
  assert.deepEqual(jp.px, [480, 660], "Japanese standard certificate photo 35x45mm");
  const jpp = m.specById("jp-passport");
  assert.deepEqual(jpp.px, [600, 600], "Japanese passport 5x5cm");

  const k = m.specById("cn-exitentry");
  assert.deepEqual(k.px, [390, 567]);
  assert.equal(k.maxKB, 30, "exit-entry has a 30KB cap in the wild");
});

test("conversions round-trip", () => {
  const px = m.mmToPx(35, 300);
  assert.ok(Math.abs(m.pxToMm(px, 300) - 35) < 1e-9);
  assert.equal(Math.round(m.mmToPx(25.4, 300)), 300);
});

test("centeredCrop: exact aspect for landscape and portrait sources", () => {
  // landscape source, portrait target
  let c = m.centeredCrop(4000, 3000, 295, 413);
  assert.ok(Math.abs(c.w / c.h - 295 / 413) < 1e-9, "aspect");
  assert.ok(Math.abs((c.x + c.w / 2) - 2000) < 1e-6, "horizontally centered");
  assert.equal(c.h, 3000);
  // portrait source
  c = m.centeredCrop(1000, 1600, 600, 600);
  assert.ok(Math.abs(c.w - 1000) < 1e-9);
  assert.ok(Math.abs(c.h - 1000) < 1e-9);
  assert.ok(Math.abs((c.y + c.h / 2) - 800) < 1e-6);
  // exactly matching aspect → full frame
  c = m.centeredCrop(295, 413, 295, 413);
  assert.deepEqual([c.x, c.y, c.w, c.h], [0, 0, 295, 413]);
});

test("headGuide: bands are sane for each family", () => {
  const us = m.headGuide("us-visa");
  assert.ok(us.bottomMax > us.bottomMin && us.topMax > us.topMin);
  const cn = m.headGuide("cn-idcard");
  assert.ok(cn.bottomMin > 0.55 && cn.bottomMax < 0.85);
  const generic = m.headGuide("whatever");
  assert.ok(generic.topMin > 0 && generic.topMax < 0.5);
});

test("replaceBackground: flat background swaps cleanly, subject untouched", () => {
  // 4x1 image: [white, white, skin, white]
  const rgba = new Uint8ClampedArray([
    255,255,255,255,  255,255,255,255,  224,172,140,255,  250,250,250,255
  ]);
  m.replaceBackground(rgba, [255,255,255], [0,100,200], { tolerance: 30, feather: 5 });
  assert.deepEqual([...rgba.slice(0,3)], [0,100,200], "corner 1 swapped");
  assert.deepEqual([...rgba.slice(4,7)], [0,100,200], "corner 2 swapped");
  assert.deepEqual([...rgba.slice(8,11)], [224,172,140], "skin untouched");
  assert.deepEqual([...rgba.slice(12,15)], [0,100,200], "near-white swapped within tolerance");
});

test("replaceBackground: soft edge blends instead of hard cut", () => {
  // distance 30 -> inside tol(20)+feather(15): partial blend expected
  const rgba = new Uint8ClampedArray([240, 240, 240, 255]);
  m.replaceBackground(rgba, [255,255,255], [0,0,0], { tolerance: 20, feather: 30 });
  // dist = sqrt(3*15^2) ≈ 25.98 → t = (25.98-20)/30 ≈ 0.199 keep
  const keep = rgba[0] / 240;
  assert.ok(keep > 0.1 && keep < 0.3, "blended proportionally, got keep=" + keep);
});

test("sampleCornerColor: averages the four 3x3 corner patches", () => {
  // 10x10 all white except a red top-left corner block
  const w = 10, h = 10;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const i = (y * w + x) * 4;
    rgba[i] = 200; rgba[i+1] = 30; rgba[i+2] = 30;
  }
  const got = m.sampleCornerColor(rgba, w, h);
  // corners: one red patch (9px) + three white patches (27px) → avg per ch
  const exp = Math.round((200 * 9 + 255 * 27) / 36);
  assert.equal(got[0], exp);
  assert.equal(got[1], Math.round((30 * 9 + 255 * 27) / 36));
});

test("bisectQuality: finds the largest quality under a KB cap", () => {
  // realistic steep model: 4KB at q=0.4 rising to ~36KB at q=0.9
  // (typical for a 295x413 JPEG), crossing the 30KB cap mid-scale.
  const bytesAt = q => Math.round(4096 * Math.pow(9, (q - 0.4) / 0.5));
  const cap = 30 * 1024;
  const r = m.bisectQuality(30, 0, bytesAt);
  assert.equal(r.ok, true);
  assert.ok(r.bytes <= cap, "must fit the cap: " + r.bytes);
  // near-optimal: the next feasible step up (half the final bisection gap)
  // must overshoot, else we left real headroom unused.
  const gap = 0.95 / 512;
  assert.ok(bytesAt(Math.min(1, r.quality + gap)) > cap, "left unused headroom");
});

test("bisectQuality: honours a minimum size (under-min detected)", () => {
  const bytesAt = q => Math.round(500 * Math.pow(1.4, q - 1)); // max ~500B — always under min
  const r = m.bisectQuality(30, 10, bytesAt);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "under-min", "too-small file must be reported, never faked");
});

test("bisectQuality: unreachable cap is reported", () => {
  const bytesAt = () => 5 * 1024 * 1024; // 5MB at every quality
  const r = m.bisectQuality(30, 0, bytesAt);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unreachable");
});

test("hex <-> rgb round trip", () => {
  assert.deepEqual(m.hexToRgb("#FFFFFF"), [255,255,255]);
  assert.deepEqual(m.hexToRgb("#0A141E"), [10,20,30]);
  assert.deepEqual(m.hexToRgb("#F00"), [255,0,0]);
  assert.equal(m.rgbToHex([10,20,30]), "#0a141e");
  assert.equal(m.rgbToHex(m.hexToRgb("#D9E7F5")), "#d9e7f5");
});
