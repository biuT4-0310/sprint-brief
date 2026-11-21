import { Check, ChevronDown, FileText, Link2, Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { FIELDS, LIMITS, claimAt, labelForPoint, statusOf } from './deck.ts'
import type { Claim, Slide, Source, Where } from './deck.ts'

export type InspectorTab = 'sources' | 'edit'

export function Inspector({ slide, sources, selected, tab, disabled, onTab, onSelect, onText, onSources, onCheck, onDelete, onAdd }: {
  slide?: Slide
  sources: Source[]
  selected: Where
  tab: InspectorTab
  disabled: boolean
  onTab: (tab: InspectorTab) => void
  onSelect: (where: Where) => void
  onText: (text: string) => void
  onSources: (ids: string[]) => void
  onCheck: (checked: boolean) => void
  onDelete: () => void
  onAdd: () => void
}) {
  const claim = slide && claimAt(slide, selected)
  const point = typeof selected === 'number' ? slide?.points[selected] : undefined
  const limit = selected === 'title' ? LIMITS.title : point?.field ? FIELDS[point.field].limit : LIMITS.point
  const label = point && typeof selected === 'number' ? labelForPoint(point, selected) : '页面标题'
  const customPoints = slide?.kind === 'summary' || slide?.kind === 'progress'

  return (
    <aside className="panel inspector-panel" aria-labelledby="inspector-title">
      <div className="panel-header">
        <div className="panel-title"><FileText size={17} /><h2 id="inspector-title">核对</h2></div>
      </div>
      <div className="segmented" role="group" aria-label="侧栏">
        <button type="button" aria-pressed={tab === 'edit'} onClick={() => onTab('edit')}>本页</button>
        <button type="button" aria-pressed={tab === 'sources'} onClick={() => onTab('sources')}>原笔记 <span>{sources.length}</span></button>
      </div>

      {tab === 'sources' ? (
        <div className="inspector-body">
          {sources.length
            ? <ol className="source-list">{sources.map(source => <SourceQuote key={source.id} source={source} />)}</ol>
            : <p className="inspector-empty">粘贴笔记后，每行原文会出现在这里。</p>}
        </div>
      ) : (
        <div className="inspector-body edit-body">
          {slide && claim ? (
            <>
              <div className="claim-list" role="group" aria-label="本页内容">
                <button type="button" aria-pressed={selected === 'title'} onClick={() => onSelect('title')}>标题</button>
                {slide.points.map((item, index) => (
                  <button type="button" key={item.field ?? index} aria-pressed={selected === index} onClick={() => onSelect(index)}>
                    {labelForPoint(item, index)}
                  </button>
                ))}
                {customPoints && slide.points.length < LIMITS.points && (
                  <button type="button" onClick={onAdd} disabled={disabled}><Plus size={12} /> 加要点</button>
                )}
              </div>
              <ClaimEditor key={`${slide.kind}-${selected}`} label={label} limit={limit} claim={claim}
                cover={slide.kind === 'cover'} sources={sources} disabled={disabled} canDelete={Boolean(customPoints && point)}
                onText={onText} onSources={onSources} onCheck={onCheck} onDelete={onDelete} />
            </>
          ) : <p className="inspector-empty">生成草稿后，可以逐条核对。</p>}
        </div>
      )}
    </aside>
  )
}

function SourceQuote({ source }: { source: Source }) {
  return <li className="source-card"><span className="source-number"><Link2 size={12} /> {source.id}</span><p>{source.text}</p></li>
}

function ClaimEditor({ label, limit, claim, cover, sources, disabled, canDelete, onText, onSources, onCheck, onDelete }: {
  label: string
  limit: number
  claim: Claim
  cover: boolean
  sources: Source[]
  disabled: boolean
  canDelete: boolean
  onText: (text: string) => void
  onSources: (ids: string[]) => void
  onCheck: (checked: boolean) => void
  onDelete: () => void
}) {
  const inputId = useId()
  const [picking, setPicking] = useState(false)
  const status = statusOf(claim)
  const attached = sources.filter(source => claim.sourceIds.includes(source.id))

  return (
    <div className="claim-editor">
      <div className="claim-heading">
        <label className="field-label" htmlFor={inputId}>{label}</label>
        {!cover && <span className="review-status" data-state={status}>{status}</span>}
        {canDelete && <button className="icon-button delete-point" type="button" aria-label="删除本条要点" disabled={disabled} onClick={onDelete}><Trash2 size={14} /></button>}
      </div>
      <textarea id={inputId} value={claim.text} onChange={event => onText(event.target.value)} disabled={disabled} maxLength={limit}
        placeholder={cover ? '项目名称' : '待补充'} rows={3} />
      {!cover && (
        <>
          {status === '待核实' && claim.reviewNote && <p className="claim-note">{claim.reviewNote}</p>}
          <div className="evidence-heading">
            <span>引用的原文</span>
            <button className="text-button" type="button" aria-expanded={picking} onClick={() => setPicking(!picking)}>
              {picking ? '收起' : '调整出处'} <ChevronDown size={13} />
            </button>
          </div>
          {picking ? (
            <div className="source-picker" aria-label="选择原文">
              {sources.map(source => (
                <label key={source.id}>
                  <input type="checkbox" checked={claim.sourceIds.includes(source.id)} disabled={disabled}
                    onChange={event => onSources(event.target.checked ? [...claim.sourceIds, source.id] : claim.sourceIds.filter(id => id !== source.id))} />
                  <span><strong>{source.id}</strong>{source.text}</span>
                </label>
              ))}
            </div>
          ) : attached.length
            ? <ol className="source-list cited-list">{attached.map(source => <SourceQuote key={source.id} source={source} />)}</ol>
            : <p className="claim-note">还没有关联原文。</p>}
          <button className="button secondary review-button" type="button"
            disabled={disabled || (!claim.checked && (!claim.text.trim() || !attached.length))}
            onClick={() => onCheck(!claim.checked)}>
            <Check size={15} />{claim.checked ? '撤销核对' : '标为已核对'}
          </button>
        </>
      )}
    </div>
  )
}
