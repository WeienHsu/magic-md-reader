import type { Annotation, Doc, ExportBundle } from './../types'
import { createDoc, newId } from './storage'

/**
 * 匯出 / 匯入：讓資料離開 localStorage，可長期保存、跨裝置使用。
 *
 * - 「匯出 JSON」：文件內容 + 全部註解打包成一個 .anno.json 檔
 * - 「匯出 MD」：只匯出純 Markdown
 * - 「匯入」：接受 .anno.json（還原文件與註解）或 .md / .txt（建立新文件）
 */

export function exportBundle(doc: Doc, annotations: Annotation[]): void {
  const bundle: ExportBundle = {
    app: 'magic-md-reader',
    version: 1,
    doc: { title: doc.title, content: doc.content },
    annotations: annotations.map(({ docId: _docId, ...rest }) => rest),
  }
  downloadFile(
    `${safeName(doc.title)}.anno.json`,
    JSON.stringify(bundle, null, 2),
    'application/json'
  )
}

export function exportMarkdown(doc: Doc): void {
  downloadFile(`${safeName(doc.title)}.md`, doc.content, 'text/markdown')
}

export interface ImportResult {
  doc: Doc
  annotations: Annotation[]
}

/** 解析匯入的檔案內容；throw 表示格式無法辨識 */
export function parseImport(fileName: string, content: string): ImportResult {
  if (fileName.endsWith('.json')) {
    const bundle = JSON.parse(content) as ExportBundle
    if (bundle.app !== 'magic-md-reader' || !bundle.doc || typeof bundle.doc.content !== 'string') {
      throw new Error('不是有效的 Magic MD Reader 匯出檔')
    }
    const doc = createDoc(bundle.doc.title || fileName.replace(/\.anno\.json$|\.json$/, ''), bundle.doc.content)
    const annotations: Annotation[] = (bundle.annotations ?? []).map((a) => ({
      ...a,
      id: newId(), // 重新配 id，避免與既有註解衝突
      docId: doc.id,
    }))
    return { doc, annotations }
  }
  // 純 Markdown / 文字檔
  const title = fileName.replace(/\.(md|markdown|txt)$/i, '') || '未命名'
  return { doc: createDoc(title, content), annotations: [] }
}

function safeName(title: string): string {
  return (title || '未命名').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
}

function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
