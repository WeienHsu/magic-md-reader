import type { Doc, Annotation } from '../types'

/**
 * 資料保存層：使用 IndexedDB。
 *
 * - docs 與 annotations 各一個 object store，每筆資料一條記錄。
 * - 儲存時只寫入有變動的記錄：App 的狀態更新是不可變的（immutable），
 *   沒被改到的物件參照不變，因此用「參照是否相同」即可判斷需不需要寫入。
 * - 寫入由呼叫端 debounce（見 App.tsx），避免每次按鍵都寫入。
 * - 首次載入時若偵測到舊版 localStorage 資料，會自動搬移過來。
 * - IndexedDB 為瀏覽器本機儲存，跨裝置分享請使用「匯出 JSON」功能。
 */
const DB_NAME = 'magic-md-reader'
const DB_VERSION = 1
/** 舊版 localStorage 的 key，僅用於一次性搬移 */
const LEGACY_STORAGE_KEY = 'magic-md-reader:v1'

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
4. 所有內容自動儲存在瀏覽器本機（IndexedDB）
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

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('docs', { keyPath: 'id' })
        req.result.createObjectStore('annotations', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName).objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

/** 上次成功寫入的狀態，用於差異比對；null 表示尚未寫入過（需全量寫入） */
let lastSaved: AppData | null = null

/**
 * 把 after 與 before 的差異寫入 store：
 * 參照不同（新增或修改）的記錄 put，before 有而 after 沒有的記錄 delete。
 */
function diffWrite<T extends { id: string }>(store: IDBObjectStore, before: T[], after: T[]): void {
  const prevById = new Map(before.map((item) => [item.id, item]))
  for (const item of after) {
    if (prevById.get(item.id) !== item) store.put(item)
    prevById.delete(item.id)
  }
  for (const id of prevById.keys()) store.delete(id)
}

function writeData(db: IDBDatabase, data: AppData): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['docs', 'annotations'], 'readwrite')
    diffWrite(tx.objectStore('docs'), lastSaved?.docs ?? [], data.docs)
    diffWrite(tx.objectStore('annotations'), lastSaved?.annotations ?? [], data.annotations)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** 讀取舊版 localStorage 資料；不存在或損毀時回傳 null */
function loadLegacy(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as AppData
      if (Array.isArray(data.docs) && Array.isArray(data.annotations)) {
        return data
      }
    }
  } catch {
    // 舊資料損毀或 localStorage 被停用：視同沒有舊資料
  }
  return null
}

export async function loadData(): Promise<AppData> {
  try {
    const db = await openDb()
    const [docs, annotations] = await Promise.all([
      getAll<Doc>(db, 'docs'),
      getAll<Annotation>(db, 'annotations'),
    ])
    if (docs.length > 0) {
      // getAll 依主鍵（隨機 id）排序，還原成建立順序
      docs.sort((a, b) => a.createdAt - b.createdAt)
      annotations.sort((a, b) => a.createdAt - b.createdAt)
      lastSaved = { docs, annotations }
      return lastSaved
    }
    // IndexedDB 是空的：搬移舊版 localStorage 資料（若有）
    const legacy = loadLegacy()
    if (legacy) {
      await writeData(db, legacy)
      lastSaved = legacy
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return legacy
    }
  } catch {
    // IndexedDB 無法使用（如隱私模式）時退回初始狀態，不讓整個 App 掛掉
  }
  return { docs: [createDoc('歡迎', WELCOME_DOC)], annotations: [] }
}

export async function saveData(data: AppData): Promise<boolean> {
  try {
    const db = await openDb()
    await writeData(db, data)
    lastSaved = data
    return true
  } catch {
    // IndexedDB 可能被停用或空間不足
    return false
  }
}
