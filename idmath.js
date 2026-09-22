// idmath.js — idphoto-kit core math. Zero dependencies, browser + Node.
//
// Design rule learned from surveying registration systems: the PIXEL COUNT is
// the first-class citizen of every spec (what upload forms actually validate),
// while mm/dpi are display-only conversions. Several official specs do NOT
// match the mm-to-px derivation (US visa 51mm→602px but requires 600px;
// Chinese ID 32×26mm→378×307px but uses 358×441) — so the spec table stores
// the official pixel numbers and derives nothing.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.idmath = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MM_PER_INCH = 25.4;

  // ---- unit conversions (display-only; never used to drive output size) ----
  function mmToPx(mm, dpi) { return mm / MM_PER_INCH * (dpi || 300); }
  function pxToMm(px, dpi) { return px / (dpi || 300) * MM_PER_INCH; }

  // ---- the spec table: pixels first -----------------------------------
  // minKB/maxKB are the common upload-form constraints (0 = unconstrained).
  var SPECS = [
    { id: "cn-1in",     name: "中国 一寸",   px: [295, 413], mm: [25, 35],  bg: ["#FFFFFF"], minKB: 0, maxKB: 0,  note: "报名/社保最常见" },
    { id: "cn-2in",     name: "中国 二寸",   px: [413, 579], mm: [35, 49],  bg: ["#FFFFFF"], minKB: 0, maxKB: 0,  note: "考试报名常见" },
    { id: "cn-s1in",    name: "中国 小一寸", px: [260, 378], mm: [22, 32],  bg: ["#FFFFFF"], minKB: 0, maxKB: 0,  note: "" },
    { id: "cn-s2in",    name: "中国 小二寸", px: [413, 526], mm: [33, 48],  bg: ["#FFFFFF"], minKB: 0, maxKB: 0,  note: "签证/出入境常用" },
    { id: "cn-idcard",  name: "身份证",      px: [358, 441], mm: [32, 26],  bg: ["#FFFFFF"], minKB: 0, maxKB: 0,  note: "像素与 mm 推导不同,以官方为准" },
    { id: "cn-exitentry", name: "出入境/签证", px: [390, 567], mm: [33, 48], bg: ["#FFFFFF", "#D9E7F5"], minKB: 0, maxKB: 30, note: "白底或浅蓝底" },
    { id: "us-visa",    name: "美国签证 DS-160", px: [600, 600], mm: [51, 51], bg: ["#FFFFFF"], minKB: 0, maxKB: 240, note: "方形,600×600 官方像素" },
    { id: "eu-visa",    name: "欧盟/英国 签证", px: [413, 531], mm: [35, 45], bg: ["#FFFFFF"], minKB: 0, maxKB: 0, note: "35×45mm 标准" },
    { id: "in-visa",    name: "印度 签证",    px: [390, 567], mm: [35, 53],  bg: ["#FFFFFF"], minKB: 10, maxKB: 300, note: "双边大小约束" },
    { id: "cn-kaoyan",  name: "考研报名",    px: [300, 400], mm: [0, 0],    bg: ["#FFFFFF", "#D9E7F5", "#F2C6C6"], minKB: 10, maxKB: 30, note: "10-30KB 严格约束" },
    { id: "cn-sifa",    name: "司法考试",    px: [413, 579], mm: [35, 49], bg: ["#FFFFFF", "#D9E7F5"], minKB: 0, maxKB: 0, note: "" },
    { id: "cn-jichei",  name: "机动车驾驶证", px: [295, 413], mm: [25, 35], bg: ["#FFFFFF"], minKB: 0, maxKB: 0, note: "白底一寸" },
    { id: "jp-general", name: "日本 証明写真", px: [480, 660], mm: [35, 45], bg: ["#FFFFFF"], minKB: 0, maxKB: 0, note: "35×45mm 一般証明書用" },
    { id: "jp-passport", name: "日本 パスポート", px: [600, 600], mm: [45, 45], bg: ["#FFFFFF"], minKB: 0, maxKB: 0, note: "5×5cm(申請書貼付)" }
  ];

  function specById(id) {
    for (var i = 0; i < SPECS.length; i++) if (SPECS[i].id === id) return SPECS[i];
    return null;
  }

  // ---- crop framing ---------------------------------------------------
  // Given a target aspect (w/h) and the source image dims, return the largest
  // centered crop that matches the aspect. The caller can then let the user
  // drag it. Pure math — no DOM.
  function centeredCrop(srcW, srcH, aspectW, aspectH) {
    var srcAspect = srcW / srcH;
    var dstAspect = aspectW / aspectH;
    var w, h;
    if (srcAspect > dstAspect) { h = srcH; w = srcH * dstAspect; }
    else { w = srcW; h = srcW / dstAspect; }
    return {
      x: (srcW - w) / 2,
      y: (srcH - h) / 2,
      w: w,
      h: h
    };
  }

  // Head-size guidance: most systems want the head height between 2/3 and
  // 7/8 of frame height (Chinese ID: ~70%; US visa: 50-69% head, eyes in
  // the 1/2-to-1/3 band). We expose a guide band per spec for the UI to draw.
  function headGuide(specId) {
    switch (specId) {
      case "us-visa":  return { topMin: 0.0625, topMax: 0.25, bottomMin: 0.50, bottomMax: 0.69 };
      case "cn-idcard": return { topMin: 0.08, topMax: 0.20, bottomMin: 0.62, bottomMax: 0.77 };
      default:         return { topMin: 0.08, topMax: 0.22, bottomMin: 0.55, bottomMax: 0.80 };
    }
  }

  // ---- background replacement (rule-based, pure pixel math) -----------
  // Replace pixels whose colour is within `tolerance` of the original
  // background colour with `target`, with a soft edge so hair survives.
  // Works in a single pass over an RGBA buffer. Pure math — testable in Node.
  function replaceBackground(rgba, origRgb, targetRgb, opts) {
    opts = opts || {};
    var tol = opts.tolerance !== undefined ? opts.tolerance : 60;   // 0..441 sqrt(3*255^2)
    var feather = opts.feather !== undefined ? opts.feather : 25;    // soft band width
    var or_ = origRgb[0], og = origRgb[1], ob = origRgb[2];
    var tr = targetRgb[0], tg = targetRgb[1], tb = targetRgb[2];
    for (var i = 0; i < rgba.length; i += 4) {
      var r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      var dr = r - or_, dg = g - og, db = b - ob;
      var dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= tol) {
        rgba[i] = tr; rgba[i + 1] = tg; rgba[i + 2] = tb;
      } else if (dist <= tol + feather) {
        // soft edge: blend toward the target proportionally
        var t = (dist - tol) / feather; // 0..1, 0 = full replacement
        var keep = t;
        rgba[i] = Math.round(keep * r + (1 - keep) * tr);
        rgba[i + 1] = Math.round(keep * g + (1 - keep) * tg);
        rgba[i + 2] = Math.round(keep * b + (1 - keep) * tb);
      }
    }
    return rgba;
  }

  // Sample the dominant corner colour of an RGBA buffer — the usual
  // background of an ID photo. Pure math.
  function sampleCornerColor(rgba, w, h) {
    // average the four corners' 3x3 patches. The right/bottom anchors are
    // clamped and the patch is trimmed, so an image narrower or shorter
    // than 3 px samples what it has instead of reading past the buffer.
    var x1 = Math.max(0, w - 3), y1 = Math.max(0, h - 3);
    var pts = [[0,0],[x1,0],[0,y1],[x1,y1]];
    var r = 0, g = 0, b = 0, n = 0;
    for (var p = 0; p < pts.length; p++) {
      for (var dy = 0; dy < 3; dy++) {
        for (var dx = 0; dx < 3; dx++) {
          var px = pts[p][0] + dx, py = pts[p][1] + dy;
          if (px >= w || py >= h) continue;
          var idx = (py * w + px) * 4;
          r += rgba[idx]; g += rgba[idx + 1]; b += rgba[idx + 2]; n++;
        }
      }
    }
    if (n === 0) return [255, 255, 255];
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }

  // ---- JPEG size targeting (bisection over quality) -------------------
  // `blobSizeAt(quality)` must return the byte size of the encoded JPEG at
  // that quality (0..1). We bisect to the highest quality that fits maxKB,
  // and verify minKB is met (a too-small file means resolution is too low —
  // report it, we never pad bytes into a JPEG).
  function bisectQuality(maxKB, minKB, blobSizeAt, opts) {
    opts = opts || {};
    var maxBytes = maxKB > 0 ? maxKB * 1024 : Infinity;
    var minBytes = minKB > 0 ? minKB * 1024 : 0;
    var lo = 0.05, hi = 1.0;
    var best = null;
    // invariant: size(lo) <= maxBytes (if not, even lowest quality fails)
    for (var i = 0; i < 9; i++) {
      var mid = (lo + hi) / 2;
      var bytes = blobSizeAt(mid);
      if (bytes <= maxBytes) { best = { quality: mid, bytes: bytes }; lo = mid; }
      else hi = mid;
    }
    if (best === null) {
      var floorBytes = blobSizeAt(lo);
      if (floorBytes <= maxBytes) best = { quality: lo, bytes: floorBytes };
      else return { ok: false, reason: "unreachable", quality: lo, bytes: floorBytes };
    }
    if (best.bytes < minBytes) {
      return { ok: false, reason: "under-min", quality: best.quality, bytes: best.bytes };
    }
    return { ok: true, quality: best.quality, bytes: best.bytes };
  }

  // ---- convenience: hex/rgb parsing ------------------------------------
  function hexToRgb(hex) {
    hex = String(hex).replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    // Anything that is not six hex digits is not a colour. Returning null
    // beats returning [NaN, NaN, NaN], which silently poisons every
    // distance comparison downstream.
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  }
  function rgbToHex(rgb) {
    return "#" + rgb.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? "0" + s : s;
    }).join("");
  }

  return {
    SPECS: SPECS,
    specById: specById,
    mmToPx: mmToPx,
    pxToMm: pxToMm,
    centeredCrop: centeredCrop,
    headGuide: headGuide,
    replaceBackground: replaceBackground,
    sampleCornerColor: sampleCornerColor,
    bisectQuality: bisectQuality,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex
  };
});
