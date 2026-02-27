# Zeabur + GitHub 部署（一條龍步驟）

照下面 **1 → 2 → 3 → 4** 依序做，做完就能在網路上開站。

---

## 步驟 1：程式碼推到 GitHub

1. 到 [GitHub](https://github.com) 登入 → 右上 **+** → **New repository**
2. 名稱填 `ai-matching`，**不要**勾 Add a README → **Create repository**
3. 在本機專案資料夾（有 `server.js`、`package.json` 的那一層）開終端機，執行：

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的帳號/ai-matching.git
git branch -M main
git push -u origin main
```

（登入若問密碼，用 GitHub 的 **Personal Access Token** 當密碼。）

---

## 步驟 2：Zeabur 建立服務

1. 到 [Zeabur](https://zeabur.com) 用 **GitHub** 登入
2. **建立專案** → **從 GitHub 匯入** → 選剛建立的 `ai-matching` 倉庫
3. 匯入後選 **Web Service** / **Node.js**，設定：
   - **根目錄**：留空  
   - **建置指令**：留空或 `npm install`  
   - **啟動指令**：填 **`npm start`**
4. 儲存後 Zeabur 會開始建置（先不用管有沒有錯誤，下一步設完 env 會重部署）

---

## 步驟 3：在 Zeabur 設定環境變數（必做）

雲端沒有你電腦的 `.env`，**一定要在 Zeabur 手動加**，否則網站會開不起來或登入／生圖失敗。

1. 在 Zeabur 點進你的 **Service（ai-matching）** → **設定** → **Variables / 環境變數**
2. 點 **新增**，依下面表格**一筆一筆**加（名稱與值照你本機 `.env` 填）：

| 變數名稱 | 必填 | 值（範例） |
|----------|------|------------|
| `NODE_ENV` | 建議 | `production` |
| `SUPABASE_URL` | ✅ | `https://你的專案.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 從 Supabase 後台複製的 service role key |
| `BFL_API_KEY` | ✅（要生圖） | 你的 BFL / FLUX API key |
| `BASE_URL` | 建議 | 部署後填 Zeabur 網址，例：`https://ai-matching-xxxx.zeabur.app` |
| `STABILITY_API_KEY` | 選填 | 我的 AI 編輯區（去背、放大等）用 |
| `GEMINI_API_KEY` | 選填 | 首頁 AI 識別、分析用 |
| `ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV` | 金流時 | 綠界申請後再填 |

3. 儲存後 Zeabur 會自動重新部署；等部署完成。

---

## 步驟 4：部署後必做

1. **Supabase 網址**  
   Supabase → **Authentication** → **URL Configuration**  
   把 **Site URL**、**Redirect URLs** 加上你的 Zeabur 網址（例如 `https://ai-matching-xxxx.zeabur.app`）。

2. **開網站**  
   用 Zeabur 給的網址開首頁、試登入、試生圖，有問題看 Zeabur 的 **Logs**。

---

## 之後要更新程式

本機改完後：

```bash
git add .
git commit -m "說明變更"
git push origin main
```

Zeabur 會自動重新建置與部署，不用再設一次 env。

---

**替代方案**：若不用 Zeabur，可用 Render（見 `docs/deploy-github-vercel.md`）；本專案為 Node + Express 常駐服務，不建議用 Vercel。
