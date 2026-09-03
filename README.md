# idphoto-kit

**Free, private ID photo tool.** Resize any photo to the exact pixel spec and exact KB limit a registration system demands — entirely inside your browser. **No uploads, no server, no watermark, no tracking, no fees.**

> Live at **https://w1977-0.github.io/idphoto-kit/**

## Why

Registration forms are picky in ways photo editors aren't:

- **Exact pixels.** A Chinese 一寸 is 295×413 — not "about 25×35mm at 300dpi". Several official specs don't match their mm derivation at all (US visa: 51×51mm derives to 602×602 @300dpi, but the form wants exactly **600×600**; Chinese ID card uses 358×441, not the mm-derived 378×307). The spec table stores **official pixel counts** as the source of truth; mm are display-only.
- **Exact file size.** Many Chinese systems cap uploads at 10–30KB; India's visa wants 10–300KB both-sided. The tool bisects over the real JPEG encoder's quality parameter (9 rounds ≈ 0.002 quality precision) to hit the largest file that fits — and tells you honestly when a cap is unreachable instead of faking bytes.
- **Background colour.** 白底 ↔ 浅蓝 ↔ 红底 swap for the specs that demand it, with a feathered edge so hair survives.

## Privacy

Your photo never leaves the page: decoding, cropping, resampling, background replacement and JPEG encoding all happen in the browser (`createImageBitmap` + `canvas.toBlob`). The page loads zero external resources and contains no analytics of any kind — not even a counter.

## How it works

```
photo → crop (spec aspect + head guide bands) → high-quality resample to exact pixels
      → rule-based background swap (corner-sampled colour distance + feathered edge)
      → JPEG quality bisection against the real encoder → preview with actual KB → download
```

`idmath.js` is the testable core (pure functions, dual-environment): the spec table, crop geometry, colour-distance background replacement, and the KB-targeting bisection. `test/idmath.test.js` pins all of it with Node's built-in runner, including the four "trap specs" whose pixels disagree with mm math:

```
node --test test/idmath.test.js
```

## Specs included

中国一寸/二寸/小一寸/小二寸 · 身份证 · 出入境(≤30KB) · 考研报名(10–30KB) · 机动车驾驶证 · 美签 DS-160(600×600, ≤240KB) · 欧盟/英国签证(413×531) · 印度签证(10–300KB) · 自定义像素.

## License

MIT
