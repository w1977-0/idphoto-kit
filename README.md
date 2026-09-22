# idphoto-kit

**Free, private ID photo tool.** Resize any photo to the exact pixel spec and exact KB limit a registration system demands — entirely inside your browser. **No uploads, no server, no watermark, no tracking, no fees.**

> **中文** — 免费证件照制作工具:一寸/二寸/签证/身份证照片,精确到像素与 KB,可换底色;照片不上传,全程浏览器本地处理,无水印无统计。在线使用:**[idphoto-kit](https://w1977-0.github.io/idphoto-kit/)**
>
> **日本語** — 無料の証明写真ツール(パスポート写真・ビザ写真・免許証・履歴書用写真に対応)。規定のピクセルとファイルサイズ(KB)に正確にリサイズし、背景色(白・ライトブルー)の変更もできます。写真はサーバーにアップロードされず、すべてブラウザ内だけで処理されます。ウォーターマークなし・登録不要・完全無料。オープンソース。**[使ってみる](https://w1977-0.github.io/idphoto-kit/)**

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

## Browser support

Any current Chrome, Edge, Firefox or Safari — desktop or mobile. Nothing is uploaded and nothing is cached: reload the page and your photo is gone. Files are decoded and encoded locally, so a very large source photo is limited by the device, not by this page.

## What it does not do

- **No guarantee of acceptance.** The spec table is checked against published requirements, and four of its entries deliberately keep the official pixel counts rather than the millimetre conversion — but the receiving authority is the one that decides. When a form disagrees with a preset, trust the form and use the custom pixel option.
- **No face detection or auto-crop.** Crop position and the head guide are yours to adjust; the page does not try to find the face.
- **No background matting.** Replacement is corner-sampled colour distance with a feathered edge — good on plain, evenly lit backdrops, not a substitute for a cutout on a busy one.

## Specs included

中国一寸/二寸/小一寸/小二寸 · 身份证 · 出入境(≤30KB) · 考研报名(10–30KB) · 机动车驾驶证 · 美签 DS-160(600×600, ≤240KB) · 欧盟/英国签证(413×531) · 日本証明写真(35×45mm, 480×660) · 印度签证(10–300KB) · 自定义像素.

Search keywords: 证件照制作 · 免费证件照 · 签证照片尺寸 · ID photo maker · passport photo tool · 証明写真 作り方 · パスポート写真 サイズ · 証明写真 無料 · 履歴書 写真 サイズ · 免許証 写真.

## License

MIT
