# 团队驾驶舱 (Team Cockpit) — 部署与维护指南

> 最后更新：2026-07-13  
> 项目仓库：https://github.com/mmy-001/team-cockpit  
> 生产地址：https://team-cockpit-eight.vercel.app  
> Vercel 仪表盘：https://vercel.com/mmy-001s-projects/team-cockpit

---

## 一、项目概述

### 这是什么？

一个为团队定制的 **项目管理 + 周报系统** 一体化面板。支持：

- **项目节点管理**：创建、编辑、删除项目节点（任务/子任务），设置状态/优先级/负责人/起止时间/依赖关系
- **多视图展示**：项目总览仪表盘、节点列表、任务看板（拖拽变更状态）、甘特图、周报汇总
- **个人看板**：按成员查看四象限优先级矩阵、负载统计、决策建议
- **周报系统**：块编辑器 / 自由编辑器 / AI 结构化（调用 MiniMax API）
- **Notion 双向同步**：所有数据异步同步到 Notion 数据库（项目库 + 周报库）
- **数据持久化**：本地开发用 JSON 文件，Vercel 生产环境用 Upstash Redis

### 不依赖本工具也能工作

即使不打开这个面板，团队在 **Notion** 里直接编辑项目节点、写周报，数据不会丢失。面板只是把 Notion 的数据做了更友好的可视化 + 增加了看板/甘特图/AI 这些 Notion 没有的功能。

---

## 二、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 14.2.35 |
| 语言 | TypeScript | 5.5.4 |
| 样式 | Tailwind CSS | 3.4.7 |
| 图标 | Lucide React | 0.446 |
| 数据缓存 | SWR | 2.2.5 |
| 存储（本地） | JSON 文件 | — |
| 存储（生产） | Upstash Redis | — |
| Notion SDK | @notionhq/client | 2.2.15 |
| AI | MiniMax API (abab6.5s-chat) | — |
| 部署 | Vercel | — |

---

## 三、项目文件结构（改 bug 必读）

```
36氪项目管理面板/
├── .env.example          ← 环境变量模板（需要的所有变量说明）
├── .env.local            ← 本地环境变量（不上传到 Git）
├── package.json          ← 依赖和脚本
├── next.config.js        ← Next.js 配置
├── tailwind.config.ts    ← 颜色/字体主题
│
├── app/                  ← Next.js App Router（页面 + API）
│   ├── layout.tsx        → 根布局
│   ├── page.tsx          → 首页（5个Tab切换逻辑）
│   ├── providers.tsx     → SWR 全局配置
│   ├── globals.css       → 全局样式
│   │
│   ├── nodes/[id]/page.tsx      → 节点详情页（内联编辑）
│   ├── persons/[name]/page.tsx  → 个人看板
│   ├── weeklies/new/page.tsx    → 新建周报
│   ├── weeklies/[id]/page.tsx   → 编辑周报
│   │
│   └── api/              ← 后端 API（11个端点）
│       ├── nodes/route.ts          → GET 列表 / POST 新建
│       ├── nodes/[id]/route.ts     → GET/PATCH/DELETE 节点
│       ├── nodes/[id]/weeklies/route.ts → GET 节点的周报
│       ├── weeklies/route.ts       → GET 列表 / POST 新建
│       ├── weeklies/[id]/route.ts  → GET/PATCH/DELETE 周报
│       ├── weeklies/this-week/route.ts → GET 本周数据
│       ├── members/route.ts        → 成员 CRUD (GET/POST/PATCH/DELETE)
│       ├── ai/route.ts             → MiniMax AI 结构化
│       ├── upload/route.ts         → 文件上传
│       ├── upload-url/route.ts     → Cloudinary 配置
│       └── health/notion/route.ts  → Notion 连通性检查
│
├── components/           ← 前端组件
│   ├── BackButton.tsx           → 通用返回按钮
│   ├── editor/
│   │   ├── BlockEditor.tsx      → 块编辑器（Notion风格）
│   │   └── FreeEditor.tsx       → 自由编辑器（默认周报编辑器）
│   └── views/
│       ├── Dashboard.tsx        → 项目总览仪表盘
│       ├── DecisionView.tsx     → 决策风险矩阵
│       ├── GanttChart.tsx       → 甘特图（SVG）
│       ├── KanbanBoard.tsx      → 看板（拖拽）
│       ├── NodeList.tsx         → 节点列表
│       └── WeeklySummary.tsx    → 周报汇总
│
├── lib/                  ← 核心业务逻辑
│   ├── types.ts          → 类型定义（ProjectNode/WeeklyReport/Member）
│   ├── storage.ts        → 统一存储层（Redis/JSON自动切换）
│   ├── localStore.ts     → 本地 JSON 文件读写
│   ├── hooks.ts          → SWR hooks（前端数据请求）
│   ├── notion.ts         → Notion API 集成（CRUD + 同步）
│   ├── blocks.ts         → 块类型转换（Notion blocks ↔ 编辑器）
│   ├── date.ts           → 日期工具（北京时间）
│   └── analytics.ts      → 分析/统计/风险计算
│
├── data/                 ← 本地 JSON 存储（仅本地开发使用）
│   ├── nodes.json        → 14个项目节点
│   ├── weeklies.json     → 5条周报记录
│   ├── weekly_blocks.json → 周报正文块
│   └── members.json      → 6位成员
│
└── public/
    └── uploads/          ← 上传文件存放
```

