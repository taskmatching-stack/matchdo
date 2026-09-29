# 後台內容多語系 → 前台 i18n（必讀）

> **最後更新**：2026-08-06  
> **Cursor 規則**：`.cursor/rules/admin-content-multilang.mdc`（alwaysApply）

---

## 一句話

**後台維護、前台會顯示的文案**，要在資料庫／後台表單提供 `name_en`（及預留語系），前台用 `?lang=` 取值。  
**不是**幫 `/admin/` 頁面做 `locales/*.json` UI 翻譯。

---

## 兩種「多語系」不要搞混

| 種類 | 用途 | 做法 |
|------|------|------|
| **UI 文案** | 按鈕、標題、提示（程式寫死的介面字） | `public/locales/zh-TW.json`、`en.json` + `data-i18n` |
| **內容文案** | 官方類型名、配色名、情境主題名、攝影參數組名…（DB／後台維護） | DB `name` + `name_en`／`name_ja`…；API 依 `lang` 選 |

新功能常只做 UI 文案、漏做內容文案 → 英文介面仍出現中文官方名稱。

---

## 標準做法（對齊情境圖）

1. 欄位：`name`（預設／中文）、`name_en`、`name_ja`、`name_es`、`name_de`、`name_fr`  
2. 後台 UI：見 `public/admin/promo-scene-templates.html`（名稱＋英文＋其他語系小框）  
3. 前台 API：`applyPromoSceneTemplateLocale` 模式——有該語系欄才覆寫 `name`  
4. 前台請求：`?lang=` + `window.i18n.getLang()`

說明／備註同理：`note` + `note_en`…

---

## 配色範例（本輪補齊）

| 項目 | 位置 |
|------|------|
| SQL | `docs/add-material-color-palette-i18n.sql` |
| 維護 id | `material-color-palette-i18n` |
| 後台 | `/admin/material-color-palettes.html`（類型＋官方配色） |
| 前台 API | `GET /api/material-color-palettes/platform?lang=` |

「我的配色」為使用者自填，不強制多語系欄。

---

## 新功能開表／開後台頁時自問

1. 這串字會不會出現在前台非中文語系？  
2. 有沒有後台「名稱（英文）」欄？  
3. 前台 list／options API 有沒有吃 `lang`？  

任一「否」→ 未完成。
