# Underline

Underline 是一个本地优先的阅读导师插件。它不做逐词释义，而是在你划出卡住的词句后，插入一段同语言的桥接解释，帮你补上真正缺失的背景框架。

## 当前 v1 目标

第一阶段只服务一个场景：

1. 打开普通网页文章
2. 开启导师模式
3. 划出 1 到 3 处不懂的词句
4. 如已配置真实模型，可从 popup 查看清洗后的正文
5. 生成桥接解释
6. 重生成或删除
7. 刷新页面后状态保持稳定

如果真实模型可用，桥接会显示为 `AI bridge`。如果没配置模型或上游失败，桥接会明确显示为 `AI demo`，并带出回退原因。
真实模型模式会先把当前页可见文本清洗成正文并缓存在浏览器本地；清洗失败时会明确降级到邻近段落模式。

## 仓库结构

- `apps/extension`: WXT + React 浏览器扩展
- `apps/api`: TypeScript 本地 API，负责模型调用和 Demo 回退
- `packages/shared`: 共享 schema 和类型
- `docs/prd/underline-self-use-v1.md`: 当前唯一 PRD
- `docs/adr/`: 关键产品与工程决策
- `issues/`: 本地 issue 看板
- `skills/`: 项目级 Matt Pocock 风格 skills

## 推荐启动方式

默认只推荐这一种本地使用方式：

1. 安装依赖：`npm install`
2. 启动完整自用链路：`npm run demo:start`
3. 打开 `chrome://extensions`
4. 刷新 `Underline`
5. 刷新要测试的文章页面
6. 打开插件 popup，点击 `开启导师模式`
7. 划词后点击右下角解释按钮

停止本地 API：

- `npm run demo:stop`

说明：

- `demo:start` 会先构建扩展和 API，再确保本地 API 在 `http://localhost:8787` 运行
- 扩展导入目录固定是 `apps/extension/.output/chrome-mv3`
- 本地 API 日志在 `.logs/underline-api.log`
- `.underline-runtime.json` 只保存本机运行时模型配置，已被 `.gitignore` 忽略

## 模型配置

1. 打开插件 popup，保持“本地 API Base URL”为 `http://localhost:8787`
2. 进入设置页填写：
   - `模型 API URL`
   - `模型 API Key`
   - `模型名`
3. 先点“测试模型连接”，通过后再点“保存全部设置”

没配置真实模型时，系统仍然能工作，但会明确走 `AI demo` 路径。

## 开发工作流

这个仓库按 Matt Pocock 的思路推进产品改造：

1. 先用 `grill-me` 对齐真实需求
2. 更新 `docs/prd/underline-self-use-v1.md`
3. 把工作拆进 `issues/`
4. 一次只做一个 AFK issue
5. 用 `tdd` 落地
6. 完成后把 issue 移到 `issues/done/`

## 进阶开发

如果你正在改代码，而不是高频使用产品：

- `npm run dev:api`
- `npm run dev:extension`

## 验证命令

- `npm run test`
- `npm run typecheck`
- `npm run build`
