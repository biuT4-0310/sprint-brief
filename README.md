# 进展成页 · Sprint Brief

把零散研发笔记整理成一份能在项目会上使用的汇报。Anna 负责提炼要点，用户可核对每条要点的原文、修改表述，并导出可编辑的 PowerPoint。

- App Name — **进展成页 · Sprint Brief**
- 本地配置 Slug — **`sprint-brief`**（以 staging 登记值为准）
- [实施计划与验收](PLAN.md)

## 体验路径

初次打开会显示内置示例，可以预览、修改和导出。点「新建汇报」后粘贴自己的笔记，每行一个事实或待办。点「用 Anna 生成」可以把素材整理成封面、本周摘要、已完成事项、风险与阻塞、下一步与待决策五页。

在任意内容页点击来源编号，右侧会高亮生成时的原文。更改素材后，当前草稿仍使用旧快照，重新生成才会更新出处。编辑过的要点保留修改前的参考片段，标记「已编辑」。缺少或含无效出处的要点标记「待核实」。引用编号只用于定位原文，读者自行核对语义是否一致。

导出的标题、要点和形状都是 PowerPoint 原生对象。原文随对应页的演讲者备注导出。素材和草稿仅保留在当前应用窗口，关闭前可导出文件。

## 本地运行

需要 Node.js 22.18+、npm。Anna 官方本地调试环境还需要 Astral uv（`uv`、`uvx` 在 PATH 上）。

```bash
npm ci
npm run dev
```

Vite 预览支持示例编辑和导出。AI 生成按钮在 Anna 窗口内启用。用官方调试环境和模拟模型回包联调，无需消耗额度：

```bash
npm run build
npm run validate
npm run dev:anna
```

打开 `http://localhost:5180/`。保留服务运行，在另一个终端执行：

```bash
npm test
npm run test:browser
```

浏览器测试需要 Windows 上已安装的 Edge，或通过 `BROWSER_EXECUTABLE` 指定已有的 Chromium / Chrome 可执行文件。也可用 `npm exec -- playwright-core install chromium` 安装测试浏览器。测试截图与 PPTX 放在被 Git 忽略的 `test-output/`。

## Staging 交付

1. 在 [Anna staging 开发者控制台](https://staging.anna.partners/developer)完成邮箱验证与开发者激活。
2. 从仓库根目录执行以下命令，用本人浏览器确认 CLI 授权：

   ```bash
   npm exec -- anna-app login --host https://staging.anna.partners
   npm exec -- anna-app whoami
   npm run build
   npm run validate
   npm exec -- anna-app apps push --account https://staging.anna.partners
   ```

3. 在控制台打开 App 的测试版本。用示例笔记点击一次「用 Anna 生成」，确认能得到五页、来源可定位、风险保留不确定性、修改后可下载，以及 PowerPoint 能打开。记录页面返回的 CU（如有）和 staging 余额变动。若真实验证发现问题，修复后更新 working draft。
4. 用控制台的 Versions 页或 CLI 固化版本并送审：

   ```bash
   npm exec -- anna-app apps cut 0.1.0 --account https://staging.anna.partners
   npm exec -- anna-app apps submit-review --account https://staging.anna.partners
   ```

5. 如果审批后状态为 APPROVED，在 Versions 页发布，或执行 `npm exec -- anna-app apps release 0.1.0 --account https://staging.anna.partners`。状态成为 PUBLISHED 后，从普通账号确认 App 可发现和使用。提交 GitHub 仓库地址、平台显示的 App Name 和 Slug。

官方入口：[本地调试](https://staging.anna.partners/developers/apps/local-dev)、[模型接口](https://staging.anna.partners/developers/apps/llm-and-agent)、[发布流程](https://staging.anna.partners/developers/apps/app-publish)。

## 实现

```text
原始笔记 → 行编号 → Anna SDK 单次生成 → 结构和来源编号校验
                                    → 可编辑草稿 → 预览 / PPTX
```

- `src/anna.ts` 通过 Anna iframe SDK 调用 `llm.complete`，记录回包中的用量字段。限制输出长度，遇到截断或格式错误时，让用户显式重试并保留旧草稿。
- `src/deck.ts` 统一素材切分、页序、文本长度和引用校验。来源原文始终从输入快照重建。
- `src/export.ts` 在浏览器中生成 PPTX。生成后逐页编辑、查看原文与导出均复用已有草稿。
- `manifest.json` 声明应用窗口，`app.json` 提供商店信息，`bundle/` 是可上传的构建产物。
