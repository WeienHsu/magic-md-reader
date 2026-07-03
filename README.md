# Magic MD Reader 📝

線上 Markdown **預覽・編輯・註解** 工具。純前端靜態網站，可直接部署到 GitHub Pages。

## 功能

- **三種檢視模式**：編輯 / 分割（左編輯右預覽即時同步）/ 純預覽
- **區域註解**：在預覽區選取任意文字（段落、句子、程式碼皆可），加上註解與螢光顏色
- **註解側欄**：列出所有註解，點擊即捲動至對應位置；可編輯、改色、刪除
- **多文件管理**：文件抽屜可建立、切換、刪除多份文件
- **自動儲存**：所有文件與註解自動存入瀏覽器 localStorage（debounce 500ms）
- **匯出 / 匯入**：
  - `匯出 MD` — 匯出純 Markdown 檔
  - `匯出＋註解` — 文件與註解打包成 `.anno.json`，可備份或分享給他人
  - `匯入` — 開啟 `.md` / `.txt`（建立新文件）或 `.anno.json`（連同註解一起還原）

## 技術架構

| 項目 | 選擇 | 原因 |
|------|------|------|
| 框架 | React 19 + TypeScript + Vite | 元件化 UI、型別安全、快速建置 |
| Markdown 渲染 | [marked](https://marked.js.org/)（GFM） | 輕量、成熟 |
| XSS 防護 | [DOMPurify](https://github.com/cure53/DOMPurify) | 渲染前消毒 HTML |
| 資料保存 | localStorage + JSON 匯出/匯入 | GitHub Pages 無後端，本機自動存 + 檔案長期保存 |
| 部署 | GitHub Actions → GitHub Pages | push 到 main 即自動上線 |

### 註解錨定原理

註解採用 [W3C Web Annotation](https://www.w3.org/TR/annotation-model/) 的 **TextQuoteSelector** 概念，每則註解儲存：

```json
{
  "exact": "被選取的文字",
  "prefix": "前 32 個字元的上下文",
  "suffix": "後 32 個字元的上下文",
  "note": "使用者的註解內容",
  "color": "#fff3a3"
}
```

重新渲染時，程式將預覽區所有文字節點串接成一條字串，尋找 `exact` 的所有出現位置，
並以 `prefix` / `suffix` 的吻合程度評分取最佳錨點，再把對應文字包進 `<mark>` 螢光標記。

這種設計**不依賴 DOM 結構或字元位移**，因此能承受：

- Markdown 重新渲染（DOM 全部重建）
- 文件其他部分的增刪修改（註解自動重新對位）

只有當被引用的文字本身被刪除或改寫時，註解才會顯示「⚠ 失效」——內容仍保留在側欄，不會遺失。

### 資料流

```
使用者編輯 ──▶ React state ──debounce 500ms──▶ localStorage（自動儲存）
                   │
                   ├──▶ marked + DOMPurify ──▶ 預覽 DOM ──▶ applyHighlights() 套用螢光
                   │
                   └──▶ 匯出 .anno.json / .md（長期保存、跨裝置分享）
```

### 專案結構

```
src/
├── types.ts                    # Doc / Annotation / ExportBundle 型別定義
├── lib/
│   ├── storage.ts              # localStorage 讀寫（版本化 key、損毀容錯）
│   ├── anchor.ts               # 註解錨定引擎（TextQuoteSelector 定位 + <mark> 包裹）
│   └── exportImport.ts         # 匯出 / 匯入（JSON bundle 與純 MD）
├── components/
│   ├── Preview.tsx             # Markdown 渲染、選取彈窗、螢光標記、捲動定位
│   ├── AnnotationSidebar.tsx   # 註解側欄（列表、編輯、刪除、失效標記）
│   └── DocumentList.tsx        # 文件抽屜（多文件管理）
├── App.tsx                     # 狀態管理、工具列、自動儲存
└── App.css
```

## 本機開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產出 dist/
npm run lint
```

## 部署到 GitHub Pages

push 到 `main` 分支即可——`.github/workflows/deploy.yml` 會自動 build 並發佈，
首次執行時也會自動啟用 Pages（Source = GitHub Actions），不需手動設定。
網站上線於 `https://<你的帳號>.github.io/magic-md-reader/`

> 若 repo 改名，記得同步修改 `vite.config.ts` 中的 `base` 路徑。

## 資料保存注意事項

- localStorage 為**單一瀏覽器本機**儲存：換裝置、換瀏覽器或清除網站資料都不會帶走內容
- 重要文件請定期用「**匯出＋註解**」下載 `.anno.json` 備份；之後用「匯入」即可完整還原文件與所有註解
