import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Annotation, ViewMode } from './types'
import { loadData, saveData, createDoc, newId, type AppData } from './lib/storage'
import { exportBundle, exportMarkdown, parseImport } from './lib/exportImport'
import { Preview } from './components/Preview'
import { AnnotationSidebar } from './components/AnnotationSidebar'
import { DocumentList } from './components/DocumentList'
import './App.css'

type Selector = Pick<Annotation, 'exact' | 'prefix' | 'suffix'>

export default function App() {
  const [data, setData] = useState<AppData>({ docs: [], annotations: [] })
  const [loaded, setLoaded] = useState(false)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [showDocList, setShowDocList] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)
  const [anchored, setAnchored] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeDoc = data.docs.find((d) => d.id === activeDocId) ?? null
  const docAnnotations = useMemo(
    () => data.annotations.filter((a) => a.docId === activeDocId),
    [data.annotations, activeDocId]
  )

  // ---- 初始載入（IndexedDB 為非同步 API）----
  useEffect(() => {
    loadData().then((initial) => {
      setData(initial)
      setActiveDocId(initial.docs[0]?.id ?? null)
      setLoaded(true)
    })
  }, [])

  // ---- 自動儲存（debounce 500ms 寫入 IndexedDB）----
  useEffect(() => {
    if (!loaded) return
    setSaveState('saving')
    const timer = setTimeout(() => {
      saveData(data).then((ok) => setSaveState(ok ? 'saved' : 'error'))
    }, 500)
    return () => clearTimeout(timer)
  }, [data, loaded])

  // ---- 文件操作 ----
  const updateDocContent = (content: string) => {
    if (!activeDocId) return
    setData((d) => ({
      ...d,
      docs: d.docs.map((doc) =>
        doc.id === activeDocId ? { ...doc, content, updatedAt: Date.now() } : doc
      ),
    }))
  }

  const updateDocTitle = (title: string) => {
    if (!activeDocId) return
    setData((d) => ({
      ...d,
      docs: d.docs.map((doc) =>
        doc.id === activeDocId ? { ...doc, title, updatedAt: Date.now() } : doc
      ),
    }))
  }

  const createNewDoc = () => {
    const doc = createDoc('未命名', '# 新文件\n\n開始撰寫…\n')
    setData((d) => ({ ...d, docs: [...d.docs, doc] }))
    setActiveDocId(doc.id)
    setShowDocList(false)
  }

  const deleteDoc = (id: string) => {
    setData((d) => ({
      docs: d.docs.filter((doc) => doc.id !== id),
      annotations: d.annotations.filter((a) => a.docId !== id),
    }))
    if (id === activeDocId) {
      const remaining = data.docs.filter((doc) => doc.id !== id)
      setActiveDocId(remaining[0]?.id ?? null)
    }
  }

  // ---- 註解操作 ----
  const createAnnotation = (selector: Selector, note: string, color: string) => {
    if (!activeDocId) return
    const now = Date.now()
    const ann: Annotation = {
      id: newId(),
      docId: activeDocId,
      ...selector,
      note,
      color,
      createdAt: now,
      updatedAt: now,
    }
    setData((d) => ({ ...d, annotations: [...d.annotations, ann] }))
    setActiveAnnotationId(ann.id)
  }

  const updateAnnotation = (id: string, patch: Partial<Pick<Annotation, 'note' | 'color'>>) => {
    setData((d) => ({
      ...d,
      annotations: d.annotations.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a
      ),
    }))
  }

  const deleteAnnotation = (id: string) => {
    setData((d) => ({ ...d, annotations: d.annotations.filter((a) => a.id !== id) }))
    if (id === activeAnnotationId) setActiveAnnotationId(null)
  }

  const handleAnchoredChange = useCallback((set: Set<string>) => setAnchored(set), [])

  // 點擊側欄或螢光處：重複點同一則也要能觸發捲動，故先清空再設定
  const selectAnnotation = (id: string) => {
    setActiveAnnotationId(null)
    requestAnimationFrame(() => setActiveAnnotationId(id))
  }

  // ---- 匯入 ----
  const handleImportFile = async (file: File) => {
    try {
      const content = await file.text()
      const { doc, annotations } = parseImport(file.name, content)
      setData((d) => ({
        docs: [...d.docs, doc],
        annotations: [...d.annotations, ...annotations],
      }))
      setActiveDocId(doc.id)
    } catch (err) {
      alert(`匯入失敗：${err instanceof Error ? err.message : '無法解析檔案'}`)
    }
  }

  const annotationCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of data.annotations) map.set(a.docId, (map.get(a.docId) ?? 0) + 1)
    return map
  }, [data.annotations])

  if (!loaded) return <div className="app" />

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-group">
          <button className="btn ghost" onClick={() => setShowDocList(true)} title="文件列表">
            📁 文件
          </button>
          <input
            className="title-input"
            value={activeDoc?.title ?? ''}
            placeholder="文件標題"
            onChange={(e) => updateDocTitle(e.target.value)}
            disabled={!activeDoc}
          />
        </div>

        <div className="toolbar-group view-switch" role="tablist">
          {(
            [
              ['edit', '編輯'],
              ['split', '分割'],
              ['preview', '預覽'],
            ] as [ViewMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              role="tab"
              aria-selected={viewMode === mode}
              className={`btn tab ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="toolbar-group">
          <span className={`save-indicator ${saveState}`}>
            {saveState === 'saved' ? '✓ 已儲存' : saveState === 'saving' ? '儲存中…' : '⚠ 儲存失敗'}
          </span>
          <button
            className="btn ghost"
            onClick={() => fileInputRef.current?.click()}
            title="匯入 .md 或 .anno.json"
          >
            匯入
          </button>
          <button
            className="btn ghost"
            disabled={!activeDoc}
            onClick={() => activeDoc && exportMarkdown(activeDoc)}
            title="匯出純 Markdown"
          >
            匯出 MD
          </button>
          <button
            className="btn ghost"
            disabled={!activeDoc}
            onClick={() => activeDoc && exportBundle(activeDoc, docAnnotations)}
            title="匯出文件＋註解（JSON）"
          >
            匯出＋註解
          </button>
          <button
            className={`btn ghost ${showSidebar ? 'active' : ''}`}
            onClick={() => setShowSidebar((s) => !s)}
            title="切換註解側欄"
          >
            💬 {docAnnotations.length}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <main className="workspace">
        {activeDoc ? (
          <>
            {viewMode !== 'preview' && (
              <textarea
                className="editor"
                value={activeDoc.content}
                onChange={(e) => updateDocContent(e.target.value)}
                spellCheck={false}
                placeholder="在此輸入 Markdown…"
              />
            )}
            {viewMode !== 'edit' && (
              <Preview
                content={activeDoc.content}
                annotations={docAnnotations}
                activeAnnotationId={activeAnnotationId}
                onCreateAnnotation={createAnnotation}
                onSelectAnnotation={selectAnnotation}
                onAnchoredChange={handleAnchoredChange}
              />
            )}
            {showSidebar && (
              <AnnotationSidebar
                annotations={docAnnotations}
                anchored={viewMode === 'edit' ? new Set(docAnnotations.map((a) => a.id)) : anchored}
                activeAnnotationId={activeAnnotationId}
                onSelect={selectAnnotation}
                onUpdate={updateAnnotation}
                onDelete={deleteAnnotation}
              />
            )}
          </>
        ) : (
          <div className="empty-state">
            <p>沒有文件</p>
            <button className="btn primary" onClick={createNewDoc}>
              建立新文件
            </button>
          </div>
        )}
      </main>

      {showDocList && (
        <DocumentList
          docs={data.docs}
          activeDocId={activeDocId}
          annotationCounts={annotationCounts}
          onSelect={(id) => {
            setActiveDocId(id)
            setActiveAnnotationId(null)
            setShowDocList(false)
          }}
          onCreate={createNewDoc}
          onDelete={deleteDoc}
          onClose={() => setShowDocList(false)}
        />
      )}
    </div>
  )
}
