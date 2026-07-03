import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Annotation } from '../types'
import { HIGHLIGHT_COLORS } from '../types'
import { applyHighlights, selectorFromSelection } from '../lib/anchor'

type Selector = Pick<Annotation, 'exact' | 'prefix' | 'suffix'>

interface Props {
  content: string
  annotations: Annotation[]
  activeAnnotationId: string | null
  onCreateAnnotation: (selector: Selector, note: string, color: string) => void
  onSelectAnnotation: (id: string) => void
  onAnchoredChange: (anchored: Set<string>) => void
}

interface PopupState {
  selector: Selector
  /** 相對於預覽容器的座標 */
  x: number
  y: number
}

export function Preview({
  content,
  annotations,
  activeAnnotationId,
  onCreateAnnotation,
  onSelectAnnotation,
  onAnchoredChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [note, setNote] = useState('')
  const [color, setColor] = useState<string>(HIGHLIGHT_COLORS[0])

  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false, gfm: true }) as string
    return DOMPurify.sanitize(raw)
  }, [content])

  // 渲染 Markdown 後套用註解螢光標記。
  // 內容以 ref 手動寫入（而非 dangerouslySetInnerHTML），
  // 讓「重設 HTML → 套用標記」永遠成對發生，避免重複包裹。
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    body.innerHTML = html
    const anchored = applyHighlights(body, annotations)
    onAnchoredChange(anchored)
    // onAnchoredChange 由 App 以 useCallback 固定，不需列入依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, annotations])

  // 點擊側欄註解時，捲動到對應的螢光處並閃爍提示
  useEffect(() => {
    if (!activeAnnotationId || !bodyRef.current) return
    const marks = bodyRef.current.querySelectorAll<HTMLElement>(
      `mark[data-annotation-id="${CSS.escape(activeAnnotationId)}"]`
    )
    if (marks.length === 0) return
    marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    marks.forEach((m) => {
      m.classList.add('flash')
      setTimeout(() => m.classList.remove('flash'), 1600)
    })
  }, [activeAnnotationId])

  const handleMouseUp = () => {
    const body = bodyRef.current
    const container = containerRef.current
    if (!body || !container) return
    const selection = window.getSelection()
    if (!selection) return
    const selector = selectorFromSelection(body, selection)
    if (!selector || !selector.exact.trim()) {
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const cRect = container.getBoundingClientRect()
    setNote('')
    setPopup({
      selector,
      x: Math.max(8, rect.left - cRect.left),
      y: rect.bottom - cRect.top + container.scrollTop + 8,
    })
  }

  const handleClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('mark[data-annotation-id]')
    if (mark) {
      onSelectAnnotation((mark as HTMLElement).dataset.annotationId!)
    }
  }

  const savePopup = () => {
    if (!popup) return
    onCreateAnnotation(popup.selector, note.trim(), color)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div className="preview-container" ref={containerRef}>
      <div
        className="preview-body markdown-body"
        ref={bodyRef}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
      {popup && (
        <div className="annotation-popup" style={{ left: popup.x, top: popup.y }}>
          <div className="popup-quote">“{truncate(popup.selector.exact, 60)}”</div>
          <textarea
            autoFocus
            placeholder="輸入註解內容…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) savePopup()
              if (e.key === 'Escape') setPopup(null)
            }}
          />
          <div className="popup-footer">
            <div className="color-swatches">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  className={`swatch ${c === color ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`顏色 ${c}`}
                />
              ))}
            </div>
            <div className="popup-actions">
              <button className="btn ghost" onClick={() => setPopup(null)}>
                取消
              </button>
              <button className="btn primary" onClick={savePopup}>
                新增註解
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
