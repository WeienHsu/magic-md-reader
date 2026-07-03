import type { Annotation } from '../types'

/**
 * 註解錨定引擎。
 *
 * 概念取自 W3C Web Annotation 的 TextQuoteSelector：
 * 每則註解儲存「被選取的文字 (exact)」與前後文 (prefix / suffix)。
 * 重新開啟或編輯文件後，我們把預覽區所有文字節點串接成一條字串，
 * 在其中尋找 exact 的所有出現位置，並以 prefix / suffix 的吻合程度
 * 評分，取最高分者作為錨點，再把對應的文字節點區段包進 <mark>。
 *
 * 這種做法不依賴 DOM 結構或字元位移，因此能承受：
 * - Markdown 重新渲染（DOM 全部重建）
 * - 文件其他部分的增刪修改
 * 只有當被引用的文字本身被刪除或改寫時，註解才會成為「失效」狀態。
 */

/** 前後文擷取長度 */
export const CONTEXT_LEN = 32

interface TextSegment {
  node: Text
  /** 此文字節點在整份串接文字中的起始位移 */
  start: number
}

/** 走訪 root 底下所有文字節點，回傳串接後的全文與各節點位移 */
function collectText(root: HTMLElement): { text: string; segments: TextSegment[] } {
  const segments: TextSegment[] = []
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node as Text
    segments.push({ node: t, start: text.length })
    text += t.data
  }
  return { text, segments }
}

/** 計算兩字串尾端/前端的吻合字元數（用於評分） */
function suffixOverlap(a: string, b: string): number {
  // a 的結尾與 b 的結尾吻合多少字元
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}
function prefixOverlap(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/** 在全文中尋找 annotation 的最佳錨點，回傳 [start, end)；找不到回傳 null */
function findAnchor(
  text: string,
  ann: Pick<Annotation, 'exact' | 'prefix' | 'suffix'>
): { start: number; end: number } | null {
  if (!ann.exact) return null
  const candidates: { start: number; score: number }[] = []
  let idx = text.indexOf(ann.exact)
  while (idx !== -1) {
    const before = text.slice(Math.max(0, idx - CONTEXT_LEN), idx)
    const after = text.slice(idx + ann.exact.length, idx + ann.exact.length + CONTEXT_LEN)
    const score = suffixOverlap(before, ann.prefix) + prefixOverlap(after, ann.suffix)
    candidates.push({ start: idx, score })
    idx = text.indexOf(ann.exact, idx + 1)
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  return { start: best.start, end: best.start + ann.exact.length }
}

/**
 * 把全文位移區間 [start, end) 對應到的每個文字節點區段包進 <mark>。
 * 注意：包裹會改變 DOM，因此對 segments 的操作採「由後往前」，
 * 避免前面的分割影響後面尚未處理的節點位移。
 */
function wrapRange(
  segments: TextSegment[],
  start: number,
  end: number,
  ann: Annotation
): void {
  // 找出所有與 [start, end) 重疊的節點，記錄節點內的相對區間
  const hits: { node: Text; from: number; to: number }[] = []
  for (const seg of segments) {
    const segEnd = seg.start + seg.node.data.length
    if (segEnd <= start) continue
    if (seg.start >= end) break
    hits.push({
      node: seg.node,
      from: Math.max(0, start - seg.start),
      to: Math.min(seg.node.data.length, end - seg.start),
    })
  }
  for (const { node, from, to } of hits.reverse()) {
    if (from === to) continue
    // 純空白區段（如元素之間的換行）不需要視覺標記，包了反而產生空的 mark
    if (!node.data.slice(from, to).trim()) continue
    const range = document.createRange()
    range.setStart(node, from)
    range.setEnd(node, to)
    const mark = document.createElement('mark')
    mark.className = 'annotation-highlight'
    mark.dataset.annotationId = ann.id
    mark.style.backgroundColor = ann.color
    range.surroundContents(mark)
  }
}

/**
 * 在預覽區套用所有註解的螢光標記。
 * 回傳成功錨定的註解 id 集合（不在其中者即為「失效」）。
 * 必須在 Markdown 渲染完成（innerHTML 已寫入）後呼叫。
 */
export function applyHighlights(root: HTMLElement, annotations: Annotation[]): Set<string> {
  const anchored = new Set<string>()
  for (const ann of annotations) {
    // 每包一次 <mark> 就會改變節點結構，因此每則註解都重新收集文字節點。
    // 全文字串內容不變（mark 只是包裹），所以位移仍然一致。
    const { text, segments } = collectText(root)
    const range = findAnchor(text, ann)
    if (!range) continue
    try {
      wrapRange(segments, range.start, range.end, ann)
      anchored.add(ann.id)
    } catch {
      // surroundContents 理論上不會失敗（區間限制在單一文字節點內），保險起見不讓渲染中斷
    }
  }
  return anchored
}

/**
 * 從使用者目前的選取範圍建立 TextQuoteSelector。
 * 回傳 null 表示選取無效（空白、或不在預覽區內）。
 */
export function selectorFromSelection(
  root: HTMLElement,
  selection: Selection
): Pick<Annotation, 'exact' | 'prefix' | 'suffix'> | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null

  const { text, segments } = collectText(root)

  /** 把 (container, offset) 轉成全文位移 */
  const toGlobal = (container: Node, offset: number): number | null => {
    if (container.nodeType === Node.TEXT_NODE) {
      const seg = segments.find((s) => s.node === container)
      return seg ? seg.start + offset : null
    }
    // 選取邊界落在元素節點上：取其第 offset 個子節點之前的第一個文字節點位置
    let target: Node | null = container.childNodes[offset] ?? null
    if (!target) {
      // 落在元素尾端：找此元素內最後一個文字節點的結尾
      const inner = collectLast(container)
      if (inner) {
        const seg = segments.find((s) => s.node === inner)
        return seg ? seg.start + inner.data.length : null
      }
      return null
    }
    // 找 target 內（或其後）第一個文字節點
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = walker.nextNode())) {
      const pos = target.compareDocumentPosition(n)
      if (n === target || pos & Node.DOCUMENT_POSITION_CONTAINED_BY || pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        const seg = segments.find((s) => s.node === n)
        return seg ? seg.start : null
      }
    }
    return text.length
  }

  const collectLast = (node: Node): Text | null => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    let last: Text | null = null
    let n: Node | null
    while ((n = walker.nextNode())) last = n as Text
    return last
  }

  const start = toGlobal(range.startContainer, range.startOffset)
  const end = toGlobal(range.endContainer, range.endOffset)
  if (start === null || end === null || start >= end) return null

  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LEN), start),
    suffix: text.slice(end, end + CONTEXT_LEN),
  }
}
