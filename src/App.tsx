import { ArrowDownToLine, ArrowRight, Braces, CircleHelp, FileText, Layers3, LoaderCircle, NotebookPen, Plus, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { connectAnna, generateDeck, generationError, inAnnaWindow } from './anna.ts'
import type { AnnaRuntime } from './anna.ts'
import { EMPTY_INPUT, LIMITS, sameInput, splitSources } from './deck.ts'
import type { BriefInput, Deck, Slide } from './deck.ts'
import { EXAMPLE_INPUT, exampleDeck } from './example.ts'
import { Inspector } from './Inspector.tsx'
import type { InspectorTab } from './Inspector.tsx'
import { Preview } from './Preview.tsx'

type Connection = 'connecting' | 'ready' | 'offline' | 'error'

export function App() {
  const [input, setInput] = useState<BriefInput>({ ...EXAMPLE_INPUT })
  const [deck, setDeck] = useState<Deck | null>(exampleDeck)
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<InspectorTab>('sources')
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [connection, setConnection] = useState<Connection>(() => inAnnaWindow() ? 'connecting' : 'offline')
  const runtime = useRef<AnnaRuntime | null>(null)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [generationMessage, setGenerationMessage] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const resetDialog = useRef<HTMLDialogElement>(null)
  const projectInput = useRef<HTMLInputElement>(null)
  const [resetMode, setResetMode] = useState<'new' | 'example'>('new')
  const [edited, setEdited] = useState(false)
  const [regenerate, setRegenerate] = useState(false)

  useEffect(() => {
    if (!inAnnaWindow()) return
    let cancelled = false
    connectAnna().then(value => {
      if (cancelled) return
      runtime.current = value
      setConnection('ready')
    }).catch(() => {
      if (!cancelled) setConnection('error')
    })
    return () => { cancelled = true }
  }, [])

  const sources = useMemo(() => deck?.sources ?? splitSources(input.notes), [deck, input.notes])
  const inputChanged = Boolean(deck && !sameInput(deck.input, input))
  const canGenerate = Boolean(input.project.trim() && input.notes.trim() && connection === 'ready')
  const canExport = Boolean(deck?.slides.every(slide => slide.title.trim() && slide.points.every(point => point.text.trim())))

  function changeInput(key: keyof BriefInput, text: string) {
    setInput(current => ({ ...current, [key]: text }))
    setGenerationMessage('')
  }

  function setWorkspace(next: Deck | null) {
    setDeck(next)
    setPage(0)
    setTab('sources')
    setActiveSource(null)
    setEdited(false)
    setGenerationMessage('')
    setExportMessage('')
  }

  function reset(mode: 'new' | 'example') {
    setRegenerate(false)
    setInput(mode === 'example' ? { ...EXAMPLE_INPUT } : { ...EMPTY_INPUT })
    setWorkspace(mode === 'example' ? exampleDeck() : null)
    if (mode === 'new') projectInput.current?.focus()
  }

  function requestReset(mode: 'new' | 'example') {
    if (edited || inputChanged || deck?.origin === 'anna' || (!deck && input.notes.trim())) {
      setResetMode(mode)
      resetDialog.current?.showModal()
      return
    }
    reset(mode)
  }

  async function runGeneration() {
    if (!runtime.current || generating) return
    setGenerating(true)
    setGenerationMessage('')
    setExportMessage('')
    try {
      const generated = await generateDeck(runtime.current, input)
      setWorkspace(generated)
      setPage(1)
      setTab('edit')
    } catch (error) {
      setGenerationMessage(generationError(error))
    } finally {
      setGenerating(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (edited) {
      setRegenerate(true)
      resetDialog.current?.showModal()
      return
    }
    void runGeneration()
  }

  async function save() {
    if (!deck || !canExport || exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      const { downloadDeck } = await import('./export.ts')
      await downloadDeck(deck)
      setExportMessage('PPTX 已生成。请查看浏览器下载记录。')
    } catch {
      setExportMessage('导出失败，请重试。当前草稿已保留。')
    } finally {
      setExporting(false)
    }
  }

  function selectPage(index: number) {
    setPage(index)
    setActiveSource(null)
    setTab(index ? 'edit' : 'sources')
  }

  function selectSource(id: string) {
    setActiveSource(id)
    setTab('sources')
  }

  function editSlide(update: (slide: Slide) => Slide) {
    setDeck(current => current && {
      ...current,
      slides: current.slides.map((slide, index) => index === page ? update(slide) : slide),
    })
    setEdited(true)
    setExportMessage('')
  }

  const connectionLabel = { connecting: '正在连接 Anna', ready: 'Anna 已连接', offline: '本地预览', error: 'Anna 连接失败' }[connection]
  const dialogTitle = regenerate ? '生成新的草稿？' : resetMode === 'new' ? '新建汇报？' : '载入示例？'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon"><Layers3 size={21} strokeWidth={2.1} /></span>
          <span><strong>进展成页</strong><span className="brand-en">SPRINT BRIEF</span></span>
        </div>
        <div className="header-actions">
          <span className={`connection ${connection}`}><i />{connectionLabel}</span>
          <button type="button" className="button secondary" aria-label="新建汇报" onClick={() => requestReset('new')} disabled={generating}><Plus size={17} />新建<span className="hide-small">汇报</span></button>
          <button type="button" className="button primary export-button" onClick={save} disabled={!canExport || exporting}
            title={deck && !canExport ? '请补全空白的标题或要点。' : undefined}>
            {exporting ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />}
            {exporting ? '正在导出' : '导出 PPTX'}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="intro">
          <div>
            <h1>研发汇报工作台</h1>
            <p>把零散笔记整理成能核对原文的项目汇报。</p>
          </div>
          {deck && (
            <div className="draft-meta">
              <span className={deck.origin === 'example' ? 'draft-tag sample' : 'draft-tag'}>{deck.origin === 'example' ? <Braces size={14} /> : <Sparkles size={14} />}{deck.origin === 'example' ? '示例草稿' : 'Anna 生成'}</span>
              {deck.origin === 'anna' && deck.usage?.cu !== undefined && <span>本次 {deck.usage.cu.toLocaleString('zh-CN', { maximumFractionDigits: 3 })} CU</span>}
            </div>
          )}
        </div>

        {exportMessage && <div className="export-feedback" role="status">{exportMessage}</div>}

        <div className="workspace">
          <section className="panel material-panel" aria-labelledby="material-title">
            <div className="panel-header">
              <div className="panel-title"><NotebookPen size={18} /><h2 id="material-title">汇报素材</h2></div>
              <button className="text-button" type="button" onClick={() => requestReset('example')} disabled={generating}>载入示例</button>
            </div>

            <form className="material-form" onSubmit={submit}>
              <div className="form-field">
                <label className="field-label" htmlFor="project-name">项目名称</label>
                <input ref={projectInput} id="project-name" required maxLength={LIMITS.project} value={input.project} onChange={event => changeInput('project', event.target.value)} disabled={generating} placeholder="例如：订单台 2.0" />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="report-period">汇报周期<span>选填</span></label>
                <input id="report-period" maxLength={LIMITS.period} value={input.period} onChange={event => changeInput('period', event.target.value)} disabled={generating} placeholder="例如：11 月 16 日 — 11 月 20 日" />
              </div>
              <div className="form-field notes-field">
                <label className="field-label" htmlFor="raw-notes">研发笔记</label>
                <textarea id="raw-notes" required maxLength={LIMITS.notes} value={input.notes} onChange={event => changeInput('notes', event.target.value)} disabled={generating} placeholder="粘贴任务列表或会议纪要。每行写一条，方便回查原文。" rows={8} />
                <span className="char-count">{input.notes.length.toLocaleString('zh-CN')} / 5,200</span>
              </div>
              {inputChanged && <p className="material-message"><FileText size={14} />素材已变更。草稿仍引用上次生成时的原文。</p>}
              {generationMessage && <p className="error-message" role="alert">{generationMessage}</p>}
              <button className="button primary generate-button" type="submit" disabled={!canGenerate || generating}>
                {generating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
                <span>{generating ? 'Anna 正在整理汇报…' : '用 Anna 生成'}</span>
                {!generating && <ArrowRight className="button-arrow" size={16} />}
              </button>
              <p className="generation-hint" aria-live="polite">
                <CircleHelp size={14} />
                {connection === 'offline' ? '从 Anna 平台打开即可使用 AI 生成。' :
                 connection === 'error' ? '请重新打开 Anna 应用窗口恢复连接。' :
                 connection === 'connecting' ? '正在连接 Anna 平台。' :
                 '生成会消耗 Anna 额度，浏览和编辑无需调用。'}
              </p>
            </form>
          </section>

          <Preview deck={deck} page={page} onPage={selectPage} onSource={selectSource} />
          <Inspector deck={deck} page={page} sources={sources} activeSource={activeSource} tab={tab}
            onTab={next => { setActiveSource(null); setTab(next) }} onSource={selectSource}
            onTitle={title => editSlide(slide => ({ ...slide, title }))}
            onPoint={(index, text) => editSlide(slide => ({
              ...slide,
              points: slide.points.map((point, pointIndex) => pointIndex === index ? { ...point, text, edited: true } : point),
            }))}
            onDelete={index => editSlide(slide => ({ ...slide, points: slide.points.filter((_, pointIndex) => pointIndex !== index) }))}
          />
        </div>
      </main>

      <dialog ref={resetDialog} onClose={() => setRegenerate(false)}>
        <form method="dialog" className="confirm-dialog">
          <h2>{dialogTitle}</h2>
          <p>当前草稿和改动将被替换。</p>
          <div>
            <button className="button secondary" type="submit" autoFocus>取消</button>
            <button className="button primary" type="submit" onClick={() => { if (regenerate) void runGeneration(); else reset(resetMode) }}>
              {regenerate ? '重新生成' : resetMode === 'new' ? '新建汇报' : '载入示例'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
