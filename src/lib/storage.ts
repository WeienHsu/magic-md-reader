import type { Doc, Annotation } from '../types'

/**
 * 資料保存層：使用 localStorage。
 *
 * - 整個 App 的狀態存於單一 key（版本化），包含所有文件與註解。
 * - 寫入由呼叫端 debounce（見 App.tsx），避免每次按鍵都寫入。
 * - localStorage 為瀏覽器本機儲存，跨裝置分享請使用「匯出 JSON」功能。
 */
const STORAGE_KEY = 'magic-md-reader:v1'

export interface AppData {
  docs: Doc[]
  annotations: Annotation[]
}

const WELCOME_DOC = `# 歡迎使用 Magic MD Reader ✨

這是一個可以 **預覽、編輯、註解** Markdown 檔案的工具。

## 快速上手

1. 左上角切換「編輯 / 分割 / 預覽」模式
2. 在 **預覽區** 用滑鼠選取任意文字，即可新增註解
3. 右側欄會列出所有註解，點擊可跳至對應位置
4. 所有內容自動儲存在瀏覽器（localStorage）
5. 使用「匯出」可將文件與註解打包成 JSON 檔保存或分享

## 註解如何運作？

註解會記住你選取的文字與前後文。之後即使你編輯了文件，
只要那段文字還在，註解就會自動重新對位；找不到時會標記為
「失效」，你仍可在側欄看到它的內容。

> 試試看：選取這段引言文字，然後加上一則註解吧！

\`\`\`js
// 程式碼區塊裡的文字也可以註解
console.log('Hello, Magic MD Reader!')
\`\`\`
`

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createDoc(title: string, content: string): Doc {
  const now = Date.now()
  return { id: newId(), title, content, createdAt: now, updatedAt: now }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as AppData
      if (Array.isArray(data.docs) && Array.isArray(data.annotations)) {
        return data
      }
    }
  } catch {
    // 資料損毀時退回初始狀態，不讓整個 App 掛掉
  }
  return { docs: [createDoc('歡迎', WELCOME_DOC)], annotations: [] }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    // localStorage 可能已滿或被停用
    return false
  }
}
