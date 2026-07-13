import { Client } from "@notionhq/client";

// ─── 懒加载 Notion 客户端 ──────────────────────────────────────────
//
// 仅在首次实际调用 Notion API 时初始化客户端并校验环境变量，
// 避免模块导入阶段因环境变量缺失导致服务器崩溃。
// 这意味着：即使未配置 Notion，纯本地 JSON 读写功能依然可用。

let _client: Client | null = null;
let _dbProjects: string | null = null;
let _dbWeekly: string | null = null;

function getClient(): Client {
  if (_client) return _client;
  const token = process.env.NOTION_TOKEN;
  _dbProjects = process.env.NOTION_DB_PROJECTS ?? null;
  _dbWeekly = process.env.NOTION_DB_WEEKLY ?? null;
  if (!token) throw new Error("Missing NOTION_TOKEN");
  if (!_dbProjects) throw new Error("Missing NOTION_DB_PROJECTS");
  if (!_dbWeekly) throw new Error("Missing NOTION_DB_WEEKLY");
  _client = new Client({
    auth: token,
    fetch: (url, init) => fetchWithRetry(url, init as RequestInit),
  });
  return _client;
}

function getDbProjects(): string {
  if (!_dbProjects) getClient(); // 首次调用会初始化全部三个变量
  return _dbProjects!;
}

function getDbWeekly(): string {
  if (!_dbWeekly) getClient();
  return _dbWeekly!;
}

// ─── 带超时和重试的 fetch ──────────────────────────────────────────

async function fetchWithRetry(url: string, init: RequestInit, attempt = 1): Promise<Response> {
  const TIMEOUT_MS = 8000; // 8 秒超时，避免请求永久挂起
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const code = err.code ?? err.cause?.code;
    const isAbort = err.name === "AbortError";
    if (attempt < 3 && (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ECONNREFUSED" || isAbort)) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return fetchWithRetry(url, init, attempt + 1);
    }
    throw err;
  }
}

// ─── 类型定义 ──────────────────────────────────────────────────────

export type ProjectNode = {
  id: string;
  name: string;
  status: string;
  owner: string;
  start?: string;
  end?: string;
  priority: string;
  dependsOn: string[];
  parents: string[];
  deliverable: string;
  url: string;
};

export type WeeklyReport = {
  id: string;
  title: string;
  author: string;
  week: string;
  relatedNodes: string[];
  summary: string;
  url: string;
};

// ─── 从 Notion Page 解析属性的工具函数 ────────────────────────────

function getTitle(prop: any): string {
  return prop?.title?.map((t: any) => t.plain_text).join("") ?? "";
}

function getRichText(prop: any): string {
  return prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
}

function getSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

function getDateRange(prop: any): { start?: string; end?: string } {
  const date = prop?.date;
  return date ? { start: date.start ?? undefined, end: date.end ?? undefined } : {};
}

function getRelation(prop: any): string[] {
  return prop?.relation?.map((r: any) => r.id) ?? [];
}

export function projectNodeFromPage(page: any): ProjectNode {
  const p = page.properties;
  const range = getDateRange(p["起止时间"]);
  return {
    id: page.id,
    name: getTitle(p["节点名称"]),
    status: getSelect(p["节点状态"]),
    owner: getRichText(p["负责人"]),
    start: range.start,
    end: range.end,
    priority: getSelect(p["优先级"]),
    dependsOn: getRelation(p["依赖于"]),
    parents: getRelation(p["父节点"]),
    deliverable: getRichText(p["交付物描述"]),
    url: page.url,
  };
}

export function weeklyReportFromPage(page: any): WeeklyReport {
  const p = page.properties;
  return {
    id: page.id,
    title: getTitle(p["标题"]),
    author: getRichText(p["作者"]),
    week: p["周次"]?.date?.start ?? "",
    relatedNodes: getRelation(p["关联节点"]),
    summary: getRichText(p["一句话总结"]),
    url: page.url,
  };
}

// ─── 查询函数 ──────────────────────────────────────────────────────

