import type { SlideKind } from './deck.ts'

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
  decisions: 'E3E4F5',
} as const

export const ACCENT: Record<Exclude<SlideKind, 'cover'>, string> = {
  summary: COLORS.summary,
  progress: COLORS.progress,
  risks: COLORS.risks,
  decisions: COLORS.decisions,
}

export const COVER_MARKS = [
  { index: '01', label: '进展', color: COLORS.mint },
  { index: '02', label: '风险', color: 'F2D395' },
  { index: '03', label: '决策', color: 'CFD8FA' },
]
