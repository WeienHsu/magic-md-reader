/** 一份 Markdown 文件 */
export interface Doc {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

/**
 * 一則註解。錨定方式採用 W3C Web Annotation 的 TextQuoteSelector 概念：
 * 以「被選取的文字 (exact)」加上前後文 (prefix / suffix) 在渲染後的
 * 預覽文字中重新定位。即使文件內容被編輯，只要被引用的文字仍然存在，
 * 註解就能重新對位；找不到時會被標記為「失效 (orphaned)」而不會遺失。
 */
export interface Annotation {
  id: string
  docId: string
  /** 被選取的文字本身 */
  exact: string
  /** 選取處之前的文字（用於消除重複文字的歧義） */
  prefix: string
  /** 選取處之後的文字 */
  suffix: string
  /** 使用者輸入的註解內容 */
  note: string
  /** 螢光筆顏色 */
  color: string
  createdAt: number
  updatedAt: number
}

/** 匯出 / 匯入用的打包格式 */
export interface ExportBundle {
  app: 'magic-md-reader'
  version: 1
  doc: Pick<Doc, 'title' | 'content'>
  annotations: Omit<Annotation, 'docId'>[]
}

export type ViewMode = 'edit' | 'split' | 'preview'

export const HIGHLIGHT_COLORS = [
  '#fff3a3', // 黃
  '#b5f0c4', // 綠
  '#bcdcff', // 藍
  '#ffd6e8', // 粉
  '#ffd9a8', // 橘
] as const
