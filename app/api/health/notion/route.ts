import { NextResponse } from "next/server";

/**
 * GET /api/health/notion
 * 检测 Notion 集成是否已配置并可用
 */
export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const dbProjects = process.env.NOTION_DB_PROJECTS;
  const dbWeekly = process.env.NOTION_DB_WEEKLY;

  const configured = !!(token && dbProjects && dbWeekly);

  if (!configured) {
    return NextResponse.json({
      status: "not_configured",
      message: "Notion 环境变量缺失，当前仅使用本地 JSON 存储",
      missing: {
        NOTION_TOKEN: !token,
        NOTION_DB_PROJECTS: !dbProjects,
        NOTION_DB_WEEKLY: !dbWeekly,
      },
    });
  }

  // 尝试真正调用 Notion API 验证连通性
  try {
    const { Client } = await import("@notionhq/client");
    const notion = new Client({ auth: token });

    // 尝试查询项目数据库（只取 1 条）
    const res: any = await notion.databases.query({
      database_id: dbProjects!,
      page_size: 1,
    });

    return NextResponse.json({
      status: "connected",
      message: "Notion 已连接",
      projectCount: res.results?.length ?? 0,
      weeklyDb: dbWeekly ? "已配置" : "未配置",
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "error",
      message: "Notion 环境变量已配置但连接失败",
      error: err.message || String(err),
      hint: "请检查 NOTION_TOKEN 是否有效，以及 Integration 是否已连接到对应数据库",
    });
  }
}
