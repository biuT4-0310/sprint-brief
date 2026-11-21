import { Check, ChevronLeft, ChevronRight, LayoutPanelTop, Link2, ScanLine } from 'lucide-react'
import { SLIDES, pointStatus } from './deck.ts'
import type { Deck } from './deck.ts'
import { ACCENT, COVER_MARKS } from './design.ts'
import type { CSSProperties } from 'react'

const padded = (index: number) => String(index + 1).padStart(2, '0')

export function Preview({ deck, page, onPage, onSource }: {
  deck: Deck | null
  page: number
  onPage: (index: number) => void
  onSource: (id: string) => void
}) {
  const slide = deck?.slides[page]

  return (
    <section className="panel preview-panel" aria-labelledby="preview-title">
      <div className="panel-header preview-header">
        <div className="panel-title"><LayoutPanelTop size={18} /><h2 id="preview-title">幻灯片预览</h2></div>
        <div className="preview-controls">
          <span className="format-label"><ScanLine size={14} /> 16:9</span>
          <button className="icon-button" type="button" onClick={() => onPage(page - 1)} disabled={!slide || page === 0} aria-label="上一页"><ChevronLeft size={16} /></button>
          <button className="icon-button" type="button" onClick={() => onPage(page + 1)} disabled={!slide || page === SLIDES.length - 1} aria-label="下一页"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="canvas">
        {!deck || !slide ? (
          <div className="slide empty-slide">
            <div className="empty-icon"><LayoutPanelTop size={28} /></div>
            <h3>汇报预览</h3><p>填写项目和笔记后，用 Anna 生成草稿。</p>
          </div>
        ) : slide.kind === 'cover' ? (
          <div className="slide cover-slide">
            <div className="cover-border" />
            <div className="cover-kicker"><i /> SPRINT BRIEF <span>/</span> PROJECT UPDATE</div>
            <div className="cover-main">
              <p className={slide.title.length > 17 ? 'cover-title long' : 'cover-title'}>{slide.title}</p>
              <p className="cover-subtitle">研发项目进展汇报</p>
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
            <p className="slide-kicker">{SLIDES[page].title} <span>/</span> {SLIDES[page].eyebrow}</p>
            <h3 className="slide-title">{slide.title}</h3>
            <ol className="slide-points">
              {slide.points.map((point, index) => (
                <li key={index}>
                  <span className="point-index">{padded(index)}</span>
                  <p className={point.text.length > 53 ? 'long' : undefined}>{point.text}</p>
                </li>
              ))}
            </ol>
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
        {slide && slide.points.length > 0 ? (
          <div className="source-shortcuts">
            <Link2 size={15} /><span>本页出处</span>
            {[...new Set(slide.points.flatMap(point => point.sourceIds))].map(id => (
              <button type="button" key={id} className="source-chip" onClick={() => onSource(id)} aria-label={`查看原文 ${id}`}>{id}</button>
            ))}
            {slide.points.some(point => pointStatus(point) === '待核实') && <span className="needs-review">有要点待核实</span>}
          </div>
        ) : (
          <span className="footer-hint"><Check size={15} /> {deck ? 'PPT 文本可编辑，出处随演讲者备注导出。' : '生成后可编辑每页标题和要点。'}</span>
        )}
        <span className="page-position">{slide ? padded(page) : '–'} / 05</span>
      </div>
    </section>
  )
}
