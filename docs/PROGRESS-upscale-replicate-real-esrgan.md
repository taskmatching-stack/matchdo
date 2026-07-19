# AI 放大 → Replicate Real-ESRGAN

**狀態**：✅ 已實作（待 deploy + Cloud Run 設 `REPLICATE_API_TOKEN` + 可選跑 SQL）  
**更新**：2026-07-19  
**API**：[nightmareai/real-esrgan](https://replicate.com/nightmareai/real-esrgan/api)（scale Max 10，見 [learn-more](https://replicate.com/nightmareai/real-esrgan/api/learn-more)）

---

## 行為

| 倍數 | 扣點（2× 基準＝1） |
|------|-------------------|
| 2×（預設） | 1 |
| 4× | 2 |
| 6× | 3 |
| 8× | 4 |
| 10× | 5 |

公式：`points = base + (scale/2 - 1)`；`base` 來自 `points_ai_upscale`／`points_vendor_asset_upscale`（程式預設 1）。

- `face_enhance: false`（產品圖）
- 素材頁：仍僅 &lt;0.5 MP；輸出 ≤1MP
- AI 編輯區：輸出上限 16MP
- **未改**上傳／編輯同格「原圖上／新圖下」結構

---

## 檔案

- `lib/replicate-real-esrgan.js`（新）
- `lib/stability-fast-upscale.js`（內層改呼叫 Replicate）
- `server.js`（僅 upscale 路由／扣點）
- 前端：倍數 `<select>` + 傳 `scale`（`ai-edit`、admin、materials、supplier）
- `public/js/matchdo-upscale-scale.js`
- `docs/set-upscale-points-base-1.sql`（可選覆寫 DB）

---

## 部署前

1. Cloud Run 環境變數：`REPLICATE_API_TOKEN`（與本機 `.env` 相同；勿 commit）
2. 可選：跑 `docs/set-upscale-points-base-1.sql`
3. push 後依 `docs/deploy-matchdo-push-and-deploy.md` §3.1

## 紅線（已遵守）

禁止改動圖庫同格顯示／重繪／寫實化流程；僅放大後端與倍數選單。
