export const LIMITS = { project: 28, period: 24, notes: 5200, title: 36, point: 72, points: 3 } as const

export const SLIDES = [
  { key: 'cover', title: '封面', eyebrow: 'PROJECT BRIEF' },
  { key: 'summary', title: '本周摘要', eyebrow: 'EXECUTIVE SUMMARY' },
  { key: 'progress', title: '已完成事项', eyebrow: 'DELIVERED' },
  { key: 'risks', title: '风险与阻塞', eyebrow: 'RISKS & BLOCKERS' },
  { key: 'decisions', title: '下一步与待决策', eyebrow: 'NEXT STEPS' },
] as const

export type SlideKind = (typeof SLIDES)[number]['key']
export type BriefInput = { project: string; period: string; notes: string }
export type Source = { id: string; text: string }
export type Point = { text: string; sourceIds: string[]; edited?: boolean; needsReview?: boolean }
export type Slide = { kind: SlideKind; title: string; points: Point[] }
export type Deck = {
  input: BriefInput
  sources: Source[]
  slides: Slide[]
  origin: 'example' | 'anna'
  usage?: { model?: string; cu?: number }
}

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
  if (!project) throw new Error('请先填写项目名称。')
  if (!notes) throw new Error('请先粘贴研发笔记。')
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

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('无效的 JSON 对象')
  return value as Record<string, unknown>
}

function line(value: unknown, limit: number): string {
  if (typeof value !== 'string') throw new Error('缺少文本')
  const text = value.trim().replace(/\s+/g, ' ')
  if (!text || text.length > limit) throw new Error('文本长度无效')
  return text
}

export function parseDeck(response: string, input: BriefInput, origin: Deck['origin']): Deck {
  const sources = splitSources(input.notes)
  const knownIds = new Set(sources.map(source => source.id))
  const fenced = response.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  try {
    const result = record(JSON.parse(fenced ? fenced[1] : response))
    const rawSlides = result.slides
    if (!Array.isArray(rawSlides) || rawSlides.length !== SLIDES.length - 1) throw new Error('页数无效')
    const contentSlides: Slide[] = SLIDES.slice(1).map((definition, index) => {
      const rawSlide = record(rawSlides[index])
      if (rawSlide.kind !== definition.key) throw new Error('页面顺序无效')
      if (!Array.isArray(rawSlide.points) || !rawSlide.points.length || rawSlide.points.length > LIMITS.points) {
        throw new Error('要点数量无效')
      }
      return {
        kind: definition.key,
        title: line(rawSlide.title, LIMITS.title),
        points: rawSlide.points.map((value: unknown): Point => {
          const point = record(value)
          const suppliedIds = Array.isArray(point.sourceIds) ? point.sourceIds : []
          const sourceIds = [...new Set(suppliedIds.filter(
            (id): id is string => typeof id === 'string' && knownIds.has(id),
          ))]
          return {
            text: line(point.text, LIMITS.point),
            sourceIds,
            needsReview: !sourceIds.length || suppliedIds.some(id => !knownIds.has(id)),
          }
        }),
      }
    })
    return { input, sources, origin, slides: [{ kind: 'cover', title: input.project, points: [] }, ...contentSlides] }
  } catch {
    throw new Error('Anna 返回的内容格式不完整或超出页面限制。请重试，或缩短原始笔记。')
  }
}

export function pointStatus(point: Point): '已编辑' | '待核实' | '有出处' {
  if (point.needsReview || !point.sourceIds.length) return '待核实'
  return point.edited ? '已编辑' : '有出处'
}

export function sourceMap(sources: Source[]): Map<string, string> {
  return new Map(sources.map(({ id, text }) => [id, text]))
}
