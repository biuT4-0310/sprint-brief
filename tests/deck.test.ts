import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPptx, filenameForDeck } from '../src/export.ts'
import { generateDeck, makeRequest } from '../src/anna.ts'
import { normalizeInput, parseDeck, pointStatus, sameInput, splitSources } from '../src/deck.ts'
import { EXAMPLE_INPUT, exampleDeck } from '../src/example.ts'
import JSZip from 'jszip'

const modelJson = () => ({ slides: exampleDeck().slides.slice(1) })

test('source IDs ignore blank lines and normalize line endings', () => {
  assert.deepEqual(splitSources('  第一行 \r\n\r\n 第二行\r第三行\n'), [
    { id: 'S01', text: '第一行' },
    { id: 'S02', text: '第二行' },
    { id: 'S03', text: '第三行' },
  ])
  assert.ok(sameInput(EXAMPLE_INPUT, { ...EXAMPLE_INPUT, notes: EXAMPLE_INPUT.notes + '\n' }))
  assert.throws(() => normalizeInput({ ...EXAMPLE_INPUT, notes: ' ' }), /粘贴研发笔记/)
})

test('parser keeps original source text and marks unsupported or forged IDs', () => {
  const input = { ...EXAMPLE_INPUT }
  const response = modelJson()
  response.slides[0].points[0].sourceIds = ['S01', 'S01', 'S99']
  response.slides[0].points[1].sourceIds = []
  const draft = parseDeck('```json\n' + JSON.stringify(response) + '\n```', input, 'anna')
  assert.equal(draft.slides.length, 5)
  assert.deepEqual(draft.slides[1].points[0].sourceIds, ['S01'])
  assert.equal(pointStatus(draft.slides[1].points[0]), '待核实')
  assert.equal(pointStatus(draft.slides[1].points[1]), '待核实')
  assert.equal(pointStatus(draft.slides[1].points[2]), '有出处')
  assert.equal(draft.sources[0].text, input.notes.split('\n')[0])
  assert.equal(pointStatus({ ...draft.slides[1].points[2], edited: true }), '已编辑')
})

test('parser rejects missing, out-of-order and oversized pages', () => {
  const response = modelJson()
  assert.throws(() => parseDeck('{"slides":[]}', EXAMPLE_INPUT, 'anna'), /格式不完整/)
  assert.throws(() => parseDeck(JSON.stringify({ slides: response.slides.reverse() }), EXAMPLE_INPUT, 'anna'), /格式不完整/)
  const oversized = modelJson()
  oversized.slides[0].points[0].text = '长'.repeat(73)
  assert.throws(() => parseDeck(JSON.stringify(oversized), EXAMPLE_INPUT, 'anna'), /超出页面限制/)
})

test('generation sends one structured Anna request and records returned usage', async () => {
  const requests: unknown[] = []
  const runtime = { llm: { async complete(request: unknown) {
    requests.push(request)
    return { stopReason: 'endTurn', content: { type: 'text', text: JSON.stringify(modelJson()) }, model: 'test', _meta: { quotaConsumed: 0.35 } }
  } } }
  const request = makeRequest(EXAMPLE_INPUT)
  assert.match(request.messages[0].content.text, /"id":"S04"/)
  assert.match(request.messages[0].content.text, /周五计划发版/)
  const deck = await generateDeck(runtime, EXAMPLE_INPUT)
  assert.deepEqual(requests, [request])
  assert.equal(deck.origin, 'anna')
  assert.equal(deck.usage?.cu, 0.35)
})

test('truncation produces an actionable error without a second call', async () => {
  let calls = 0
  const runtime = { llm: { async complete() {
    calls += 1
    return { stopReason: 'maxTokens' }
  } } }
  await assert.rejects(generateDeck(runtime, EXAMPLE_INPUT), /输出被截断/)
  assert.equal(calls, 1)
})

test('PPTX has five native slides with source text in the right notes', async () => {
  const deck = exampleDeck()
  deck.slides[4].points[0].text = '周五发版前请负责人确认导出入口策略。'
  deck.slides[4].points[0].edited = true
  const blob = await buildPptx(deck)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  assert.equal(zip.file(/^ppt\/slides\/slide\d+\.xml$/).length, 5)
  const slide = await zip.file('ppt/slides/slide5.xml')!.async('string')
  const notes = await zip.file('ppt/notesSlides/notesSlide5.xml')!.async('string')
  assert.match(slide, /<a:t>周五发版前请负责人确认导出入口策略。<\/a:t>/)
  assert.doesNotMatch(slide, /<p:pic>/)
  assert.match(notes, /\[S04\] 周五计划发版，请负责人决定是否先关闭导出入口。/)
  assert.match(notes, /已编辑/)
  deck.slides[0].title = '周报 / 研发: '
  assert.equal(filenameForDeck(deck), '研发周报 - 周报   研发.pptx')
})
