import type { Doc } from '../types'

interface Props {
  docs: Doc[]
  activeDocId: string | null
  annotationCounts: Map<string, number>
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function DocumentList({
  docs,
  activeDocId,
  annotationCounts,
  onSelect,
  onCreate,
  onDelete,
  onClose,
}: Props) {
  const sorted = [...docs].sort((a, b) => b.updatedAt - a.updatedAt)
  return (
    <div className="doc-drawer-backdrop" onClick={onClose}>
      <div className="doc-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>我的文件</h2>
          <button className="btn primary" onClick={onCreate}>
            ＋ 新文件
          </button>
        </div>
        <ul className="doc-list">
          {sorted.map((doc) => (
            <li
              key={doc.id}
              className={`doc-item ${doc.id === activeDocId ? 'active' : ''}`}
              onClick={() => onSelect(doc.id)}
            >
              <div className="doc-item-main">
                <span className="doc-title">{doc.title || '未命名'}</span>
                <span className="doc-meta">
                  {formatTime(doc.updatedAt)} · {annotationCounts.get(doc.id) ?? 0} 則註解
                </span>
              </div>
              <button
                className="btn ghost small danger"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`確定刪除「${doc.title || '未命名'}」與其所有註解？此動作無法復原。`)) {
                    onDelete(doc.id)
                  }
                }}
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
