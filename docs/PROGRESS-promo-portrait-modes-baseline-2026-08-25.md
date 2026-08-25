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

## 人像描述安全審核（2026-08-26）

- **範圍：** 僅人像 generate / batch；產品／空間／規劃模擬不走。
- **時機：** 扣點與生圖前；空描述略過。
- **開關：** 帳號設定 `profiles.promo_portrait_prompt_auto_polish`（預設開，可儲存）。關閉只停自動潤飾；審查攔截仍會跑，不會完全不審查。
- **後台：** 只設審核模型；開關不在 AI 設定。
- **模型：** 後台手填 `gemini_model_promo_portrait_prompt_review`；空白則沿用翻譯模型。不扣點。
- **尺度：** 對齊 Gemini 生圖禁止項與 BFL FLUX Usage Policy。放行成人時裝／泳裝／內衣當服裝、商業親密姿勢。成人全裸／性行為／露性器官才潤飾。未成年任何性化＝硬擋、不改寫。實名公眾人物＋裸露／性化改寫成匿名成人模特。不改主題／場景／鏡頭封裝。
- **失敗：** 審核服務失敗／逾時／空 JSON 重試一次，仍失敗則 503 不生圖、不扣點。
