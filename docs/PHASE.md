# MatchDO 階段進度控管

**最後更新**: 2026-02-06  
**單一來源**: 進度以本檔與 `matchdo-roadmap.md`、`matchdo-todo.md` 對齊為準。

**原則**：媒合成功即直接顯示聯絡方式，**不鎖、無解鎖流程**。勿再新增「申請解鎖」「付費解鎖」等。

---

## 當前階段

| 階段 | 名稱 | 完成度 | 狀態 |
|------|------|--------|------|
| Phase 1 | 資料庫基礎 | 100% | ✅ 完成 |
| **Phase 1.5** | **發案者功能** | **約 85%** | ⏳ **核心已完成**，收尾為可選項 + E2E |
| **Phase 1.6** | **Supabase Storage 遷移** | **100%** | ✅ **已完成**（SQL 已執行、上傳改 Storage、圖片 URL 已更新） |
| Phase 1.8 | 廠商端媒合專案 | 規劃中 | 見 `docs/PHASE-1.8-VENDOR-MATCH-PROJECTS.md` |
| Phase 2 | AI 核心（首頁識別／客製產品） | 100% | ✅ 已由現有後端＋Gemini 實作 |
| Phase 2b | 專家功能優化 | 0% | 未開始 |
| Phase 3 | 媒合引擎 | 實作中 | 演算法 V2 + run-split + 預媒合 + 廠商端媒合 ✅；**站內對話已完成，不鎖聯絡方式** |
| Phase 4 | 通知系統 | 0% | 未開始 |
| Phase 5 | 訂閱金流 | 0% | 未開始 |

**Phase 1.5 完成了沒？**  
- **核心功能**：已全部完成（發案者控制台、專案列表／詳情、預媒合、送出媒合、媒合專家列表、移除此廠商、站內聯繫對話）。  
- **整體約 85%**：剩「可選優化」與「E2E 測試」未做，不擋進入 Phase 1.6 / Phase 2。  
- **相關文件**：首頁 AI 識別與後台分類流程見 `docs/首頁AI識別流程.md`。

---

## Phase 1.5 檢查清單（檔案與功能對應）

| 檔案／功能 | 狀態 | 備註 |
|------------|------|------|
| `client/dashboard.html` | ✅ | 發案者控制台 |
| `client/my-projects.html` | ✅ | 我的專案列表 |
| `client/my-custom-products.html` | ✅ | 客製產品列表 |
| `client/project-detail.html` | ✅ | 專案詳情、預算、預媒合、分包項目、標籤可編輯、送出媒合、媒合專家列表、移除此廠商 |
| `client/matched-experts.html` | ✅ | 導向頁（說明請至專案詳情查看，連結我的專案） |
| 聯繫專家實際功能 | ✅ | 「立即聯繫」→ 開啟站內對話 Modal（conversations/messages API）；需先執行 `docs/conversations-schema.sql` 建立對話表 |

---

## 待辦（依優先序）

1. ~~**聯繫專家**~~：已完成（專案詳情「立即聯繫」→ 線上訊息對話 Modal）。
2. ~~**Phase 1.6 Storage 遷移**~~：已完成（SQL 已執行、上傳改 Supabase Storage、前端圖片 URL 已更新）。
3. **（可選）** 獨立 matched-experts 列表頁：若需跨專案一頁看所有媒合廠商再實作。
4. **E2E 測試**：發包流程、預媒合、移除廠商、線上對話。
5. **接下來階段**：Phase 1.8（廠商端媒合專案，見 `docs/PHASE-1.8-VENDOR-MATCH-PROJECTS.md`）、Phase 1.7（權限與保護），或 Phase 2（專家功能優化）；詳見 `matchdo-todo.md`。

---

## 更新此檔時機

- 完成 Phase 1.5 某項時，將上表該列改為 ✅。
- 進入下一 Phase 或調整完成度時，更新「當前階段」表與「待辦」。
- 重大功能上線或釋出時，更新「最後更新」日期。
