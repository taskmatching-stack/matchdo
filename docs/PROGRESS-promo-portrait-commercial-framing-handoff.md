# 人像商用構圖防護 — 交接（2026-09-12）

**接續開發從此看。** 新視窗請先讀本檔。

## 鎖定（依原圖、空描述 — 使用者實際用法）

**成功實例：** 2026-09-12 01:46:47（`promo_camera_web` · `portrait_lifestyle` · `livingroom` · 依原圖 · 無描述）。  
詞序必須對齊該筆，不要把商用構圖塞回服裝 lead。

```
Keep the main garment… User description may adjust…
Shoot theme: … Scene: …
Pose follows the shoot theme…
Commercial lifestyle portrait only: tasteful framing and a non-sexualized mood.
Do not copy erotic or suggestive composition from reference image 1;
reframe as a clean brand-safe portrait while keeping the same garment.
（相機參數）
```

- 道具句已拿掉；**不要**改 prompt 再送、不要自動切依場景
- 清晰人像：Interactions 若 400，**同一句**改走 generateContent（不是換詞）
- 有填描述時：商用句在 `Styling and details:` **之前**（不要貼在描述後面）
- 依場景不要加這段英文 erotic 句（18:45 成功紀錄也沒有）
