export const LIMITS = { project: 28, period: 24, notes: 5200, title: 36, point: 72, points: 3 } as const

export const FIELDS = {
  issue: { label: '已知现象', limit: 72 },
  impact: { label: '影响范围', limit: 60 },
  next: { label: '下一步验证', limit: 60 },
  decision: { label: '做什么决定', limit: 65 },
  owner: { label: '谁来决定', limit: 24 },
  deadline: { label: '何时决定', limit: 24 },
  basis: { label: '决策依据', limit: 65 },
} as const

export type Field = keyof typeof FIELDS

export const SLIDES = [
  { key: 'cover', title: '封面', fields: [] },
  { key: 'summary', title: '本周摘要', fields: [] },
  { key: 'progress', title: '已完成', fields: [] },
  { key: 'risks', title: '风险与阻塞', fields: ['issue', 'impact', 'next'] },
  { key: 'decisions', title: '待决策', fields: ['decision', 'owner', 'deadline', 'basis'] },
] as const satisfies readonly { key: string; title: string; fields: readonly Field[] }[]

export type SlideKind = (typeof SLIDES)[number]['key']
export type BriefInput = { project: string; period: string; notes: string }
export type Source = { id: string; text: string }
export type Claim = {
  text: string
  sourceIds: string[]
  reviewNote?: string
  checked?: boolean
}
export type Point = Claim & { field?: Field }
export type Slide = { kind: SlideKind; title: Claim; points: Point[] }
export type Deck = {
  input: BriefInput
  sources: Source[]
  slides: Slide[]
  origin: 'example' | 'anna'
  usage?: { model?: string; cu?: number; elapsedMs?: number }
  incomplete?: number
}

export type Where = 'title' | number
export type ReviewState = '待补充' | '待核实' | '已关联' | '已核对'
export const EMPTY_INPUT: BriefInput = { project: '', period: '', notes: '' }

export function splitSources(notes: string): Source[] {
  return notes
    .split(/\r\n|\r|\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `S${String(index + 1).padStart(2, '0')}`, text }))
}

export function normalizeInput(input: BriefInput): BriefInput {
  const project = input.project.trim()
  const period = input.period.trim()
  const notes = input.notes.trim()
  if (!project) throw new Error('请填写项目名称。')
  if (!notes) throw new Error('请粘贴研发笔记。')
  if (project.length > LIMITS.project || period.length > LIMITS.period || notes.length > LIMITS.notes) {
    throw new Error('项目名称、汇报周期或笔记超出长度限制。')
  }
  return { project, period, notes }
}

export function sameInput(first: BriefInput, second: BriefInput): boolean {
  return first.project.trim() === second.project.trim() &&
    first.period.trim() === second.period.trim() &&
    first.notes.trim() === second.notes.trim()
}

export function sourceMap(sources: Source[]): Map<string, string> {
  return new Map(sources.map(({ id, text }) => [id, text]))
}

export const emptyClaim = (): Claim => ({ text: '', sourceIds: [] })

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function numbers(text: string): Set<string> {
  return new Set(text.normalize('NFKC').match(/[0-9]+(?:\.[0-9]+)?(?:\s*%)?/g)?.map(value => value.replace(/\s/g, '')))
}

function parseClaim(value: unknown, limit: number, sources: Map<string, string>): Claim {
  const raw = typeof value === 'string' ? { text: value } : record(value)
  const text = (typeof raw.text === 'string' ? raw.text : '').trim().replace(/\s+/g, ' ')
  const supplied = Array.isArray(raw.sourceIds) ? raw.sourceIds : []
  const sourceIds = [...new Set(supplied.filter((id): id is string => typeof id === 'string' && sources.has(id)))]
  const claim: Claim = { text: text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text, sourceIds }
  if (text.length > limit) claim.reviewNote = '原句太长，已截短。'
  else if (supplied.some(id => typeof id !== 'string' || !sources.has(id))) claim.reviewNote = '有出处编号找不到对应的原文。'
  else if (raw.conflicting === true) claim.reviewNote = '笔记中的记录有出入。'
  else if (sourceIds.length) {
    const citedNumbers = numbers(sourceIds.map(id => sources.get(id)).join('\n'))
    if ([...numbers(text)].some(number => !citedNumbers.has(number))) claim.reviewNote = '有数字未在所引原文中找到。'
  }
  return claim
}