---

## 四、外部服务 / 配置清单

### 4.1 必须配置的服务

| 服务 | 用途 | 获取方式 |
|------|------|----------|
| **Vercel** | 部署平台 | https://vercel.com → GitHub 登录 |
| **Notion Integration** | 数据库同步 | https://www.notion.so/my-integrations → 创建 Integration → 获取 Token → 连接到两个数据库 |
| **Upstash Redis** | 生产环境存储 | Vercel Dashboard → Storage → 安装 Upstash Redis（免费 256MB） |

### 4.2 可选配置的服务

| 服务 | 用途 |
|------|------|
| MiniMax API | 周报 AI 结构化（不配置则 AI 功能不可用，其他功能正常） |

### 4.3 环境变量清单

```bash
# ---- 必填 ----
NOTION_TOKEN=ntn_xxxxxxxx          # Notion Integration Token
NOTION_DB_PROJECTS=39699f68-...    # Notion 项目数据库 ID
NOTION_DB_WEEKLY=39699f68-...      # Notion 周报数据库 ID

# ---- 可选 ----
MINIMAX_API_KEY=sk-cp-xxxxxxxx     # MiniMax API Key（AI 周报功能）

# ---- 自动注入（不需要手动配置） ----
# Vercel 安装 Upstash Redis 后自动注入：
# KV_REST_API_URL
# KV_REST_API_TOKEN
# KV_REST_API_READ_ONLY_TOKEN
# KV_URL
```

### 4.4 当前 Vercel 项目配置状态

| 配置项 | 状态 | 说明 |
|--------|------|------|
| GitHub 连接 | ✅ | 代码 push → 自动部署 |
| Notion Token | ✅ | 已注入 NOTION_TOKEN / NOTION_DB_PROJECTS / NOTION_DB_WEEKLY |
| Upstash Redis | ✅ | 已注入 KV_REST_API_URL / KV_REST_API_TOKEN |
| 部署状态 | ✅ | 最新构建成功，生产 Ready |

---

## 五、改动代码 → 修复 bug 的完整流程

### 5.1 日常修改流程（最快）

```bash
# 1. 确保在项目目录
cd "c:/Users/cgsf3/CodeBuddy/36氪项目管理面板"

# 2. 修改代码（用任何编辑器直接改文件）

# 3. 本地测试（可选但推荐）
npx next dev --port 3003
# 浏览器打开 http://localhost:3003

# 4. 提交并推送
git add -A
git commit -m "fix: 简短描述改了什么"
git push origin main

# 5. 等30秒，Vercel 自动重新部署
# 查看进度：https://vercel.com/mmy-001s-projects/team-cockpit/deployments
```

