# 廠商搜尋「開放訂製稿」頁面規劃

> 日期：2026-08-06  
> 狀態：**規劃定案用**（尚未大改 UI）  
> 性質：製造商後台工具（**noindex**），非公開 SEO 目錄

---

## 1. 產品一句話

製造商依**自己承接的分類**，瀏覽訂製者已開啟「開放廠商搜尋」的設計稿，再**主動聯絡設計者**洽談（平台不代報價、不介入成交）。

與設計者側對稱：

| 角色 | 動作 |
|------|------|
| 設計者 | 我的數位資產 → 開啟「開放廠商搜尋」／「完成訂製」（關閉搜尋且不可復原） |
| 製造商 | 本頁搜尋開放中稿 → 開詳情／聯絡 |

---

## 2. 現況（已有，勿重造輪子）

| 項目 | 現況 |
|------|------|
| API | `GET /api/custom-products/for-makers?category_key=&subcategory_key=&page=&per_page=`（需登入；只回 `open_for_manufacturing=true` 且 `manufacturing_status=open`） |
| 開關 API | `PATCH /api/custom-products/:id/manufacturing`（設計者） |
| 頁面 | `client/demands.html`（由 `/client` static 提供）；選單「訂製需求」、廠商控制台入口已有 |
| 舊頁 | `manufacturer-inquiries.html` → 已導向聯絡方式設定，**不要**再當接案列表 |
| SEO | **必須 noindex**（已在 `CLIENT_NOINDEX_EXACT`）；**不進 sitemap** |

注意：`architecture-and-seo-principles.md` 曾把 `demands.html` 標成「已廢」——**與現產品不符**（控制台仍主推接案）。規劃以「**現行接案工具、待升級**」為準。

---

## 3. 建議 URL／檔案（定案）

| 項目 | 建議 |
|------|------|
| **正式 path** | 維持 **`/client/demands.html`**（選單／控制台已鏈此；少改 301） |
| **顯示名稱** | 「搜尋開放訂製稿」或保留「訂製需求（接案）」— 實作時與選單 `nav.demands` 對齊文案 |
| **主檔位置** | 升級時搬到 **`public/client/demands.html`**（與其他製造商頁一致；根目錄 `client/` 留 redirect 或刪除避免雙份） |
| **公開靈感** | 單件若已上首頁，可另有 `/inspiration/user_design/{id}`；**本列表本身不公開爬** |

---

## 4. 頁面資訊架構（一頁一職）

1. **篩選列**：主分類（必選）／子分類（選填）／關鍵字（標題／描述／tags，**API 需擴充後才做**）  
2. **結果卡**：縮圖、標題、短描述、tags、分類、開放時間  
3. **動作**：查看詳情（modal 或 `/client/custom-product-detail.html?id=`）、**聯絡設計者**（既有 `messages.html?open=&product_id=`）  
4. **空態**：該分類無開放稿／尚未選分類／尚未設廠商分類 → 導向聯絡／廠商資料設定  

**不做**：公開 SEO 列表、報價表單、平台撮合狀態機、把列表塞進設計頁 tab。

---

## 5. API 強化（分階段）

### Phase M0（現有即可上線體驗）

- 沿用 for-makers；前端補：tags 顯示（若 API 加欄）、分頁 UI、登入／無分類提示。

### Phase M1（建議下一輪實作）

- `for-makers` select 加：`ai_tags`、`reference_sources`（精簡）、`title_en`（選）  
- Query：`q` 關鍵字（title／description／ai_tags）  
- 可選：依登入者廠商 `categories` **預設主分類**（免每次手選）  
- 回傳勿洩露設計者個資；聯絡仍走既有訊息／聯絡權限

### Phase M2（可選）

- 「與我版型相近」：用廠商已上架 prototype 的 tags 排序（勿硬編碼品類表）  
- 設計者「完成訂製」後從列表消失（API 已保證）

---

## 6. 與「完成訂製」的關係

標記完成 → `manufacturing_status=completed` + `open_for_manufacturing=false` → **立刻不出現在 for-makers**。  
本頁文案應寫清：只顯示**仍開放搜尋**的稿。

---

## 7. 驗收清單

- [ ] 未登入 → 導登入，不露列表  
- [ ] 僅 `open` + 有成圖的稿出現  
- [ ] 聯絡鈕帶 `product_id` 進訊息  
- [ ] noindex；不進 sitemap  
- [ ] 選單／控制台連結與文案一致  
- [ ] 不改設計頁／不改 L3 PWA

---

## 8. 建議實作順序

1. 文件定案（本檔）＋修正架構「demands 已廢」誤標  
2. 複製升級 `public/client/demands.html`（UI／分頁／預設分類）  
3. API M1 欄位與 `q`  
4. 文案與選單對齊「搜尋開放訂製稿」  
5. 部署後用測試帳號抽查分類篩選與完成訂製後消失
