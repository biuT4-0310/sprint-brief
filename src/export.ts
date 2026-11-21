import PptxGenJS from 'pptxgenjs'
import { FIELDS, SLIDES, labelForPoint, reviewSummary, sourceMap, statusOf } from './deck.ts'
import type { Claim, Deck } from './deck.ts'
import { ACCENT, COLORS, COVER_MARKS, FIELD_LAYOUT, HEIGHT, WIDTH, fieldSurface } from './design.ts'

const FONT = 'Microsoft YaHei'

function noteFor(label: string, claim: Claim, sources: Map<string, string>, includeSources: boolean) {
  const refs = includeSources ? claim.sourceIds.map(id => `[${id}] ${sources.get(id)}`) : []
  return [`${label}（${statusOf(claim)}） ${claim.text || '待确认'}`, ...refs].join('\n')
}

export async function buildPptx(deck: Deck, includeSources = true): Promise<Blob> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = '进展成页 · Sprint Brief'
  pptx.title = deck.slides[0].title.text || deck.input.project
  pptx.subject = '研发周报'
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

  const sources = sourceMap(deck.sources)
  const text = { fontFace: FONT, color: COLORS.ink, margin: 0 }
  const shapes = pptx.ShapeType

  for (const [page, slide] of deck.slides.entries()) {
    const output = pptx.addSlide()
    const definition = SLIDES[page]
    const number = String(page + 1).padStart(2, '0')
    const title = slide.title.text.trim() || (page ? definition.title : deck.input.project)

    if (slide.kind === 'cover') {
      output.background = { color: COLORS.forest }
      output.addShape(shapes.rect, {
        x: 0.62, y: 0.58, w: WIDTH - 1.24, h: HEIGHT - 1.16,
        line: { color: COLORS.forestLine }, fill: { color: COLORS.forest, transparency: 100 },
      })
      output.addText('研发周报', { ...text, x: 1, y: .94, w: 6.4, h: .36, color: COLORS.mint, fontSize: 16, bold: true })
      output.addText(title, {
        ...text, x: .98, y: 2.15, w: 6.85, h: 2.15, color: COLORS.paper,
        fontSize: title.length > 17 ? 32 : 53, bold: true, fit: 'shrink', valign: 'middle',
      })
      if (deck.input.period) {
        output.addText(deck.input.period, { ...text, x: 1, y: 5.62, w: 6.2, h: .37, color: COLORS.paper, fontSize: 16, fit: 'shrink' })
      }
      for (const [index, mark] of COVER_MARKS.entries()) {
        const x = 8.35 + index * .35
        const y = 1.89 + index * 1.25
        output.addShape(shapes.rect, { x, y, w: 3.06, h: 1.02, fill: { color: COLORS.forestDeep }, line: { color: COLORS.forestLine } })
        output.addShape(shapes.rect, { x, y, w: .075, h: 1.02, fill: { color: mark.color }, line: { transparency: 100 } })
        output.addText(mark.index, { ...text, x: x + .24, y: y + .23, w: .47, h: .52, color: mark.color, bold: true, fontSize: 13 })
        output.addText(mark.label, { ...text, x: x + .8, y: y + .23, w: 1.98, h: .52, color: COLORS.paper, bold: true, fontSize: 21 })
      }
      output.addText('01 / 05', { ...text, x: 10.7, y: 6.27, w: 1.55, h: .27, color: COLORS.sage, align: 'right', fontSize: 12 })
      continue
    }

    output.background = { color: COLORS.paper }
    const accent = ACCENT[slide.kind]
    output.addShape(shapes.rect, { x: 0, y: 0, w: WIDTH, h: .08, fill: { color: accent }, line: { transparency: 100 } })
    output.addText(definition.title, { ...text, x: .85, y: .56, w: 11.6, h: .34, color: COLORS.forest, bold: true, fontSize: 14 })
    output.addText(title, {
      ...text, x: .85, y: 1.06, w: 11.6, h: 1.21, bold: true, fit: 'shrink', valign: 'middle',
      fontSize: title.length > 20 ? 32 : 40,
    })

    for (const [index, point] of slide.points.entries()) {
      if (point.field) {
        const item = FIELD_LAYOUT[point.field]
        const { text: ink, fill, label, border } = fieldSurface(item)
        const { x, y, w, h } = item
        output.addShape(shapes.rect, { x, y, w, h, fill: { color: fill }, line: { color: border } })
        const compact = h < 1.1
        const caption = FIELDS[point.field].label
        const status = statusOf(point)
        const labelText = status === '待核实' ? `${caption}  ·  待核实` : caption
        output.addText(labelText, {
          ...text, x: x + .19, y: y + (compact ? .1 : .2), w: w - .38, h: .24,
          color: label, bold: true, fontSize: 11,
        })
        const bodyY = compact ? .38 : .57
        output.addText(point.text.trim() || '待确认', {
          ...text, x: x + .19, y: y + bodyY, w: w - .38, h: h - bodyY - .09,
          color: ink, bold: Boolean(item.emphasis), fit: 'shrink', valign: 'middle',
          fontSize: item.emphasis ? (point.text.length > 46 ? 18 : 24) : (compact || point.text.length > 40 ? 15 : 17),
        })
        continue
      }
      const y = 2.55 + index * 1.14
      output.addShape(shapes.rect, { x: .85, y, w: 11.63, h: .92, fill: { color: COLORS.white }, line: { color: COLORS.line } })
      output.addShape(shapes.rect, { x: 1.06, y: y + .21, w: .47, h: .47, fill: { color: accent }, line: { transparency: 100 } })
      output.addText(String(index + 1).padStart(2, '0'), { ...text, x: 1.06, y: y + .21, w: .47, h: .47, fontSize: 12, bold: true, align: 'center' })
      output.addText(point.text.trim() || '待补充', {
        ...text, x: 1.77, y: y + .07, w: 10.36, h: .78, fit: 'shrink', valign: 'middle',
        fontSize: point.text.length > 53 ? 17 : 21,
      })
    }

    output.addShape(shapes.line, { x: .85, y: 6.59, w: 11.63, h: 0, line: { color: COLORS.line } })
    output.addText(deck.input.project, { ...text, x: .85, y: 6.78, w: 5.5, h: .31, color: COLORS.muted, fontSize: 12, fit: 'shrink' })
    const counts = reviewSummary([slide])
    const warnings = [counts.pending && `${counts.pending} 处待核实`, counts.missing && `${counts.missing} 处待补充`].filter(Boolean).join('    ')
    if (warnings) output.addText(warnings, { ...text, x: 6.35, y: 6.78, w: 4.4, h: .31, color: '755019', fontSize: 12, align: 'right' })
    output.addText(`${number} / 05`, { ...text, x: 10.9, y: 6.78, w: 1.58, h: .31, color: COLORS.muted, fontSize: 12, align: 'right' })
    output.addNotes([
      noteFor('页面标题', slide.title, sources, includeSources),
      ...slide.points.map((point, index) => noteFor(labelForPoint(point, index), point, sources, includeSources)),
    ].join('\n\n'))
  }

  const output = await pptx.write({ outputType: 'blob', compression: true })
  if (!(output instanceof Blob)) throw new Error('PPTX 文件生成失败')
  return output
}

export function filenameForDeck(deck: Deck): string {
  const title = deck.slides[0].title.text.trim() || deck.input.project
  const safe = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').trim().replace(/[.\s]+$/, '')
  return `研发周报 - ${safe || '未命名项目'}.pptx`
}

export async function downloadDeck(deck: Deck, includeSources: boolean): Promise<void> {
  const blob = await buildPptx(deck, includeSources)
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filenameForDeck(deck)
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
