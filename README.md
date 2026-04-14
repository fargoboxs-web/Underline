# Underline

Chrome 阅读导师插件 MVP。它分成三个工作区：

- `apps/extension`: WXT + React 的浏览器插件
- `apps/api`: TypeScript 后端，负责调用模型
- `packages/shared`: 共享 schema 和类型

## 本地启动

1. 安装依赖：`npm install`
2. 启动 API：`npm run dev:api`
3. 启动扩展开发：`npm run dev:extension`

WXT 启动后会生成 Chrome MV3 的构建产物。开发时去 Chrome 的 `chrome://extensions` 页面打开开发者模式，然后加载 `apps/extension/.output/chrome-mv3` 或 WXT 提示的产物目录。

## 配置模型

1. 打开插件 popup，先把“本地 API Base URL”保持为 `http://localhost:8787`
2. 在同一个 popup 里填写：
   - `模型 API URL`：你的中转站 `/v1/chat/completions` 地址
   - `模型 API Key`
   - `模型名`
3. 先点“测试模型连接”，通过后再点“保存全部设置”

保存后，本地后端会把运行时模型配置写进 `.underline-runtime.json`。这个文件已经被 `.gitignore` 忽略，不会被提交。

## 一键测试

第一次：

1. 运行 `npm run demo:start`
2. 打开 `chrome://extensions`
3. 刷新 `Underline`
4. 刷新要测试的文章页面

之后每次测试：

1. 运行 `npm run demo:start`
2. 刷新 `Underline`
3. 刷新文章页
4. 打开插件 popup，点 `开启导师模式`
5. 划词后点击右下角解释按钮

停止本地 API：

- `npm run demo:stop`

说明：

- `demo:start` 会先重新构建扩展产物，再确保本地 API 正在 `http://localhost:8787` 运行
- `demo:start` 启动的是后台 API 进程，适合稳定测试；如果你在改后端代码，再单独用 `npm run dev:api`
- 扩展导入目录固定是 `apps/extension/.output/chrome-mv3`
- 本地 API 日志在 `.logs/underline-api.log`

## 设计说明

- 高亮、桥接解释、轻量用户画像都保存在本地 `chrome.storage.local`
- 后端只接受结构化上下文，不抓整页 HTML
- AI 输出只返回 JSON，真正插入页面的 DOM 由扩展端自己渲染

## 验证命令

- `npm run build`
- `npm run test`
- `npm run typecheck`
