import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import JSZip from 'jszip'
import { chromium } from 'playwright-core'

const url = process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5180/'
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const executablePath = process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined)

test('mock Anna iframe supports generation, source lookup, editing and PPTX downloads', { timeout: 40_000 }, async () => {
  await mkdir('test-output', { recursive: true })
  const browser = await chromium.launch({ executablePath })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, acceptDownloads: true })
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/session/call', async route => {
      const body = route.request().postDataJSON()
      if (body.ns !== 'llm' || body.method !== 'complete' || !JSON.stringify(body.args).includes('测试标记：触发截断')) {
        await route.continue()
        return
      }
      await route.fulfill({ json: { ok: true, result: { stopReason: 'maxTokens' } } })
    })
    await page.goto(url)
    const app = page.frameLocator('#app')
    await app.getByText('Anna 已连接', { exact: true }).waitFor()
    await app.getByText('示例草稿', { exact: true }).waitFor()
    await app.locator('.app-shell').screenshot({ path: 'test-output/workspace.png' })
    await app.getByRole('button', { name: '用 Anna 生成' }).click()
    await app.getByText('Anna 生成', { exact: true }).waitFor()
    await app.getByRole('button', { name: '05 下一步与待决策' }).click()
    await app.getByRole('textbox', { name: '要点 1' }).fill('周五发版前请负责人确认导出入口策略。')
    await app.getByText('已编辑', { exact: true }).waitFor()
    await app.getByRole('button', { name: '查看原文 S04' }).last().click()
    await app.locator('#source-S04.highlight').waitFor()
    await app.locator('.app-shell').screenshot({ path: 'test-output/traceability.png' })
    assert.match(await app.locator('#source-S04').innerText(), /周五计划发版/)

    const downloadEvent = page.waitForEvent('download')
    await app.getByRole('button', { name: '导出 PPTX' }).click()
    const download = await downloadEvent
    assert.match(download.suggestedFilename(), /订单台 2\.0\.pptx$/)
    const output = 'test-output/verification.pptx'
    await download.saveAs(output)
    const zip = await JSZip.loadAsync(await readFile(output))
    assert.match(await zip.file('ppt/slides/slide5.xml').async('string'), /负责人确认导出入口策略/)
    assert.match(await zip.file('ppt/notesSlides/notesSlide5.xml').async('string'), /\[S04\]/)

    await app.getByRole('textbox', { name: '研发笔记' }).fill('测试标记：触发截断')
    await app.getByText('素材已变更。草稿仍引用上次生成时的原文。').waitFor()
    await app.getByRole('button', { name: '用 Anna 生成' }).click()
    await app.getByRole('button', { name: '重新生成', exact: true }).click()
    await app.getByRole('alert').filter({ hasText: '输出被截断' }).waitFor()
    await app.getByText('周五发版前请负责人确认导出入口策略。', { exact: true }).first().waitFor()

    await app.getByRole('button', { name: '新建汇报' }).first().click()
    await app.getByRole('button', { name: '取消' }).click()
    await app.getByRole('button', { name: '新建汇报' }).first().click()
    await app.locator('dialog').getByRole('button', { name: '新建汇报' }).click()
    await app.getByRole('heading', { name: '汇报预览' }).waitFor()
    assert.equal(await app.getByRole('button', { name: '导出 PPTX' }).isDisabled(), true)
    await app.getByRole('button', { name: '载入示例' }).click()
    await app.getByText('示例草稿', { exact: true }).waitFor()

    const body = app.locator('body')
    await page.setViewportSize({ width: 390, height: 820 })
    await page.locator('#app').evaluate(frame => { frame.style.width = '370px' })
    const fits = await body.evaluate(element => element.scrollWidth <= element.clientWidth)
    assert.ok(fits)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})
