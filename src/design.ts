import type { Field, SlideKind } from './deck.ts'

export const COLORS = {
  paper: 'FFFCF4',
  white: 'FFFFFF',
  ink: '172B27',
  muted: '53645C',
  line: 'DFE3D7',
  forest: '153B32',
  forestDeep: '11322B',
  forestLine: '3D6153',
  mint: 'C9E7AC',
  sage: 'AEC1A7',
  summary: 'DDEACF',
  progress: 'D4EAE4',
  risks: 'F7E4C0',
  decisions: 'CBE2D4',
} as const

export const ACCENT: Record<Exclude<SlideKind, 'cover'>, string> = {
  summary: COLORS.summary,
  progress: COLORS.progress,
  risks: COLORS.risks,
  decisions: COLORS.decisions,
}

export const COVER_MARKS = [
  { index: '01', label: '本周完成', color: COLORS.mint },
  { index: '02', label: '发版风险', color: 'F2D395' },
  { index: '03', label: '会上要定', color: 'C4DFD3' },
]

export const WIDTH = 40 / 3
export const HEIGHT = 7.5

export type FieldLayout = { x: number; y: number; w: number; h: number; tone?: 'forest' | 'amber'; emphasis?: boolean }

export const FIELD_LAYOUT: Record<Field, FieldLayout> = {
  issue: { x: .85, y: 2.42, w: 6.05, h: 3.71, tone: 'amber', emphasis: true },
  impact: { x: 7.08, y: 2.42, w: 5.4, h: 1.76 },
  next: { x: 7.08, y: 4.36, w: 5.4, h: 1.77 },
  decision: { x: .85, y: 2.32, w: 11.63, h: 1.55, tone: 'forest', emphasis: true },
  owner: { x: .85, y: 4.04, w: 5.74, h: .94 },
  deadline: { x: 6.74, y: 4.04, w: 5.74, h: .94 },
  basis: { x: .85, y: 5.16, w: 11.63, h: 1.07 },
}

export function fieldSurface(layout: FieldLayout) {
  if (layout.tone === 'forest') return { fill: COLORS.forest, text: COLORS.paper, label: COLORS.mint, border: COLORS.forest }
  if (layout.tone === 'amber') return { fill: 'F7ECD1', text: COLORS.ink, label: '755019', border: 'E6D5AD' }
  return { fill: COLORS.white, text: COLORS.ink, label: COLORS.muted, border: COLORS.line }
}
