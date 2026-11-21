import { ArrowDownToLine, ArrowRight, Layers3, LoaderCircle, NotebookPen, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { connectAnna, generateDeck, generationError, inAnnaWindow } from './anna.ts'
import type { AnnaRuntime } from './anna.ts'
import { EMPTY_INPUT, LIMITS, claimAt, emptyClaim, reviewSummary, sameInput, splitSources, statusOf, updateClaim } from './deck.ts'
import type { BriefInput, Claim, Slide, Where } from './deck.ts'
import { annaDraftStore, browserDraftStore } from './drafts.ts'
import type { DraftStore } from './drafts.ts'
import { EXAMPLE_INPUT, exampleDeck } from './example.ts'
import { Inspector } from './Inspector.tsx'
import type { InspectorTab } from './Inspector.tsx'
import { Preview } from './Preview.tsx'
import { useWorkspace } from './useWorkspace.ts'

type Connection = 'connecting' | 'ready' | 'offline' | 'error'
type DialogMode = 'new' | 'example' | 'generate' | 'export'

const SAVE_LABELS = {
  idle: '', restored: '已恢复上次草稿', saving: '保存中…', saved: '已保存',
  failed: '草稿保存失败', unavailable: '草稿未保存',
  conflict: '另一个窗口更新了草稿。当前内容可以先导出。',
}

export function App() {
  const [connection, setConnection] = useState<Connection>(() => inAnnaWindow() ? 'connecting' : 'offline')
  const runtime = useRef<AnnaRuntime | null>(null)
  const [store, setStore] = useState<DraftStore | null>()
  const { workspace, write, ready, status, retry } = useWorkspace(store)
  const { input, deck, edited } = workspace
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<InspectorTab>('sources')
  const [selected, setSelected] = useState<Where>('title')
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [generationMessage, setGenerationMessage] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [includeSources, setIncludeSources] = useState(true)
  const dialog = useRef<HTMLDialogElement>(null)
  const projectInput = useRef<HTMLInputElement>(null)
  const [dialogMode, setDialogMode] = useState<DialogMode>('new')

  useEffect(() => {
    if (!inAnnaWindow()) {
      try { setStore(browserDraftStore(window.localStorage)) } catch { setStore(null) }
      return
    }
    let active = true
    connectAnna().then(value => {
      if (!active) return
      runtime.current = value
      setStore(annaDraftStore(value.storage))
      setConnection('ready')
    }).catch(() => {
      if (!active) return
      setStore(null)
      setConnection('error')
    })
    return () => { active = false }
  }, [])

  const sources = useMemo(() => deck?.sources ?? splitSources(input.notes), [deck, input.notes])
  const slide = deck?.slides[page]
  const counts = reviewSummary(deck?.slides ?? [])
  const inputChanged = Boolean(deck && !sameInput(deck.input, input))
  const blocked = !ready || generating
  const canGenerate = Boolean(!blocked && input.project.trim() && input.notes.trim() && connection === 'ready')

  function changeInput(key: keyof BriefInput, text: string) {
    write(current => ({ ...current, input: { ...current.input, [key]: text } }))
    setGenerationMessage('')
  }

  function selectPage(index: number, where: Where = 'title') {
    setPage(index)
    setSelected(where)
    setTab(index ? 'edit' : 'sources')
  }

  function selectClaim(where: Where, fromPreview = false) {
    setSelected(where)
    setTab('edit')
    if (fromPreview && window.matchMedia('(max-width: 770px)').matches) {
      document.getElementById('inspector-title')?.scrollIntoView({ block: 'start' })
    }
  }

  function reset(mode: 'new' | 'example') {
    write(mode === 'example' ? { input: { ...EXAMPLE_INPUT }, deck: exampleDeck(), edited: false } : { input: { ...EMPTY_INPUT }, deck: null, edited: false })
    selectPage(0)
    setGenerationMessage('')
    setExportMessage('')
    if (mode === 'new') window.requestAnimationFrame(() => projectInput.current?.focus())
  }

  function show(mode: DialogMode) {
    setDialogMode(mode)
    dialog.current?.showModal()
  }

  function requestReset(mode: 'new' | 'example') {
    if (edited || inputChanged || deck?.origin === 'anna' || (!deck && (input.project || input.period || input.notes))) show(mode)
    else reset(mode)
  }

  async function runGeneration() {
    if (!runtime.current || !canGenerate) return
    setGenerating(true)
    setGenerationMessage('')
    setExportMessage('')
    try {
      const generated = await generateDeck(runtime.current, input)
      write({ input, deck: generated, edited: false })
      selectPage(1)
    } catch (error) {
      setGenerationMessage(generationError(error))
    } finally {
      setGenerating(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (edited) show('generate')
    else void runGeneration()
  }

  async function savePptx() {
    if (!deck || exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      const { downloadDeck } = await import('./export.ts')
      await downloadDeck(deck, includeSources)
      setExportMessage('已生成 PPTX。请查看浏览器下载记录。')
    } catch {
      setExportMessage('导出失败，草稿已保留。可以再试一次。')
    } finally {
      setExporting(false)
    }
  }

  function editSlide(update: (value: Slide) => Slide) {
    if (blocked) return
    write(current => current.deck ? {
      ...current,
      edited: true,
      deck: { ...current.deck, slides: current.deck.slides.map((value, index) => index === page ? update(value) : value) },
    } : current)
    setExportMessage('')
  }

  function editClaim(update: (value: Claim) => Claim) {
    editSlide(value => selected === 'title'
      ? { ...value, title: update(value.title) }
      : { ...value, points: value.points.map((point, index) => index === selected ? { ...point, ...update(point) } : point) })
  }

  function pendingClaim() {
    if (!deck) return
    for (const [index, value] of deck.slides.entries()) {
      if (index === 0) continue
      if (statusOf(value.title) === '待核实') { selectPage(index); return }
      const point = value.points.findIndex(item => statusOf(item) === '待核实')
      if (point >= 0) { selectPage(index, point); return }
    }
  }

  const connectionLabel = { connecting: '连接 Anna…', ready: 'Anna 已连接', offline: '本地预览', error: 'Anna 未连接' }[connection]
  const dialogTitle = { new: '新建汇报？', example: '换成示例？', generate: '重新生成？', export: '导出 PPTX' }[dialogMode]
  const currentClaim = slide && claimAt(slide, selected)
  const usage = deck?.usage

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon"><Layers3 size={21} strokeWidth={2.1} /></span>
          <strong>进展成页</strong>
        </div>
        <div className="header-actions">
          <span className={`connection ${connection}`}><i />{connectionLabel}</span>
          <button type="button" className="button secondary" aria-label="新建汇报" onClick={() => requestReset('new')} disabled={blocked}><Plus size={17} />新建</button>
          <button type="button" className="button primary export-button" disabled={!deck || !ready || exporting} onClick={() => show('export')}>
            {exporting ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />}
            {exporting ? '导出中…' : '导出 PPTX'}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="intro">
          <div>
            <h1>研发周报</h1>
            <p>从研发笔记整理汇报。点一下页里的文字，就能回看原文。</p>
          </div>
          <div className="draft-meta" aria-live="polite">
            {deck?.origin === 'example' && <span className="draft-tag">示例</span>}
            {usage?.model === 'mock' && <span className="draft-tag">本地模拟</span>}
            {usage && usage.model !== 'mock' && (
              <span>{[
                usage.elapsedMs !== undefined && `${(usage.elapsedMs / 1000).toFixed(1)} 秒`,
                usage.cu !== undefined && `${usage.cu.toLocaleString('zh-CN', { maximumFractionDigits: 3 })} CU`,
              ].filter(Boolean).join(' · ')}</span>
            )}
            {!!counts.pending && <button className="pending-link" type="button" onClick={pendingClaim}>{counts.pending} 处待核实</button>}
            {SAVE_LABELS[status] && <span className="save-status">{SAVE_LABELS[status]}</span>}
            {status === 'failed' && <button className="text-button" type="button" onClick={retry}>重试保存</button>}
          </div>
        </div>
        {exportMessage && <div className="export-feedback" role="status">{exportMessage}</div>}

        <div className="workspace">
          <section className="panel material-panel" aria-labelledby="material-title">
            <div className="panel-header">
              <div className="panel-title"><NotebookPen size={17} /><h2 id="material-title">汇报素材</h2></div>
              <button className="text-button" type="button" onClick={() => requestReset('example')} disabled={blocked}>载入示例</button>
            </div>

            <form className="material-form" onSubmit={submit}>
              <div className="form-field">
                <label className="field-label" htmlFor="project-name">项目名称</label>
                <input ref={projectInput} id="project-name" required maxLength={LIMITS.project} value={input.project} onChange={event => changeInput('project', event.target.value)} disabled={blocked} placeholder="例如：订单台 2.0" />
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="report-period">汇报周期 <span>选填</span></label>
                <input id="report-period" maxLength={LIMITS.period} value={input.period} onChange={event => changeInput('period', event.target.value)} disabled={blocked} placeholder="例如：11 月 16 日到 11 月 20 日" />
              </div>
              <div className="form-field notes-field">
                <label className="field-label" htmlFor="raw-notes">研发笔记</label>
                <textarea id="raw-notes" required maxLength={LIMITS.notes} value={input.notes} onChange={event => changeInput('notes', event.target.value)} disabled={blocked} placeholder="粘贴周报、任务记录或会议纪要。每行一条，方便回查。" rows={8} />
                <span className="char-count">{input.notes.length.toLocaleString('zh-CN')} / 5,200</span>
              </div>
              {inputChanged && <p className="material-message">素材改过了，当前草稿仍引用上次的笔记。</p>}
              {generationMessage && <p className="error-message" role="alert">{generationMessage}</p>}
              <button className="button primary generate-button" type="submit" disabled={!canGenerate}>
                {generating && <LoaderCircle className="spin" size={16} />}
                <span>{generating ? '正在整理…' : '生成草稿'}</span>
                {!generating && <ArrowRight className="button-arrow" size={16} />}
              </button>
              <p className="generation-hint">
                {connection === 'offline' ? '从 Anna 打开后可生成。' :
                 connection === 'error' ? '请重新打开应用连接 Anna。' :
                 connection === 'connecting' || !ready ? '正在打开草稿。' :
                 '用 Anna 生成会消耗额度。'}
              </p>
              {!!deck?.incomplete && !!counts.missing && <p className="material-message">有页面没生成完整，缺项可以手动补。</p>}
            </form>
          </section>

          <Preview deck={deck} page={page} selected={tab === 'edit' ? selected : null} onPage={selectPage} onClaim={where => selectClaim(where, true)} />
          <Inspector slide={slide} sources={sources} selected={selected} tab={tab} disabled={blocked}
            onTab={setTab} onSelect={selectClaim}
            onText={text => { if (currentClaim?.text !== text) editClaim(claim => updateClaim(claim, { text })) }}
            onSources={sourceIds => editClaim(claim => updateClaim(claim, { sourceIds }))}
            onCheck={checked => editClaim(claim => ({ ...claim, checked }))}
            onDelete={() => {
              editSlide(value => ({ ...value, points: value.points.filter((_, index) => index !== selected) }))
              setSelected('title')
            }}
            onAdd={() => {
              if (!slide) return
              editSlide(value => ({ ...value, points: [...value.points, emptyClaim()] }))
              setSelected(slide.points.length)
            }}
          />
        </div>
      </main>

      <dialog ref={dialog} aria-labelledby="dialog-title">
        <form method="dialog" className="confirm-dialog">
          <h2 id="dialog-title">{dialogTitle}</h2>
          {dialogMode === 'export' ? (
            <>
              {(counts.pending || counts.missing || counts.linked) ? (
                <p>{[
                  counts.pending && `${counts.pending} 处待核实`,
                  counts.missing && `${counts.missing} 处待补充`,
                  counts.linked && `${counts.linked} 处已关联原文、未人工核对`,
                ].filter(Boolean).join('，')}。</p>
              ) : <p>标题和要点可以在 PowerPoint 中继续编辑。</p>}
              <label className="export-option"><input type="checkbox" checked={includeSources} onChange={event => setIncludeSources(event.target.checked)} />在演讲者备注中附原文</label>
            </>
          ) : <p>{dialogMode === 'generate' ? '新草稿生成后会替换这份草稿和核对记录。' : '当前草稿会被替换。'}</p>}
          <div>
            <button className="button secondary" type="submit" autoFocus>{dialogMode === 'export' ? '返回' : '取消'}</button>
            <button className="button primary" type="submit" onClick={() => {
              if (dialogMode === 'export') void savePptx()
              else if (dialogMode === 'generate') void runGeneration()
              else reset(dialogMode)
            }}>
              {{ export: '下载 PPTX', generate: '重新生成', new: '新建汇报', example: '载入示例' }[dialogMode]}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
