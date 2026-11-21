import PptxGenJS from 'pptxgenjs'
import { pointStatus, SLIDES, sourceMap } from './deck.ts'
import type { Deck, Slide } from './deck.ts'
import { ACCENT, COLORS, COVER_MARKS } from './design.ts'

const WIDTH = 40 / 3
const HEIGHT = 7.5
const FONT = 'Microsoft YaHei'

function labelForNote(point: Slide['points'][number], index: number, sources: Map<string, string>) {
  const refs = point.sourceIds.map(id => `[${id}] ${sources.get(id)}`)
  const status = pointStatus(point)
  const edited = point.edited && status !== '已编辑' ? '，已编辑' : ''
  return [`${index + 1}. ${point.text}（${status}${edited}）`, ...refs].join('\n')
}

export async function buildPptx(deck: Deck): Promise<Blob> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = '进展成页 · Sprint Brief'
  pptx.title = deck.slides[0].title
  pptx.subject = '研发项目进展汇报'
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

  const sources = sourceMap(deck.sources)
  const text = { fontFace: FONT, color: COLORS.ink, margin: 0 }
  const shapes = pptx.ShapeType

  for (const [page, slide] of deck.slides.entries()) {
    const output = pptx.addSlide()
    const definition = SLIDES[page]
    const number = String(page + 1).padStart(2, '0')

    if (slide.kind === 'cover') {
      output.background = { color: COLORS.forest }
      output.addShape(shapes.rect, {
        x: 0.62, y: 0.58, w: WIDTH - 1.24, h: HEIGHT - 1.16,
        line: { color: COLORS.forestLine }, fill: { color: COLORS.forest, transparency: 100 },
      })
      output.addText('SPRINT BRIEF   /   PROJECT UPDATE', {
        ...text, x: 1, y: 0.94, w: 6.4, h: 0.34, color: COLORS.mint, fontSize: 13, bold: true, charSpacing: 1.7,
      })
      output.addText(slide.title, {
        ...text, x: 0.98, y: 2.08, w: 6.85, h: 1.87, color: COLORS.paper,
        fontSize: slide.title.length > 17 ? 32 : 53, bold: true, fit: 'shrink', valign: 'middle',
      })
      output.addText('研发项目进展汇报', {
        ...text, x: 1, y: 4.16, w: 6.3, h: 0.45, color: COLORS.sage, fontSize: 24,
      })
      if (deck.input.period) {
        output.addText(deck.input.period, {
          ...text, x: 1, y: 5.62, w: 6.2, h: 0.37, color: COLORS.paper, fontSize: 16, fit: 'shrink',
        })
      }
      for (const [index, mark] of COVER_MARKS.entries()) {
        const x = 8.35 + index * 0.35
        const y = 1.89 + index * 1.25
        output.addShape(shapes.rect, {
          x, y, w: 3.06, h: 1.02,
          fill: { color: COLORS.forestDeep }, line: { color: COLORS.forestLine },
        })
        output.addShape(shapes.rect, { x, y, w: 0.075, h: 1.02, fill: { color: mark.color }, line: { transparency: 100 } })
        output.addText(mark.index, { ...text, x: x + 0.25, y: y + 0.23, w: 0.47, h: 0.52, color: mark.color, bold: true, fontSize: 13 })
        output.addText(mark.label, { ...text, x: x + 0.82, y: y + 0.23, w: 1.6, h: 0.52, color: COLORS.paper, bold: true, fontSize: 30 })
      }
      output.addText('01  /  05', {
        ...text, x: 10.7, y: 6.27, w: 1.55, h: 0.27, color: COLORS.sage, align: 'right', fontSize: 12,
      })
      continue
    }

    output.background = { color: COLORS.paper }
    const accent = ACCENT[slide.kind]
    output.addShape(shapes.rect, { x: 0, y: 0, w: WIDTH, h: 0.08, fill: { color: accent }, line: { transparency: 100 } })
    output.addText(`${definition.title}   /   ${definition.eyebrow}`, {
      ...text, x: 0.85, y: 0.56, w: 11.6, h: 0.34, color: COLORS.forest, bold: true, fontSize: 14,
    })
    output.addText(slide.title, {
      ...text, x: 0.85, y: 1.06, w: 11.6, h: 1.21, bold: true, fit: 'shrink', valign: 'middle',
      fontSize: slide.title.length > 20 ? 32 : 40,
    })

    for (const [index, point] of slide.points.entries()) {
      const y = 2.55 + index * 1.14
      output.addShape(shapes.rect, {
        x: 0.85, y, w: 11.63, h: 0.92,
        fill: { color: COLORS.white }, line: { color: COLORS.line },
      })
      output.addShape(shapes.rect, {
        x: 1.06, y: y + 0.21, w: 0.47, h: 0.47, fill: { color: accent }, line: { transparency: 100 },
      })
      output.addText(String(index + 1).padStart(2, '0'), {
        ...text, x: 1.06, y: y + 0.21, w: 0.47, h: 0.47, fontSize: 12, bold: true, align: 'center',
      })
      output.addText(point.text, {
        ...text, x: 1.77, y: y + 0.07, w: 10.36, h: 0.78,
        fontSize: point.text.length > 53 ? 17 : 21, fit: 'shrink', valign: 'middle',
      })
    }

    output.addShape(shapes.line, { x: 0.85, y: 6.59, w: 11.63, h: 0, line: { color: COLORS.line } })
    output.addText(deck.input.project, {
      ...text, x: 0.85, y: 6.78, w: 8, h: 0.31, color: COLORS.muted, fontSize: 12, fit: 'shrink',
    })
    output.addText(`${number}  /  05`, {
      ...text, x: 10.9, y: 6.78, w: 1.58, h: 0.31, color: COLORS.muted, fontSize: 12, align: 'right',
    })
    output.addNotes(slide.points.map((point, index) => labelForNote(point, index, sources)).join('\n\n'))
  }

  const output = await pptx.write({ outputType: 'blob', compression: true })
  if (!(output instanceof Blob)) throw new Error('PPTX 文件生成失败')
  return output
}

export function filenameForDeck(deck: Deck): string {
  const title = deck.slides[0].title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').trim().replace(/[.\s]+$/, '')
  return `研发周报 - ${title || '未命名项目'}.pptx`
}

export async function downloadDeck(deck: Deck): Promise<void> {
  const blob = await buildPptx(deck)
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filenameForDeck(deck)
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
