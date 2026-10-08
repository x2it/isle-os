# 屿 IsleOS

**一座装在浏览器里的小岛 —— 一个零后端、可离线、能对话的实验性 Web 桌面系统。**

纯前端实现，无需服务器、无需注册、无需安装。打开网页即是一座完整的小岛：窗口、文件系统、终端、应用一应俱全，数据只属于你自己的设备。

> 🌐 在线体验：https://os.app.workbuddy.host

---

## 这是什么

屿 IsleOS 是一个跑在浏览器里的轻量桌面环境。它同时是一个**实验性 AI 交互系统**：

- 把它当成轻量桌面用 —— 窗口、Dock、文件管理、终端、计算器、时钟、画板、合成器；
- 把它当成一台「**能动手的 AI**」用 —— 用自然语言让它打开应用、读写文件、切换壁纸、锁定屏幕。

它不模仿任何特定系统，而试图回答一个问题：**如果一个 AI Agent 需要一个属于自己的操作界面，它会长什么样？**

---

## 特性

| 模块 | 说明 |
|---|---|
| **智能体** | 本地指令模式开箱即用（开应用 / 换壁纸 / 读写文件 / 发通知）；填入任意 OpenAI 兼容接口即可升级为能自由对话并调用系统工具的云端智能体 |
| **文件系统** | 基于 OPFS（Origin Private File System），真实持久化。刷新、关机重开，文件都还在 |
| **终端** | 真实 Shell：`ls cd pwd mkdir touch cat echo rm cp mv tree du df neofetch wall theme open` |
| **浏览器** | 内嵌真实网页访问，可搜索、可导航 |
| **生命周期** | 开机动画、锁屏（大时钟 + 时段问候）、关机 / 重启、首启向导、恢复出厂 |
| **数据迁移** | 一键导出 JSON 备份（含全部文件与设置），换个浏览器 / 设备原样还原 |
| **PWA** | 可安装到主屏幕，全屏运行，支持离线访问 |
| **移动端** | 响应式布局，软键盘自适应，触摸目标优化 |
| **主题** | 浅色 / 深色 / 跟随系统，5 套渐变壁纸，可自定义图片壁纸 |

---

## 快速开始

### 直接使用

访问 https://os.app.workbuddy.host ，或把仓库克隆下来用任意静态服务器打开：

```bash
git clone <repo-url> isle
cd isle
python3 -m http.server 8080
# 打开 http://localhost:8080
```

> 需要 `http://localhost` 或 `https://` 环境 —— OPFS 与 Service Worker 在 `file://` 下不可用。

### 部署

项目是纯静态资源，可部署到任意静态托管：GitHub Pages、Vercel、Netlify、Cloudflare Pages 等。

---

## 项目结构

```
.
├── index.html              # 入口：开机画面 / 顶栏 / 桌面 / 锁屏 / 向导 / 关机层
├── manifest.webmanifest    # PWA 清单
├── sw.js                   # Service Worker（预缓存 + 离线）
├── css/
│   └── style.css           # 全部样式（含主题变量与响应式）
├── icons/                  # PWA 图标（含 maskable）
└── js/
    ├── vfs.js              # 文件系统层：OPFS 持久化 + 内存降级
    ├── core.js             # 系统核心：设置 / 主题 / 壁纸 / 通知 / 菜单 / 对话框 / 音效
    ├── wm.js               # 窗口管理器：拖动 / 缩放 / Dock / 桌面图标
    ├── shell.js            # 生命周期：锁屏 / 开关机 / 首启向导 / 恢复出厂
    ├── apps-a.js           # 关于本机 / 文件 / 终端 / 计算器 / 便签
    ├── apps-b.js           # 时钟 / 画板 / 合成器 / 图库 / 设置 / 帮助 + 备份模块
    ├── apps-c.js           # 智能体 / 浏览器
    └── main.js             # 启动引导
```

模块间通过全局命名空间 `N` 协作，加载顺序为 `vfs → core → wm → shell → apps-a → apps-b → apps-c → main`。

---

## 数据与隐私

**所有数据都留在你的浏览器里，本系统没有服务器。**

- 文件写入 OPFS，设置写入 `localStorage`；
- 智能体的对话历史与 API 密钥只保存在本机，不会上传到本项目之外的任何地方；
- 换浏览器 / 换设备时数据不会自动跟随（浏览器安全隔离所限），请用「设置 → 备份与迁移」导出 JSON 再还原。

---

## 开发

零依赖、零构建。改完源码刷新页面即可。

新增一个应用：

```js
N.apps.register({
  id: 'hello',
  name: '你好',
  icon: 'help',                       // 取自 N.icons
  bg: 'linear-gradient(135deg,#64d2ff,#0a84ff)',
  w: 520, h: 400, minW: 360, minH: 300,
  render(body, win, params) {
    body.textContent = '你好，小岛。';
  }
});
```

在 `js/wm.js` 的 `DOCK_ORDER` 中登记后，应用即出现在 Dock 中。

发布新版本时，请同步更新 `index.html` 中的 `?v=` 查询参数与 `sw.js` 的 `CACHE` 版本号，以刷新客户端缓存。

---

## 浏览器支持

| 功能 | 要求 |
|---|---|
| 基础系统 | 任意现代浏览器（Chrome / Edge / Firefox / Safari） |
| 持久化文件系统 | 支持 OPFS 的浏览器；不支持时自动降级为内存模式并明确提示 |
| 电池状态显示 | 支持 Battery Status API 的浏览器；不支持时隐藏该组件 |
| PWA 安装 | 需要 HTTPS（或 localhost） |

---

## 贡献

欢迎 Issue 与 Pull Request。提交前请确保：

1. 不引入构建步骤与运行时依赖；
2. 新增/修改的界面文案与既有风格一致；
3. 改动已在实际浏览器中验证通过。

---

## 许可证

[MIT](LICENSE) © 2026 屿 IsleOS contributors
