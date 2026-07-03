import { useState } from 'react'
import type { Annotation } from '../types'
import { HIGHLIGHT_COLORS } from '../types'

interface Props {
  annotations: Annotation[]
  anchored: Set<string>
  activeAnnotationId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<Annotation, 'note' | 'color'>>) => void
  onDelete: (id: string) => void
}

export function AnnotationSidebar({
  annotations,
  anchored,
  activeAnnotationId,
  onSelect,
  onUpdate,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const sorted = [...annotations].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>註解</h2>
        <span className="count">{annotations.length}</span>
      </div>
      {sorted.length === 0 && (
        <p className="sidebar-empty">
          在預覽區選取文字即可新增註解。
        </p>
      )}
      <ul className="annotation-list">
        {sorted.map((ann) => {
          const orphaned = !anchored.has(ann.id)
          const isEditing = editingId === ann.id
          return (
            <li
              key={ann.id}
              className={`annotation-card ${ann.id === activeAnnotationId ? 'active' : ''} ${orphaned ? 'orphaned' : ''}`}
              style={{ borderLeftColor: ann.color }}
              onClick={() => !orphaned && onSelect(ann.id)}
            >
              <blockquote className="card-quote">“{truncate(ann.exact, 80)}”</blockquote>
              {orphaned && (
                <span className="orphan-badge" title="文件中已找不到這段文字，註解暫時無法對位">
                  ⚠ 失效
                </span>
              )}
              {isEditing ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        onUpdate(ann.id, { note: draft.trim() })
                        setEditingId(null)
                      }
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <div className="card-actions">
                    <div className="color-swatches">
                      {HIGHLIGHT_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`swatch ${c === ann.color ? 'selected' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => onUpdate(ann.id, { color: c })}
                          aria-label={`顏色 ${c}`}
                        />
                      ))}
                    </div>
                    <button className="btn ghost" onClick={() => setEditingId(null)}>
                      取消
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => {
                        onUpdate(ann.id, { note: draft.trim() })
                        setEditingId(null)
                      }}
                    >
                      儲存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {ann.note ? (
                    <p className="card-note">{ann.note}</p>
                  ) : (
                    <p className="card-note empty">（無註解內容）</p>
                  )}
                  <div className="card-footer">
                    <time>{formatTime(ann.updatedAt)}</time>
                    <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn ghost small"
                        onClick={() => {
                          setDraft(ann.note)
                          setEditingId(ann.id)
                        }}
                      >
                        編輯
                      </button>
                      <button
                        className="btn ghost small danger"
                        onClick={() => {
                          if (confirm('確定刪除這則註解？')) onDelete(ann.id)
                        }}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
