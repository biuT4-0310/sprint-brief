import { FIELDS, LIMITS, SLIDES, splitSources } from './deck.ts'
import type { BriefInput, Claim, Deck, Point } from './deck.ts'
import type { AnnaStorage } from './anna.ts'

const KEY = 'sprint-brief/workspace-v2'
export type Workspace = { input: BriefInput; deck: Deck | null; edited: boolean }
export type DraftStore = { load(): Promise<Workspace | null>; save(workspace: Workspace): Promise<void> }

function validInput(value: unknown): value is BriefInput {
  if (!value || typeof value !== 'object') return false
  const input = value as BriefInput
  return typeof input.project === 'string' && input.project.length <= LIMITS.project &&
    typeof input.period === 'string' && input.period.length <= LIMITS.period &&
    typeof input.notes === 'string' && input.notes.length <= LIMITS.notes
}

function validClaim(value: unknown, limit: number, sources: Set<string>): value is Claim {
  if (!value || typeof value !== 'object') return false
  const claim = value as Claim
  return typeof claim.text === 'string' && claim.text.length <= limit &&
    Array.isArray(claim.sourceIds) && claim.sourceIds.every(id => sources.has(id)) &&
    (claim.reviewNote === undefined || typeof claim.reviewNote === 'string') &&
    (claim.checked === undefined || typeof claim.checked === 'boolean')
}

function validPoints(points: unknown, fields: readonly (keyof typeof FIELDS)[], sources: Set<string>): points is Point[] {
  if (!Array.isArray(points)) return false
  if (fields.length) {
    return points.length === fields.length && fields.every((field, index) =>
      validClaim(points[index], FIELDS[field].limit, sources) && (points[index] as Point).field === field)
  }
  return points.length <= LIMITS.points && points.every(point => validClaim(point, LIMITS.point, sources) && (point as Point).field === undefined)
}

export function decodeWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object') return null
  const { input, deck, edited } = value as Workspace
  if (!validInput(input) || typeof edited !== 'boolean') return null
  if (deck === null) return { input, deck, edited }
  if (!deck || !validInput(deck.input) || !['example', 'anna'].includes(deck.origin) ||
      !Array.isArray(deck.slides) || deck.slides.length !== SLIDES.length) return null
  const sources = splitSources(deck.input.notes)
  const ids = new Set(sources.map(source => source.id))
  for (const [index, { key, fields }] of SLIDES.entries()) {
    const slide = deck.slides[index]
    if (slide?.kind !== key || !validClaim(slide.title, LIMITS.title, ids) || !validPoints(slide.points, fields, ids)) return null
  }
  return { input, edited, deck: { ...deck, sources } }
}

export function browserDraftStore(storage: Storage): DraftStore {
  return {
    async load() { return decodeWorkspace(JSON.parse(storage.getItem(KEY) ?? 'null')) },
    async save(workspace) { storage.setItem(KEY, JSON.stringify(workspace)) },
  }
}

export function annaDraftStore(storage: AnnaStorage): DraftStore {
  let etag: string | undefined
  return {
    async load() {
      const result = await storage.get({ key: KEY })
      etag = result.etag
      return decodeWorkspace(result.value)
    },
    async save(value) {
      const result = await storage.set({ key: KEY, value, ...(etag && { if_match: etag }) })
      etag = result.etag
    },
  }
}

export function isDraftConflict(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : ''
  return /precondition_failed|etag.+mismatch/i.test(`${code} ${message}`)
}
