import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { buildPptx, filenameForDeck } from '../src/export.ts'
import { generateDeck, makeRequest } from '../src/anna.ts'
import { normalizeInput, parseDeck, reviewSummary, sameInput, splitSources, statusOf, updateClaim } from '../src/deck.ts'
import { annaDraftStore, decodeWorkspace, isDraftConflict } from '../src/drafts.ts'
import { EXAMPLE_INPUT, EXAMPLE_RESPONSE, exampleDeck } from '../src/example.ts'

test('source IDs ignore blank lines and normalize line endings', () => {
  assert.deepEqual(splitSources('  第一行 \r\n\r\n 第二行\r第三行\n'), [
    { id: 'S01', text: '第一行' }, { id: 'S02', text: '第二行' }, { id: 'S03', text: '第三行' },
  ])
  assert.ok(sameInput(EXAMPLE_INPUT, { ...EXAMPLE_INPUT, notes: EXAMPLE_INPUT.notes + '\n' }))
  assert.throws(() => normalizeInput({ ...EXAMPLE_INPUT, notes: ' ' }), /粘贴研发笔记/)
})

test('titles are linked, conflicting notes keep both sources and the missing owner stays blank', () => {
  const deck = exampleDeck()
  assert.equal(deck.slides[1].title.sourceIds[0], 'S01')
  const risk = deck.slides[3]
  assert.deepEqual(risk.points[0].sourceIds, ['S03', 'S04'])
  assert.equal(statusOf(risk.points[0]), '待核实')
  assert.match(risk.points[0].reviewNote!, /有出入/)
  assert.equal(deck.slides[4].points[1].field, 'owner')
  assert.equal(statusOf(deck.slides[4].points[1]), '待补充')
  assert.equal(reviewSummary(deck.slides).missing, 1)
})

test('forged references, suspect numbers and clipped claims are flagged', () => {
  const raw = structuredClone(EXAMPLE_RESPONSE)
  raw.slides[0].title.sourceIds = ['S01', 'S99', 'S01']
  raw.slides[0].points[0].text = '超时率为 25%'
  raw.slides[0].points[2].text = '长'.repeat(80)
  const deck = parseDeck('```json\n' + JSON.stringify(raw) + '\n```', EXAMPLE_INPUT, 'anna')
  assert.deepEqual(deck.slides[1].title.sourceIds, ['S01'])
  assert.equal(statusOf(deck.slides[1].title), '待核实')
  assert.match(deck.slides[1].points[0].reviewNote!, /数字/)
  assert.match(deck.slides[1].points[2].reviewNote!, /截短/)
  assert.equal(deck.slides[1].points[2].text.length, 72)
})

test('partial JSON keeps usable slides and editing invalidates a manual check', () => {
  const deck = parseDeck(JSON.stringify({ slides: [EXAMPLE_RESPONSE.slides[3]] }), EXAMPLE_INPUT, 'anna')
  assert.equal(deck.incomplete, 3)
  assert.equal(deck.slides[4].points[0].field, 'decision')
  const point = deck.slides[4].points[0]
  const checked = { ...point, checked: true }
  assert.equal(statusOf(checked), '已核对')
  assert.equal(statusOf(updateClaim(checked, { sourceIds: ['S07'] })), '待核实')
  assert.equal(statusOf(updateClaim(checked, { text: '改写过' })), '待核实')
  const loose = parseDeck('{"slides":[{"kind":"summary","title":"完成回归","points":["测试环境已跑完"]}]}', EXAMPLE_INPUT, 'anna')
  assert.equal(loose.slides[1].points[0].text, '测试环境已跑完')
  assert.equal(statusOf(loose.slides[1].title), '待核实')
  assert.throws(() => parseDeck('{"slides":[]}', EXAMPLE_INPUT, 'anna'), /可用的内容/)
})

test('generation sends one Anna request, records usage and does not retry failures', async () => {
  const requests: unknown[] = []
  const runtime = { llm: { async complete(request: unknown) {
    requests.push(request)
    return { stopReason: 'endTurn', content: { type: 'text', text: JSON.stringify(EXAMPLE_RESPONSE) }, model: 'test', _meta: { quotaConsumed: 0.35 } }
  } } }
  const request = makeRequest(EXAMPLE_INPUT)
  assert.match(request.messages[0].content.text, /"id":"S04"/)
  assert.match(request.messages[0].content.text, /conflicting/)
  const deck = await generateDeck(runtime, EXAMPLE_INPUT)
  assert.deepEqual(requests, [request])
  assert.equal(deck.usage?.cu, .35)
  assert.ok(deck.usage?.elapsedMs !== undefined)
  let calls = 0
  await assert.rejects(generateDeck({ llm: { async complete() { ++calls; return { stopReason: 'maxTokens' } } } }, EXAMPLE_INPUT), /被截断/)
  assert.equal(calls, 1)
})

test('draft restoration reconstructs saved evidence and passes CAS tokens to Anna', async () => {
  const deck = exampleDeck()
  deck.slides[3].points[0].checked = true
  const workspace = { input: { ...EXAMPLE_INPUT, notes: '新素材' }, deck, edited: true }
  const calls: unknown[] = []
  const repo = annaDraftStore({
    async get() { return { value: structuredClone(workspace), etag: 'rev1' } },
    async set(args) { calls.push(args); return { etag: 'rev2' } },
  })
  const restored = await repo.load()
  assert.equal(restored?.input.notes, '新素材')
  assert.match(restored?.deck?.sources[2].text ?? '', /工单已关闭/)
  assert.equal(restored?.deck?.slides[3].points[0].checked, true)
  await repo.save(workspace)
  await repo.save(workspace)
  assert.deepEqual(calls.map(call => (call as { if_match: string }).if_match), ['rev1', 'rev2'])
  assert.ok(isDraftConflict({ code: 'precondition_failed' }))
  assert.equal(decodeWorkspace({ input: 'bad', deck, edited: true }), null)
})

test('meeting pages export native PowerPoint shapes and optionally omit cited text', async () => {
  const deck = exampleDeck()
  deck.slides[4].points[0].checked = true
  const zipped = await JSZip.loadAsync(await (await buildPptx(deck)).arrayBuffer())
  assert.equal(zipped.file(/^ppt\/slides\/slide\d+\.xml$/).length, 5)
  const slide = await zipped.file('ppt/slides/slide5.xml')!.async('string')
  const notes = await zipped.file('ppt/notesSlides/notesSlide5.xml')!.async('string')
  assert.match(slide, /<a:t>谁来决定<\/a:t>/)
  assert.match(slide, /<a:t>待确认<\/a:t>/)
  assert.doesNotMatch(slide, /<p:pic>/)
  assert.match(notes, /\[S05\] 周五计划发版/)
  assert.match(notes, /已核对/)
  const external = await JSZip.loadAsync(await (await buildPptx(deck, false)).arrayBuffer())
  assert.doesNotMatch(await external.file('ppt/notesSlides/notesSlide5.xml')!.async('string'), /\[S05\] 周五计划发版/)
  deck.slides[0].title.text = '周报 / 研发: '
  assert.equal(filenameForDeck(deck), '研发周报 - 周报   研发.pptx')
})