### 5.2 常见问题 → 对应修改的文件

#### 🐛 节点数据不对 / 创建失败
```
改：app/api/nodes/route.ts（API逻辑）
    lib/storage.ts（存储逻辑）
    lib/localStore.ts（本地JSON读写）
```

#### 🐛 周报编辑器 bug
```
改：components/editor/FreeEditor.tsx（自由编辑器，默认使用）
    components/editor/BlockEditor.tsx（块编辑器，备用）
    lib/blocks.ts（文字 ↔ 块格式转换）
```

#### 🐛 看板拖拽不响应
```
改：components/views/KanbanBoard.tsx
    看板拖拽逻辑在文件内 HTML5 drag & drop 实现
```

#### 🐛 甘特图时间/日期偏差
```
改：components/views/GanttChart.tsx（渲染逻辑）
    lib/date.ts（日期函数，重要：基于北京时间 Asia/Shanghai）
```

#### 🐛 Dashboard 统计数据不对
```
改：components/views/Dashboard.tsx（展示逻辑）
    lib/analytics.ts（计算逻辑：完成率/风险分析/负载统计）
```

#### 🐛 成员列表不更新
```
改：app/api/members/route.ts（成员 API）
    lib/storage.ts → getAllMembers()（成员+节点自动修正）
```

#### 🐛 AI 周报结构化失败
```
改：app/api/ai/route.ts（MiniMax API 调用 + 3层解析策略）
    检查 MINIMAX_API_KEY 是否在 Vercel 环境变量中
```

#### 🐛 Notion 同步异常
```
改：lib/notion.ts（Notion API 客户端）
    检查：https://team-cockpit-eight.vercel.app/api/health/notion
    常见原因：Token 过期、数据库 ID 变化、Notion Integration 连接断开
```

#### 🐛 上传图片/视频失败
```
改：app/api/upload/route.ts
    app/api/upload-url/route.ts
    components/editor/FreeEditor.tsx（编辑器内上传逻辑）
```

#### 🐛 页面样式/颜色问题
```
改：tailwind.config.ts（主题色，"notion" 色系）
    app/globals.css（全局 CSS）
```

### 5.3 需要重点关注的配置

| 配置 | 说明 | 为什么重要 |
|------|------|-----------|
| `NOTION_DB_PROJECTS` | 项目数据库 ID | 变了就同步不了，Notion 数据和面板断开 |
| `NOTION_DB_WEEKLY` | 周报数据库 ID | 同上 |
| Notion 数据库列名 | 中文列名必须严格匹配 | `节点名称`/`节点状态`/`负责人`/`起止时间`/`优先级`/`依赖于`/`父节点`/`交付物描述` |
| `lib/date.ts` 时区 | `Asia/Shanghai` | 所有时间计算基于北京时间 |
| `lib/storage.ts` → `hasRedis()` | 判断用 Redis 还是 JSON | 如果 Vercel 环境变量名变了需要对应修改 |
| `next.config.js` → `reactStrictMode` | 开发模式双重渲染 | 默认 `true`，API 可能被调用两次（正常现象） |

---

## 六、存储架构说明

```
┌─────────────────────────────────────────────┐
│              app/api/** (API Routes)          │
│          调用 lib/storage.ts 统一接口          │
├─────────────────────────────────────────────┤
│              lib/storage.ts                   │
│         自动选择后端（环境变量判断）            │
├──────────────────┬──────────────────────────┘
│ 生产环境          │ 本地开发
│ hasRedis()=true  │ hasRedis()=false
├──────────────────┼──────────────────────────┐
│ @upstash/redis   │ lib/localStore.ts        │
│ → Upstash Redis   │ → data/*.json            │
│ (4个key)         │ (4个文件)                 │
├──────────────────┼──────────────────────────┤
│ 异步同步          │                           │
│ lib/notion.ts    │                           │
│ → Notion API      │                           │
│ (不阻塞主流程)     │                           │
└──────────────────┴──────────────────────────┘
```

