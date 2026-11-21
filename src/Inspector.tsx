import { AlertCircle, FileText, Link2, PencilLine, Quote, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { LIMITS, pointStatus } from './deck.ts'
import type { Deck, Point, Source } from './deck.ts'

export type InspectorTab = 'sources' | 'edit'

export function Inspector({ deck, page, sources, activeSource, tab, onTab, onSource, onTitle, onPoint, onDelete }: {
  deck: Deck | null
  page: number
  sources: Source[]
  activeSource: string | null
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
  onSource: (id: string) => void
  onTitle: (title: string) => void
  onPoint: (index: number, text: string) => void
  onDelete: (index: number) => void
}) {
  const slide = deck?.slides[page]

  useEffect(() => {
    if (activeSource && tab === 'sources') {
      const target = document.getElementById(`source-${activeSource}`)
      target?.scrollIntoView({ block: 'nearest' })
      target?.focus({ preventScroll: true })
    }
  }, [activeSource, tab, page])

  return (
    <aside className="panel inspector-panel" aria-labelledby="inspector-title">
      <div className="panel-header">
        <div className="panel-title"><FileText size={18} /><h2 id="inspector-title">内容核对</h2></div>
      </div>
      <div className="segmented" role="group" aria-label="核对方式">
        <button type="button" aria-pressed={tab === 'sources'} onClick={() => onTab('sources')}><Quote size={14} /> 原文 <span>{sources.length}</span></button>
        <button type="button" aria-pressed={tab === 'edit'} onClick={() => onTab('edit')}><PencilLine size={14} /> 编辑本页</button>
      </div>

      {tab === 'sources' ? (
        <div className="inspector-body">
          <p className="inspector-hint">{deck ? '这里保留草稿生成时的原文，可逐条核对。' : '每行非空笔记会分配一个出处编号。'}</p>
          {sources.length ? (
            <ol className="source-list">
              {sources.map(source => (
                <li key={source.id} id={`source-${source.id}`} tabIndex={-1} className={source.id === activeSource ? 'source-card highlight' : 'source-card'}>
                  <span className="source-number"><Link2 size={13} /> {source.id}</span>
                  <p>{source.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="inspector-empty"><Quote size={22} /><span>粘贴笔记后将在此显示原文。</span></div>
          )}
        </div>
      ) : (
        <div className="inspector-body edit-body">
          {slide ? (
            <>
              <label className="field-label" htmlFor="slide-title-input">页面标题</label>
              <textarea id="slide-title-input" rows={2} maxLength={LIMITS.title} value={slide.title} onChange={event => onTitle(event.target.value)} />
              {slide.points.map((point, index) => (
                <PointEditor key={index} point={point} index={index} onSource={onSource} onChange={onPoint} onDelete={onDelete} canDelete={slide.points.length > 1} />
              ))}
            </>
          ) : (
            <div className="inspector-empty"><PencilLine size={22} /><span>生成草稿后可编辑本页。</span></div>
          )}
        </div>
      )}
    </aside>
  )
}

function PointEditor({ point, index, onChange, onSource, onDelete, canDelete }: {
  point: Point
  index: number
  onChange: (index: number, text: string) => void
  onSource: (id: string) => void
  onDelete: (index: number) => void
  canDelete: boolean
}) {
  const status = pointStatus(point)
  return (
    <div className="point-editor">
      <div className="point-editor-heading">
        <label className="field-label" htmlFor={`point-input-${index}`}>要点 {index + 1}</label>
        <span className={status === '待核实' ? 'point-status amber' : 'point-status'}>{status === '待核实' && <AlertCircle size={12} />}{status}</span>
        {point.edited && status === '待核实' && <span className="point-status">已编辑</span>}
        {canDelete && <button className="icon-button delete-point" type="button" aria-label={`删除要点 ${index + 1}`} onClick={() => onDelete(index)}><Trash2 size={14} /></button>}
      </div>
      <textarea id={`point-input-${index}`} rows={2} maxLength={LIMITS.point} value={point.text} onChange={event => onChange(index, event.target.value)} />
      {!point.text.trim() && <span className="needs-review empty-point">请填写内容后再导出。</span>}
      {point.sourceIds.length > 0 && (
        <div className="editor-refs">
          <span>{point.edited ? '修改前出处' : '原文出处'}</span>
          {point.sourceIds.map(id => <button type="button" className="source-chip" key={id} onClick={() => onSource(id)} aria-label={`查看原文 ${id}`}>{id}</button>)}
        </div>
      )}
    </div>
  )
}
