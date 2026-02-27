# 近期修改測試指南

**前提**：在專案目錄執行 `npm start`，瀏覽器開啟 **http://localhost:3000**

---

## 1. 聯絡我們只在頁底、頂部選單沒有

| 項目 | 路徑 | 預期 |
|------|------|------|
| 頂部導覽 | 任意有 header 的頁面 | 導覽列**沒有**「聯絡我們」連結 |
| 頁底 | 同上，捲到最下面 | 頁底有「聯絡我們」連結，點擊可到聯絡頁 |
| 聯絡頁 | http://localhost:3000/contact.html | 可正常開啟（若專案有該頁） |

**建議測試頁**：首頁、發案控制台、專家控制台、我的專案、我的報價。

---

## 2. 帳號選單 vs 我的功能 差異 + 每頁都顯示

| 項目 | 路徑 | 預期 |
|------|------|------|
| 已登入桌面版 | 任意頁面（如首頁） | 右側有頭像+姓名下拉，點開標題為「帳號與設定」；左側有「我的功能」下拉，標題為「工作入口（專家／發案／客製）」 |
| 已登入手機版 | 同上，把視窗縮窄或用手機 | 點漢堡選單，**下方**會出現登入按鈕或頭像+帳號選單，不會消失 |
| 未登入 | 同上 | 頂部有「登入」按鈕（桌面在右側，手機在收合選單內） |

**建議測試頁**：  
http://localhost:3000/client/dashboard.html  
http://localhost:3000/expert/dashboard.html  
http://localhost:3000/client/my-projects.html  
http://localhost:3000/expert/my-listings.html  

---

## 3. 發包廠商能看到承包商作品（媒合專家卡片）

| 項目 | 路徑 | 預期 |
|------|------|------|
| 專案詳情（已媒合） | http://localhost:3000/client/project-detail.html?project_id=**某專案ID** | 在「媒合廠商」區塊，每位專家卡片下方有「**承包商作品**」：本報價媒體（圖/YouTube/嵌入）+ 專家作品集縮圖 |
| 查看專家自介 | 同上，點專家卡片的「查看專家自介」 | 開啟專家自介頁，顯示該專家姓名、自介、聯絡方式、作品集 |

**取得 project_id**：先登入發案帳號 → 我的專案 → 點某專案進入詳情，網址的 `project_id=xxx` 即為 ID。

---

## 4. 專家自介頁 + 聯絡方式不限 Email

| 項目 | 路徑 | 預期 |
|------|------|------|
| 專家自介頁（直接開） | http://localhost:3000/expert/profile-view.html?expert_id=**某專家UUID** | 顯示該專家：頭像、姓名、自介、聯絡方式（電話/手機/Email/LINE/網站等）、作品集 |
| 聯絡方式 | 同上 | 若有填寫且勾選公開，會顯示電話、手機、Email、LINE 等，不只 Email |

**取得 expert_id**：從專案詳情媒合專家卡片的「查看專家自介」連結點進去，網址會帶 `expert_id=xxx`；或從 API/DB 查該專家的 user id。

---

## 5. 頁底「聯絡我們」有出現的頁面一覽

以下頁面捲到底應看到「聯絡我們」：

- http://localhost:3000/client/dashboard.html（由 site-footer.js 注入）
- http://localhost:3000/iStudio-1.0.0/index.html（由 partials/footer 提供)
- http://localhost:3000/expert/dashboard.html
- http://localhost:3000/expert/my-listings.html
- http://localhost:3000/expert/my-portfolio.html
- http://localhost:3000/expert/browse-projects.html
- http://localhost:3000/expert/matched-projects.html
- http://localhost:3000/expert/listing-form.html
- http://localhost:3000/expert/profile-view.html?expert_id=xxx
- http://localhost:3000/client/my-projects.html

---

## 快速檢查清單

1. [ ] 頂部沒有「聯絡我們」，頁底有  
2. [ ] 桌面版：右側帳號選單、左側「我的功能」都有，標題不同  
3. [ ] 手機版：漢堡選單展開後有登入/帳號區塊  
4. [ ] 專案詳情（已媒合）有「承包商作品」與「查看專家自介」  
5. [ ] 專家自介頁可開啟，聯絡方式含電話/手機/LINE（若有填且公開）

---

## 若 API 或 DB 尚未就緒

- **listings 媒體欄位**：若後端報錯 `column "youtube_urls" does not exist`，請在 Supabase 執行 `docs/add-listings-media-fields.sql`。
- **專家作品集**：需有 `expert_portfolio` 表，執行 `docs/expert-portfolio-schema.sql`。
- **登入**：需有 Supabase Auth 與 `/config/auth-config.js`，未登入時部分頁面會導向登入頁。