**关键特性：**
- 写操作先写主存储（Redis/JSON），然后异步写 Notion。Notion 失败不影响数据已保存
- 本地 `data/*.json` 被 `.gitignore` 排除，不会上传到 GitHub
- Vercel Serverless 函数实例重启后 JSON 文件丢失，因此必须用 Redis

### 4个存储键

| Redis Key | JSON 文件 | 内容 |
|-----------|-----------|------|
| `nodes` | `data/nodes.json` | 所有项目节点 |
| `weeklies` | `data/weeklies.json` | 周报元信息 |
| `weekly_blocks` | `data/weekly_blocks.json` | 周报正文 blocks |
| `members` | `data/members.json` | 团队成员 |

---

## 七、11 个 API 端点速查

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/nodes` | GET | 获取全部节点 |
| `/api/nodes` | POST | 新建节点 |
| `/api/nodes/[id]` | GET/PATCH/DELETE | 节点详情/更新/删除 |
| `/api/nodes/[id]/weeklies` | GET | 节点的周报列表 |
| `/api/weeklies` | GET/POST | 周报列表/创建 |
| `/api/weeklies/[id]` | GET/PATCH/DELETE | 周报详情/更新/删除 |
| `/api/weeklies/this-week` | GET | 本周数据和周报 |
| `/api/members` | GET/POST/PATCH/DELETE | 成员管理 |
| `/api/ai` | POST | AI 结构化周报 |
| `/api/upload` | POST | 文件上传 |
| `/api/health/notion` | GET | Notion 连通性检查 |

---

## 八、迁移清单（从零搭建）

### 步骤 1：克隆代码

```bash
git clone git@github.com:mmy-001/team-cockpit.git
cd team-cockpit
npm install
```

### 步骤 2：配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local，填入 NOTION_TOKEN、NOTION_DB_PROJECTS、NOTION_DB_WEEKLY
```

### 步骤 3：本地测试

```bash
npx next dev --port 3003
# 打开 http://localhost:3003
```

### 步骤 4：连接 Notion

1. 打开 https://www.notion.so/my-integrations
2. 创建 Integration → 获取 Token → 填入 `.env.local`
3. 在 Notion 中创建两个数据库（或用已有数据库），获取 Database ID
4. 将 Integration 添加到两个数据库的 Connections 中
5. 验证：`http://localhost:3003/api/health/notion` → 返回 `{"status":"connected"}`

### 步骤 5：部署到 Vercel

```bash
npx vercel login --github
npx vercel link --project team-cockpit --yes
npx vercel --prod --yes
```

### 步骤 6：Vercel 环境变量

在 Vercel Dashboard → Project → Settings → Environment Variables：
```bash
NOTION_TOKEN=ntn_...
NOTION_DB_PROJECTS=39699f68-...
NOTION_DB_WEEKLY=39699f68-...
```

### 步骤 7：安装 Upstash Redis

Vercel Dashboard → Storage → Create → Upstash Redis → 免费版 → 自动注入环境变量

### 步骤 8：连接 GitHub 自动部署

Vercel Dashboard → Settings → Git → 点击 GitHub 按钮 → 选择仓库

---

## 九、常见故障排查

| 现象 | 检查项 |
|------|--------|
| 页面加载不出来 | 检查 Vercel 部署状态 `npx vercel list` |
| Notion 健康检查失败 | 检查 NOTION_TOKEN 是否过期；Integration 是否还连接着数据库 |
| 数据创建后丢失 | Vercel 环境检查 Upstash Redis 是否正常；`npx vercel env ls production` |
| AI 功能不可用 | 检查 MINIMAX_API_KEY 是否配置；MiniMax 账户余额 |
| push 后没自动部署 | 检查 Vercel Git 连接状态；生产 deploy 是否标记为 production |
| 本地改了 data/*.json 但部署后还是旧数据 | Vercel 读的是 Redis，不是本地 JSON。改了本地 JSON 要 push 代码并重新部署才能生效（因为 data/ 不在 .gitignore 里但 Redis 和环境变量优先） |
