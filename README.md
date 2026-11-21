# 进展成页 · Sprint Brief

给研发周会准备的 PPT 工具。粘贴周报、任务列表或会议笔记，整理出本周摘要、已完成事项、风险和待决策。逐条点开原文，改好后导出 PowerPoint。

- App Name — **进展成页 · Sprint Brief**
- 建议 Slug — **`sprint-brief`**（以 staging 登记值为准）
- [实施计划](PLAN.md)

## 试用

打开应用后有一份订单台的示例。先选「风险与阻塞」，点标题。右侧能看到周一关单和周四复现的两条记录。再翻到「待决策」，拍板人仍显示「待确认」。

在侧栏可以改文字、调整出处或标为已核对。改动过文字或引用，就需要重新核对。数字与所引原文出现差异时会提示。核对状态由用户标记，存在引用只代表能定位到原笔记。

导出之前会显示待核实项、缺项和还未人工核对的内容。对外发的文件可取消「在演讲者备注中附原文」。标题、要点和形状都能在 PowerPoint 里编辑。应用自动保存一份当前草稿。修改素材时，原草稿仍保留旧笔记的出处。

## 本地运行

需要 Node.js 22.18+、npm。Anna 本地调试环境还需要 Astral uv（`uv`、`uvx` 在 PATH 上）。

```bash
npm ci
npm run dev
```

独立本地界面支持示例核对、编辑、恢复和导出。在 Anna 的本地调试环境可以走模拟生成流程：

```bash
npm run build
npm run validate
npm run dev:anna
```

打开 `http://localhost:5180/`。保持该服务运行，在另一个终端执行：

```bash
npm test
npm run test:browser
```

测试浏览器可以使用 Windows 上的 Edge，或用 `BROWSER_EXECUTABLE` 指定已有的 Chrome / Chromium。测试截图和 PPTX 位于 `test-output/`。本地浏览器测试使用 Anna 官方调试环境，模拟模型回包和生产存储的跨窗口行为，不扣 CU。

## Staging 验收与发布

1. 到 [Anna staging 开发者控制台](https://staging.anna.partners/developer)完成邮箱验证和开发者激活。
2. 在项目根目录运行以下命令，在浏览器确认本人账号授权：

   ```bash
   npm exec -- anna-app login --host https://staging.anna.partners
   npm exec -- anna-app whoami
   npm run build
   npm run validate
   npm exec -- anna-app apps push --account https://staging.anna.partners
   ```

3. 打开 staging 里的测试版本。用一份常规素材和内置冲突示例各做一次生成，记录首轮是否成功、耗时和实际 CU。检查标题与要点出处、冲突保留、负责人留空、刷新恢复以及导出。
4. 使用控制台的 Versions 页或 CLI 固化并送审：

   ```bash
   npm exec -- anna-app apps cut 0.2.0 --account https://staging.anna.partners
   npm exec -- anna-app apps submit-review --account https://staging.anna.partners
   ```

5. 若审批后显示 APPROVED，在 Versions 页发布，或执行 `npm exec -- anna-app apps release 0.2.0 --account https://staging.anna.partners`。从普通账号验证可发现、安装和生成。提交 GitHub 地址、平台 App Name 和 Slug。

官方文档：[本地调试](https://staging.anna.partners/developers/apps/local-dev)、[模型接口](https://staging.anna.partners/developers/apps/llm-and-agent)、[草稿存储](https://staging.anna.partners/developers/reference/host-api-storage)、[发布流程](https://staging.anna.partners/developers/apps/app-publish)。

## 实现

- `src/anna.ts` 通过 Anna SDK 生成草稿，记录模型回包中的 CU 和本地测得的耗时。遇到截断或无可用内容时保留旧草稿。
- `src/deck.ts` 校验结构和出处，保留可用页面，把缺项留给人工补充。
- `src/drafts.ts` 从笔记快照恢复出处，Anna 上默认使用当前用户的 App 存储。有 etag 时以版本条件保存，避免用旧数据覆盖新版。
- `src/design.ts` 提供风险页和决策页的共同布局，`src/export.ts` 生成可编辑的 PPTX。
