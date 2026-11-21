import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import JSZip from 'jszip'
import { chromium } from 'playwright-core'

const url = process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5180/'
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const executablePath = process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined)

test('Anna mock: review conflicting notes, export, recover a draft, preserve it on failure', { timeout: 45_000 }, async () => {
  await mkdir('test-output', { recursive: true })
  const browser = await chromium.launch({ executablePath })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, acceptDownloads: true })
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let saved
    let version = 0
    let rejectWrites = false
    let requests = 0
    await page.route('**/api/session/call', async route => {
      const body = route.request().postDataJSON()
      if (body.ns === 'llm' && body.method === 'complete') {
        requests++
        if (JSON.stringify(body.args).includes('测试标记：触发截断')) {
          return route.fulfill({ json: { ok: true, result: { stopReason: 'maxTokens' } } })
        }
      }
      if (body.ns === 'storage' && body.method === 'get' && saved) {
        return route.fulfill({ json: { ok: true, result: { exists: true, value: saved, etag: String(version) } } })
      }
      if (body.ns === 'storage' && body.method === 'set') {
        if (rejectWrites) return route.fulfill({ json: { ok: false, error: { code: 'precondition_failed', message: 'etag mismatch' } } })
        const response = await route.fetch()
        const json = await response.json()
        if (json.ok) {
          saved = body.args.value
          json.result.etag = String(++version)
        }
        return route.fulfill({ response, json })
      }
      await route.continue()
    })
    await page.goto(url)
    const app = page.frameLocator('#app')
    await app.getByText('Anna 已连接', { exact: true }).waitFor()
    await app.getByRole('button', { name: '生成草稿', exact: true }).waitFor()
    await app.getByText('示例', { exact: true }).waitFor()
    await app.locator('.app-shell').screenshot({ path: 'test-output/workspace-v2.png' })
    await app.getByRole('button', { name: '生成草稿', exact: true }).click()
    await app.getByText('本地模拟', { exact: true }).waitFor()

    await app.getByRole('button', { name: '04 风险与阻塞' }).click()
    await app.getByRole('button', { name: '核对页面标题' }).click()
    await app.getByText('笔记中的记录有出入。').waitFor()
    assert.match(await app.locator('.cited-list').innerText(), /周一记录.*\n[\s\S]*周四回归/)
    await app.locator('.app-shell').screenshot({ path: 'test-output/risk-review-v2.png' })
    await app.getByRole('button', { name: '标为已核对' }).click()
    await app.getByText('已核对', { exact: true }).waitFor()
    await app.getByRole('textbox', { name: '页面标题' }).fill('导出超时关单后，周四仍复现')
    await app.getByText('文字或出处已修改，请重新核对。').waitFor()
    await app.getByRole('button', { name: '调整出处' }).click()
    await app.locator('.source-picker').getByRole('checkbox', { name: /S06/ }).check()
    await app.getByRole('button', { name: '收起' }).click()
    assert.match(await app.locator('.cited-list').innerText(), /任务排队日志/)
    await app.getByRole('button', { name: '标为已核对' }).click()
    await app.getByText('已保存', { exact: true }).waitFor()

    await app.getByRole('button', { name: '05 待决策' }).click()
    await app.locator('.canvas').getByRole('button', { name: '谁来决定 待确认' }).click()
    await app.getByRole('textbox', { name: '谁来决定' }).waitFor()
    await app.locator('.app-shell').screenshot({ path: 'test-output/decision-v2.png' })
    await app.getByRole('button', { name: '导出 PPTX' }).click()
    assert.match(await app.getByRole('dialog').innerText(), /1 处待补充/)
    await app.getByRole('checkbox', { name: '在演讲者备注中附原文' }).uncheck()
    const download = page.waitForEvent('download')
    await app.getByRole('button', { name: '下载 PPTX' }).click()
    await (await download).saveAs('test-output/public-v2.pptx')
    const zip = await JSZip.loadAsync(await readFile('test-output/public-v2.pptx'))
    assert.match(await zip.file('ppt/slides/slide4.xml').async('string'), /导出超时关单后，周四仍复现/)
    assert.doesNotMatch(await zip.file('ppt/notesSlides/notesSlide4.xml').async('string'), /\[S03\]/)

    await app.getByRole('button', { name: '导出 PPTX' }).click()
    await app.getByRole('checkbox', { name: '在演讲者备注中附原文' }).check()
    const withNotes = page.waitForEvent('download')
    await app.getByRole('button', { name: '下载 PPTX' }).click()
    await (await withNotes).saveAs('test-output/verification-v2.pptx')

    await page.reload()
    await app.getByText('已恢复上次草稿', { exact: true }).waitFor()
    await app.getByRole('button', { name: '04 风险与阻塞' }).click()
    await app.getByRole('textbox', { name: '页面标题' }).waitFor()
    assert.equal(await app.getByRole('textbox', { name: '页面标题' }).inputValue(), '导出超时关单后，周四仍复现')
    await app.getByRole('button', { name: '撤销核对' }).waitFor()

    await app.getByRole('textbox', { name: '研发笔记' }).fill('测试标记：触发截断')
    await app.getByText('素材改过了，当前草稿仍引用上次的笔记。').waitFor()
    await app.getByRole('button', { name: '生成草稿', exact: true }).click()
    await app.getByRole('button', { name: '重新生成', exact: true }).click()
    await app.getByRole('alert').filter({ hasText: '被截断' }).waitFor()
    assert.equal(await app.getByRole('textbox', { name: '页面标题' }).inputValue(), '导出超时关单后，周四仍复现')
    assert.equal(requests, 2)

    rejectWrites = true
    await app.getByRole('textbox', { name: '页面标题' }).fill('当前窗口有新改动')
    await app.getByText('另一个窗口更新了草稿。当前内容可以先导出。').waitFor()
    assert.equal(await app.getByRole('textbox', { name: '页面标题' }).inputValue(), '当前窗口有新改动')

    await page.setViewportSize({ width: 390, height: 820 })
    await page.locator('#app').evaluate(frame => { frame.style.width = '370px' })
    const fits = await app.locator('body').evaluate(element => element.scrollWidth <= element.clientWidth)
    assert.ok(fits)
    await app.getByRole('button', { name: '05 待决策' }).click()
    await app.getByRole('button', { name: '做什么决定', exact: true }).click()
    await app.getByRole('textbox', { name: '做什么决定' }).fill('看'.repeat(64) + '终')
    const fieldFits = await app.locator('.field-card.emphasis').evaluate(card => card.scrollHeight <= card.clientHeight + 1)
    assert.ok(fieldFits)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})