export async function queryAllProjectNodes(): Promise<ProjectNode[]> {
  const client = getClient();
  const results: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await client.databases.query({
      database_id: getDbProjects(),
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results.map(projectNodeFromPage);
}

export async function queryProjectNode(id: string): Promise<ProjectNode> {
  const page = await getClient().pages.retrieve({ page_id: id });
  return projectNodeFromPage(page);
}

export async function queryWeeklyReportsForNode(nodeId: string): Promise<WeeklyReport[]> {
  const res: any = await getClient().databases.query({
    database_id: getDbWeekly(),
    filter: {
      property: "关联节点",
      relation: { contains: nodeId },
    },
    sorts: [{ property: "周次", direction: "descending" }],
  });
  return res.results.map(weeklyReportFromPage);
}

export async function queryWeeklyReportsForWeek(monday: string): Promise<WeeklyReport[]> {
  const res: any = await getClient().databases.query({
    database_id: getDbWeekly(),
    filter: {
      property: "周次",
      date: { equals: monday },
    },
    sorts: [{ property: "周次", direction: "descending" }],
  });
  return res.results.map(weeklyReportFromPage);
}

// ─── 更新函数 ──────────────────────────────────────────────────────

export async function updateProjectNode(
  id: string,
  data: Partial<Omit<ProjectNode, "id" | "url">>
): Promise<void> {
  const props: any = {};
  if (data.name !== undefined) props["节点名称"] = { title: [{ text: { content: data.name } }] };
  if (data.status !== undefined) props["节点状态"] = { select: { name: data.status } };
  if (data.owner !== undefined) props["负责人"] = { rich_text: [{ text: { content: data.owner } }] };
  if (data.start !== undefined || data.end !== undefined) {
    props["起止时间"] = { date: { start: data.start ?? null, end: data.end ?? null } };
  }
  if (data.priority !== undefined) props["优先级"] = { select: { name: data.priority } };
  if (data.dependsOn !== undefined) props["依赖于"] = { relation: data.dependsOn.map((id) => ({ id })) };
  if (data.parents !== undefined) props["父节点"] = { relation: data.parents.map((id) => ({ id })) };
  if (data.deliverable !== undefined)
    props["交付物描述"] = { rich_text: [{ text: { content: data.deliverable } }] };

  await getClient().pages.update({ page_id: id, properties: props });
}

// ─── 周报 CRUD ──────────────────────────────────────────────────────

export async function createWeeklyReport(data: {
  title: string;
  author: string;
  week: string;
  relatedNodes: string[];
  summary: string;
  blocks: any[];
}): Promise<string> {
  const page = await getClient().pages.create({
    parent: { database_id: getDbWeekly() },
    properties: {
      标题: { title: [{ text: { content: data.title } }] },
      作者: { rich_text: [{ text: { content: data.author } }] },
      周次: { date: { start: data.week } },
      关联节点: { relation: data.relatedNodes.map((id) => ({ id })) },
      一句话总结: { rich_text: [{ text: { content: data.summary } }] },
    },
    children: data.blocks,
  });
  return page.id;
}

export async function updateWeeklyReport(
  id: string,
  data: {
    title?: string;
    author?: string;
    week?: string;
    relatedNodes?: string[];
    summary?: string;
    blocks?: any[];
  }
): Promise<void> {
  const client = getClient();
  const props: any = {};
  if (data.title !== undefined) props["标题"] = { title: [{ text: { content: data.title } }] };
  if (data.author !== undefined) props["作者"] = { rich_text: [{ text: { content: data.author } }] };
  if (data.week !== undefined) props["周次"] = { date: { start: data.week } };
  if (data.relatedNodes !== undefined) props["关联节点"] = { relation: data.relatedNodes.map((id) => ({ id })) };
  if (data.summary !== undefined) props["一句话总结"] = { rich_text: [{ text: { content: data.summary } }] };

  await client.pages.update({ page_id: id, properties: props });

  if (data.blocks && data.blocks.length > 0) {
    await client.blocks.children.append({ block_id: id, children: data.blocks });
  }
}

export async function queryWeeklyReport(id: string): Promise<WeeklyReport> {
  const page = await getClient().pages.retrieve({ page_id: id });
  return weeklyReportFromPage(page);
}

export async function getWeeklyReportBlocks(pageId: string): Promise<any[]> {
  const res: any = await getClient().blocks.children.list({ block_id: pageId, page_size: 100 });
  return res.results;
}

export async function replaceWeeklyReportBlocks(pageId: string, blocks: any[]): Promise<void> {
  const client = getClient();
  const existing: any = await client.blocks.children.list({ block_id: pageId, page_size: 100 });
  for (const block of existing.results) {
    try {
      await client.blocks.delete({ block_id: block.id });
    } catch (err) {
      console.warn("Failed to delete block", block.id, err);
    }
  }
  if (blocks.length > 0) {
    await client.blocks.children.append({ block_id: pageId, children: blocks });
  }
}

// ─── 新建节点 ──────────────────────────────────────────────────────

export async function createProjectNode(data: {
  name: string;
  status: string;
  owner: string;
  start?: string;
  end?: string;
  priority: string;
  parents?: string[];
  deliverable?: string;
}): Promise<string> {
  const props: any = {
    "节点名称": { title: [{ text: { content: data.name } }] },
    "节点状态": { select: { name: data.status } },
    "负责人": { rich_text: [{ text: { content: data.owner } }] },
    "优先级": { select: { name: data.priority } },
  };
  if (data.start || data.end) {
    props["起止时间"] = { date: { start: data.start ?? null, end: data.end ?? null } };
  }
  if (data.parents?.length) {
    props["父节点"] = { relation: data.parents.map((id) => ({ id })) };
  }
  if (data.deliverable !== undefined) {
    props["交付物描述"] = { rich_text: [{ text: { content: data.deliverable } }] };
  }
  const page = await getClient().pages.create({
    parent: { database_id: getDbProjects() },
    properties: props,
  });
  return page.id;
}

// ─── 删除/归档 ──────────────────────────────────────────────────────

/**
 * 归档项目节点（Notion 不支持物理删除，archive 等同于软删除）
 */
export async function archiveProjectNode(id: string): Promise<void> {
  await getClient().pages.update({ page_id: id, archived: true });
}

/**
 * 归档周报
 */
export async function archiveWeeklyReport(id: string): Promise<void> {
  await getClient().pages.update({ page_id: id, archived: true });
}
