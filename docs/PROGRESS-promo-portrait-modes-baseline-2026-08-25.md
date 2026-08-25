# 人像生成風格基準（凍結）

**凍結日：** 2026-08-25  
**品質基準 commit：** `8b998fe`（清晰／氛圍可用；混合 BETA；Banana 邊緣過渡）  
**說明：** 此後「不要把氛圍／混合品質改壞」。草稿／場景底圖僅管理員可見、入庫，是基準之後的產品規則。

## 三模式（勿混）

| 模式 | 流程 |
|------|------|
| **清晰** | Gemini 一次出圖（含攝影參數） |
| **氛圍** | 草稿（後台 `gemini_model_promo_portrait_mood`，勿用 Lite 畫相機）→ FLUX 重拍（完整光學／底片；不要暗角） |
| **混合** | FLUX 空景 → Banana 放人（可帶同一組 fragment 對齊光） |

前台混合有 **BETA**。草稿／場景底圖對照：僅管理員。

相關：`.cursor/rules/promo-camera-app-isolation.mdc`（勿改線上 PWA 殼）。  
包 App 缺口：[`PROGRESS-promo-camera-app-store.md`](PROGRESS-promo-camera-app-store.md) **§9**。
