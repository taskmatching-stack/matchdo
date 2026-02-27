# 雲端部署（Zeabur / GCP Cloud Run）

本檔含兩種方式：**方案一 Zeabur**、**方案二 GCP Cloud Run**（建議有 GCP 免費額度時用，push 到 GitHub 可設自動部署）。程式碼先放到 GitHub 是共用的第一步。

---

## 步驟 1：程式碼推到 GitHub（兩種方案共用）

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

## 方案一：Zeabur

### 步驟 2：Zeabur 建立服務

1. 到 [Zeabur](https://zeabur.com) 用 **GitHub** 登入
2. **建立專案** → **從 GitHub 匯入** → 選剛建立的 `ai-matching` 倉庫
3. 匯入後選 **Web Service** / **Node.js**，設定：
   - **根目錄**：留空  
   - **建置指令**：留空或 `npm install`  
   - **啟動指令**：填 **`npm start`**
4. 儲存後 Zeabur 會開始建置（先不用管有沒有錯誤，下一步設完 env 會重部署）

---

### 步驟 3：在 Zeabur 設定環境變數（必做）

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

### 步驟 4：部署後必做

1. **Supabase 網址**  
   Supabase → **Authentication** → **URL Configuration**  
   把 **Site URL**、**Redirect URLs** 加上你的 Zeabur 網址（例如 `https://ai-matching-xxxx.zeabur.app`）。

2. **開網站**  
   用 Zeabur 給的網址開首頁、試登入、試生圖，有問題看 Zeabur 的 **Logs**。

---

### 之後要更新（Zeabur）

本機改完後 `git add .` → `git commit -m "說明"` → `git push origin main`，Zeabur 會自動重新部署。

---

## 方案二：GCP Cloud Run

適合已有 GCP 帳號、想用免費額度；本專案為無狀態（Session／資料在 Supabase），可跑在 Cloud Run。第一次手動部署一次，之後可設「push 到 GitHub 就自動部署」。

**說明**：下面寫的 `gcloud` 指令都是在**你電腦的終端機**執行，不是專案裡某個腳本。

### 前置：在你電腦安裝 gcloud（與本專案無關）

**gcloud** 是 Google 出的指令列工具，要裝在**你自己的電腦**上，用來下指令給 GCP；**專案裡沒有附**，也不會出現在 `package.json`。

1. **下載安裝**：到 [Google Cloud SDK 安裝頁](https://cloud.google.com/sdk/docs/install)，選你的作業系統，照步驟裝好。裝完在終端機打 `gcloud --version` 有版本就代表成功。
2. **登入 GCP**：終端機執行 `gcloud auth login`，會開瀏覽器讓你用 Google 帳號登入。
3. **選定專案**：`gcloud config set project 你的專案ID`。專案 ID 在 [GCP 主控台](https://console.cloud.google.com) 左上專案名稱旁可查。

### 第一次：手動部署到 Cloud Run

在專案資料夾（有 `server.js` 的那一層）執行：

```bash
gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --set-env-vars "NODE_ENV=production"
```

- 會自動偵測 Node.js、build、部署。第一次會問是否啟用 Cloud Build 等 API，選 Y。
- 環境變數若很多，改用 `--set-env-vars "KEY1=val1,KEY2=val2"` 或之後到 **Cloud Run → 該服務 → 編輯與部署新修訂版本 → 變數與密碼** 裡加。

**必設環境變數**（同方案一）：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`BFL_API_KEY`、`BASE_URL`（部署完成後填 Cloud Run 網址）等，可在 Console 該服務的「變數與密碼」一筆筆加。

部署完成後會給一個網址（例如 `https://matchdo-xxxxx-an.a.run.app`）。到 **Supabase → Authentication → URL Configuration** 把此網址加入 **Site URL**、**Redirect URLs**。

**建置失敗時看紀錄**：gcloud 失敗時給的連結常把 `....failed` 印在網址同一行，直接點會變成「專案 ID 含有無效字元」。請**手動**把網址改成只到 `?project=你的專案編號` 為止（例如 `?project=711548469572`），不要包含 `]....failed`。或改用指令看 log：`gcloud builds list --region=asia-northeast1 --limit=1 --format="value(id)"` 取得建置 ID，再執行 `gcloud builds log 建置ID --region=asia-northeast1`。

### 之後更新：設定 push 到 GitHub 就自動部署

1. 在 GCP 左側選 **Cloud Build** → **觸發條件** → **建立觸發條件**。
2. **來源**：選 **GitHub（第 2 代）**，連動你的 `taskmatching-stack/matchdo`（若尚未連線先授權 GitHub）。
3. **分支**：`^main$`（或你要觸發的分支）。
4. **設定**：類型選 **Cloud Run**，區域選 `asia-northeast1`，服務名稱填 `matchdo`（與上面 `gcloud run deploy` 的服務名一致）。
5. 儲存後，之後只要 `git push origin main`，Cloud Build 會自動 build 並部署到 Cloud Run，不用再手動跑 `gcloud run deploy`。

### 之後要更新（Cloud Run + 觸發條件）

本機改完後：

```bash
git add .
git commit -m "說明變更"
git push origin main
```

若有照上面設好觸發條件，push 後會自動部署；到 **Cloud Build → 記錄** 可看建置與部署狀態。

---

**其他**：若不用 Zeabur 也不用地區用 GCP，可用 Render（見 `docs/deploy-github-vercel.md`）；本專案為 Node + Express，不建議用 Vercel。