export function parseDeck(response: string, input: BriefInput, origin: Deck['origin']): Deck {
  const sources = splitSources(input.notes)
  const lookup = sourceMap(sources)
  const rawSlides = readSlides(response).map(record)
  let incomplete = 0
  const content: Slide[] = SLIDES.slice(1).map(definition => {
    const raw = rawSlides.find(slide => slide.kind === definition.key) ?? {}
    const rawPoints: unknown[] = Array.isArray(raw.points) ? raw.points : []
    const definitionFields: readonly Field[] = definition.fields
    const title = parseClaim(raw.title, LIMITS.title, lookup)
    const points = definitionFields.length
      ? definitionFields.map(field => ({ ...parseClaim(rawPoints.find(point => record(point).field === field), FIELDS[field].limit, lookup), field }))
      : rawPoints.slice(0, LIMITS.points).map(point => parseClaim(point, LIMITS.point, lookup))
    if (!title.text || !Array.isArray(raw.points) || (!definitionFields.length && !points.some(point => point.text))) incomplete++
    return { kind: definition.key, title, points: points.length ? points : [emptyClaim()] }
  })
  if (!content.some(slide => slide.title.text || slide.points.some(point => point.text))) {
    throw new Error('Anna 返回的内容无法整理成草稿。已有草稿已保留，可以重试。')
  }
  return {
    input, sources, origin, incomplete,
    slides: [{ kind: 'cover', title: { text: input.project, sourceIds: [] }, points: [] }, ...content],
  }
}

function readSlides(response: string): unknown[] {
  const fenced = [...response.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(match => match[1])
  const candidates = [response, ...fenced]
  for (const { index } of response.matchAll(/\{\s*"slides"\s*:/g)) {
    const end = objectEnd(response, index)
    if (end !== -1) candidates.push(response.slice(index, end + 1))
  }
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate.trim())
      const slides = Array.isArray(value) ? value : record(value).slides
      if (Array.isArray(slides) && slides.some(slide => SLIDES.slice(1).some(definition => definition.key === record(slide).kind))) return slides
    } catch { /* try the next candidate */ }
  }
  return []
}

function objectEnd(text: string, start: number): number {
  let depth = 0
  let quoted = false
  for (let index = start; index < text.length; index++) {
    const character = text[index]
    if (quoted && character === '\\') { index++; continue }
    if (character === '"') { quoted = !quoted; continue }
    if (quoted) continue
    if (character === '{') depth++
    if (character === '}' && --depth === 0) return index
  }
  return -1
}

export function statusOf(claim: Claim): ReviewState {
  if (!claim.text.trim()) return '待补充'
  if (claim.checked && claim.sourceIds.length) return '已核对'
  if (claim.reviewNote || !claim.sourceIds.length) return '待核实'
  return '已关联'
}

export function updateClaim(claim: Claim, changes: Pick<Claim, 'text'> | Pick<Claim, 'sourceIds'>): Claim {
  return { ...claim, ...changes, checked: false, reviewNote: '文字或出处已修改，请重新核对。' }
}

export function labelForPoint(point: Point, index: number): string {
  return point.field ? FIELDS[point.field].label : `要点 ${index + 1}`
}

export function claimAt(slide: Slide, where: Where): Claim | undefined {
  return where === 'title' ? slide.title : slide.points[where]
}

export function reviewSummary(slides: Slide[]) {
  let pending = 0
  let missing = 0
  let linked = 0
  let checked = 0
  for (const slide of slides) {
    if (slide.kind === 'cover') continue
    for (const claim of [slide.title, ...slide.points]) {
      const status = statusOf(claim)
      if (status === '待核实') pending++
      if (status === '待补充') missing++
      if (status === '已关联') linked++
      if (status === '已核对') checked++
    }
  }
  return { pending, missing, linked, checked }
}
