# 首頁 AI 識別流程（必讀再改）

**更新**：2026-02-06（與 Phase 1.5 收尾並行；提示詞撰寫要點見後台分類管理說明。）

後端或後台提示詞相關改動前，請先對齊此流程，避免與現有識別方法衝突。

---

## 1. 前端（首頁表單 → /api/ai-detect）

- **入口**：`public/iStudio-1.0.0/index.html` 表單 `#aiForm`，邏輯在 `public/js/main.js`（或 iStudio 版對應 js）。
- **必填**：施作大分類 `#category`（主分類 key）、子分類 `#subcategory`（多選，至少一個）、專案地點、**圖片或需求描述至少一項**。
- **送出時組 FormData**：
  - `category` = 主分類 key（例：home）
  - `subcategory` = **第一個**選中的子分類名稱（字串，給 AI 提示詞用）
  - `subcategories` = 多選子分類陣列 JSON（給專案紀錄用）
  - `userDescription`、`designImages`、`dynamic_fields_json`、`projectLocation` 等
- **成功回傳**：`res.items` 為陣列，每筆預期 `item_name`、`spec`、`quantity`、`unit`；前端依此畫表格（項目／規格／數量／單位），可編輯後再「儲存到專案」。

---

## 2. 後端（server.js POST /api/ai-detect）

1. **收參**：`req.body.category`（主分類 key）、`req.body.subcategory`（子分類名稱）、`req.body.userDescription`、`req.files`（designImages）、可選 `item`/`unit`/`qty`。
2. **提示詞來源**：
   - 若有 `req.body.category`，自 `ai_categories` 查該 key 的 `prompt`；
   - 若查得到且非空，**完全使用該 prompt**（只做 `{subcategory}` 替換）；
   - 若查不到或為空，才用後端 fallback `STRUCTURED_PROMPT_TEMPLATE`（企業服務顧問那則）。
3. **替換**：prompt 內 `{subcategory}` 一律替成 `req.body.subcategory` 或「該類別」。
4. **組最終 prompt**：`customPrompt = prompt` ＋ 若有 `userDescription` 則追加「用戶需求描述：…」與「請根據以上描述和圖片來分析項目」；若有 `item`/`unit`/`qty` 再追加對應一句。**不再自動補任何「請輸出 JSON」等後綴**，以免干擾既有能正常出 JSON 的提示詞。
5. **呼叫 Gemini**：`model.generateContent({ contents: [{ role: "user", parts: [text: customPrompt, 可選 inlineData 圖片] }] })`，無 system 或其他包裝。
6. **解析回傳**：
   - 若 `response.text()` 以 `[` 開頭 → 整段 `JSON.parse` 當 items；
   - 否則當物件取 `aiResult.items`；
   - 失敗則用正則 `\[.*\]/s` 抓一段陣列再 parse。
7. **回傳**：`{ success: true, project_id, items }`，items 為陣列，每項需有 `item_name`、`spec`、`quantity`、`unit` 供前端表格使用。

---

## 3. 提示詞撰寫（對齊此流程）

- 後台「分類管理」裡存的 **主分類 prompt**，會**原樣**當成使用者的那一段話送給 Gemini（只做 `{subcategory}` 替換與後端追加的「用戶需求描述」等）。
- **沒有**在後端再包一層「請只輸出 JSON」或固定分析流程；因此：
  - 若你**已經**用短提示詞（例如「因為你是專業清潔服務估算師,具備圖像識別與空間分析能力。」）就能讓 Gemini 回傳符合 `item_name/spec/quantity/unit` 的 JSON，**維持現狀即可**，不必刻意寫很長。
  - 若某分類回傳常不穩，再在該分類的 prompt 裡**自己**加輸出格式說明即可；後端不強制補字。

---

## 4. 相關檔案一覽

| 用途           | 檔案 |
|----------------|------|
| 首頁表單       | `public/iStudio-1.0.0/index.html` |
| 表單與送出邏輯 | `public/js/main.js`（#aiForm submit、FormData、/api/ai-detect、res.items 表格） |
| 後端識別 API   | `server.js` 內 `POST /api/ai-detect`（約 213–421 行） |
| 主分類提示詞   | DB `ai_categories.prompt`，後台 `admin/categories.html` 編輯 |

之後任何「提示詞要怎麼寫」「要不要補 JSON」「識別流程」的建議或改動，都應以本文件與上述程式為準，先讀再改。
