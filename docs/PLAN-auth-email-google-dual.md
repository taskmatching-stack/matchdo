# 登入：Google 與 Email＋密碼並存；驗證與忘記密碼

**日期**：2026-09-03  
**原則**：同一個帳號可同時用 **Google** 與 **Email＋密碼**。不是把 Google 改成密碼登入。

---

## 已實作（本輪）

| 項目 | 做法 |
|------|------|
| 並存 | 用 Google 註冊的人，到 **帳號資訊** 設定密碼後，兩種都能登；Google 不會被拿掉 |
| 忘記密碼 | 登入頁「忘記密碼？」寄信 → `/reset-password.html` 設新密碼（Google 帳號也可藉此**補設**密碼） |
| Email 註冊 | 註冊頁除 Google 外可填 Email＋密碼 |
| 後台建帳 | 本來就是 `email_confirm: true`，不需驗證信 |

**你現在要在本地登自己的帳號：**

1. 先用線上（或 Google OAuth 可用的環境）**Google 登入**  
2. 開 `/profile/account.html` → **儲存密碼**  
3. 之後本地用同一個 Email＋剛設的密碼即可登入（Google 仍可登）

或登入頁點「忘記密碼」，用該 Email 收信設密碼（Supabase 須允許此 Redirect）。

**Supabase Dashboard 請加入 Redirect URLs：**

- `https://matchdo.cc/auth-callback.html`
- `https://matchdo.cc/reset-password.html`
- 本機：`http://localhost:<埠>/auth-callback.html` 與 `.../reset-password.html`  
  （埠以你實際跑 `server.js` 為準）

本機若也要直接按 Google 登入，Redirect 必須含本機 callback，否則只能走「已設好的 Email＋密碼」。

---

## Email 驗證（規劃，尚未改 Supabase 開關）

| 註冊途徑 | 建議 |
|----------|------|
| 使用者 Email 註冊 | 可開「Confirm email」；未驗證不能 `signInWithPassword`（登入頁已提示） |
| Google | 信箱已由 Google 驗證，**不必**再寄站內驗證信 |
| 管理員後台建立 | **維持** `email_confirm: true`，不寄驗證 |

若開啟 Confirm email：確認信 `emailRedirectTo` 已指到 `/auth-callback.html`。

---

## 說明頁連結（前台放哪）

完整 CMS 尚未做；**入口已接到現有** `/help/`：

| 位置 | 狀態 |
|------|------|
| 頁尾「使用說明」 | 原本就有 |
| 頭像選單（方案與定價下方） | 本輪已加「操作介紹」 |
| 我的功能最下方 | 本輪已加「操作介紹」 |
| 各工具標題旁深鏈、首頁一句 | 等操作介紹 CMS 後再掛獨立篇網址 |
