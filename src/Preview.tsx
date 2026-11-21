import { ChevronLeft, ChevronRight, LayoutPanelTop } from 'lucide-react'
import { FIELDS, SLIDES, reviewSummary, statusOf } from './deck.ts'
import type { Deck, Where } from './deck.ts'
import { ACCENT, COVER_MARKS, FIELD_LAYOUT, HEIGHT, WIDTH, fieldSurface } from './design.ts'
import type { CSSProperties } from 'react'

const padded = (index: number) => String(index + 1).padStart(2, '0')

export function Preview({ deck, page, selected, onPage, onClaim }: {
  deck: Deck | null
  page: number
  selected: Where | null
  onPage: (index: number) => void
  onClaim: (where: Where) => void
}) {
  const slide = deck?.slides[page]
  const counts = reviewSummary(slide ? [slide] : [])

  return (
    <section className="panel preview-panel" aria-labelledby="preview-title">
      <div className="panel-header preview-header">
        <div className="panel-title"><LayoutPanelTop size={17} /><h2 id="preview-title">预览</h2></div>
        <div className="preview-controls">
          <span className="format-label">16:9</span>
          <button className="icon-button" type="button" onClick={() => onPage(page - 1)} disabled={!slide || page === 0} aria-label="上一页"><ChevronLeft size={16} /></button>
          <button className="icon-button" type="button" onClick={() => onPage(page + 1)} disabled={!slide || page === SLIDES.length - 1} aria-label="下一页"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="canvas">
        {!deck || !slide ? (
          <div className="slide empty-slide">
            <div className="empty-icon"><LayoutPanelTop size={25} /></div>
            <h3>这里预览周报</h3><p>先填项目和笔记，再生成草稿。</p>
          </div>
        ) : slide.kind === 'cover' ? (
          <div className="slide cover-slide">
            <div className="cover-border" />
            <div className="cover-kicker"><i /> 研发周报</div>
            <div className="cover-main">
              <button type="button" className={`cover-title claim-target${slide.title.text.length > 17 ? ' long' : ''}`}
                onClick={() => onClaim('title')} aria-pressed={selected === 'title'} aria-label="编辑封面标题">{slide.title.text.trim() || deck.input.project}</button>
            </div>
            {deck.input.period && <div className="cover-date">{deck.input.period}</div>}
            <div className="cover-marks" aria-hidden="true">
              {COVER_MARKS.map(mark => (
                <div key={mark.index} className="cover-mark" style={{ '--mark': `#${mark.color}` } as CSSProperties}>
                  <span>{mark.index}</span><strong>{mark.label}</strong>
                </div>
              ))}
            </div>
            <span className="cover-index">01 / 05</span>
          </div>
        ) : (
          <div className="slide content-slide" style={{ '--slide-accent': `#${ACCENT[slide.kind]}` } as CSSProperties}>
            <p className="slide-kicker">{SLIDES[page].title}</p>
            <button className="slide-title claim-target" type="button" onClick={() => onClaim('title')} aria-pressed={selected === 'title'} aria-label="核对页面标题">
              {slide.title.text.trim() || SLIDES[page].title}
            </button>
            {slide.points.some(point => point.field) ? (
              slide.points.map((point, index) => {
                if (!point.field) return null
                const item = FIELD_LAYOUT[point.field]
                const surface = fieldSurface(item)
                return (
                  <button type="button" className={`field-card claim-target${item.emphasis ? ' emphasis' : ''}`}
                    key={point.field} onClick={() => onClaim(index)} aria-pressed={selected === index}
                    style={{
                      left: `${item.x / WIDTH * 100}%`, top: `${item.y / HEIGHT * 100}%`,
                      width: `${item.w / WIDTH * 100}%`, height: `${item.h / HEIGHT * 100}%`,
                      color: `#${surface.text}`, backgroundColor: `#${surface.fill}`, borderColor: `#${surface.border}`, '--field-label': `#${surface.label}`,
                    } as CSSProperties}>
                    <span className="field-caption">{FIELDS[point.field].label}{statusOf(point) === '待核实' && <i title="待核实" />}</span>
                    <strong className={point.text.length > 48 ? 'long' : undefined}>{point.text.trim() || '待确认'}</strong>
                  </button>
                )
              })
            ) : (
              <ol className="slide-points">
                {slide.points.map((point, index) => (
                  <li key={index}>
                    <button type="button" className="claim-target" onClick={() => onClaim(index)} aria-pressed={selected === index} aria-label={`核对要点 ${index + 1}`}>
                      <span className="point-index">{padded(index)}</span>
                      <span className={point.text.length > 53 ? 'point-text long' : 'point-text'}>{point.text.trim() || '待补充'}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className="slide-footer"><span>{deck.input.project}</span><span>{padded(page)} / 05</span></div>
          </div>
        )}
      </div>

      <nav className="slide-strip" aria-label="幻灯片页码">
        {SLIDES.map((item, index) => (
          <button key={item.key} type="button" className="slide-tab" disabled={!deck} aria-current={slide && index === page ? 'page' : undefined} onClick={() => onPage(index)}>
            <span>{padded(index)}</span><strong>{item.title}</strong>
          </button>
        ))}
      </nav>

      <div className="preview-footer">
        <span>{slide && page > 0
          ? (counts.pending || counts.missing
            ? [counts.pending && `${counts.pending} 处待核实`, counts.missing && `${counts.missing} 处待补充`].filter(Boolean).join(' · ')
            : '点预览里的文字，可核对原文。')
          : '导出的 PPTX 可以在 PowerPoint 里继续编辑。'}</span>
        <span className="page-position">{slide ? padded(page) : '–'} / 05</span>
      </div>
    </section>
  )
}
