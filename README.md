# 产品运营团队管理面板

基于 Notion 后端的团队项目管理 Web 应用。数据全部存储在 Notion，本应用是可视化与编辑前端。

## 环境变量

复制 `.env.local`（已存在于本地，未提交到 git），在 Vercel 后台填入以下变量：

```
NOTION_TOKEN=你的 Integration Token
NOTION_DB_PROJECTS=39699f68-46fd-812a-87b6-de3cfab638ad
NOTION_DB_WEEKLY=39699f68-46fd-81ab-92f3-e46453692025
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=ucgnqxkq
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=team_cockpit_upload
```

## 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000。

## 日常使用

1. **三视图切换**：顶部 Tab 切换「节点列表」「任务看板」「甘特图」「本周汇总」。
2. **编辑节点**：点击节点名称进入详情页，可修改属性、依赖、父节点。
3. **看板拖拽**：在看板视图拖拽卡片改状态，失败会自动回滚并提示。
4. **写周报**：在节点详情页点击「写本周周报」，填写作者、关联节点、一句话总结和正文。
5. **图片上传**：在周报编辑器中点击工具栏图片按钮，选择本地图片直传 Cloudinary。
6. **甘特图依赖**：有起止时间的节点会渲染时间条，依赖关系用箭头连接；若存在循环依赖会提示并跳过成环箭头。

## Cloudinary 配置

1. 注册 Cloudinary 免费账号。
2. Settings → Upload → Upload presets → Add upload preset。
3. Signing Mode 选 **Unsigned**，preset 名称填 `team_cockpit_upload`。
4. 把 Dashboard 上的 **Cloud name** 填入 `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`。

## 数据库 ID

- 项目节点：`39699f68-46fd-812a-87b6-de3cfab638ad`
- 周报：`39699f68-46fd-81ab-92f3-e46453692025`

## 部署到 Vercel

1. 把代码推送到 GitHub/GitLab（确保 `.env.local` 和 `scripts/` 已加入 `.gitignore`）。
2. 在 Vercel 导入仓库，Framework Preset 选 Next.js。
3. 在 Project Settings → Environment Variables 中填入上面的 5 个变量。
4. 重新 Deploy。

## 注意事项

- 前端浏览器不直接调用 Notion API，所有请求通过 `/api/*` 中转。
- 不要在代码中硬编码 `ntn_` 或 `secret_` 开头的 token。
- 已测试数据：种子脚本创建了示例节点和循环依赖，可在 Notion 中删除或修改。
