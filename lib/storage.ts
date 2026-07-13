/**
 * 统一存储层
 *
 * - 本地开发（无 KV 环境变量）：使用 JSON 文件（data/*.json）
 * - Vercel 生产环境（有 KV_URL）：使用 Vercel KV / Upstash Redis
 *
 * Vercel 的 Serverless Functions 没有持久化文件系统，JSON 文件写入
 * 在函数实例销毁后会丢失。因此生产环境必须使用 KV 或其他远程存储。
 */

import {
  getAllNodes as fsGetAllNodes,
  getNode as fsGetNode,
  updateNode as fsUpdateNode,
  createNode as fsCreateNode,
  deleteNode as fsDeleteNode,
  getAllWeeklies as fsGetAllWeeklies,
  getWeekly as fsGetWeekly,
  getWeekliesForNode as fsGetWeekliesForNode,
  getWeekliesForWeek as fsGetWeekliesForWeek,
  updateWeekly as fsUpdateWeekly,
  createWeekly as fsCreateWeekly,
  deleteWeekly as fsDeleteWeekly,
  getAllWeeklyBlocks as fsGetAllWeeklyBlocks,
  getWeeklyBlocks as fsGetWeeklyBlocks,
  setWeeklyBlocks as fsSetWeeklyBlocks,
  getAllMembers as fsGetAllMembers,
  createMember as fsCreateMember,
  updateMember as fsUpdateMember,
  deleteMember as fsDeleteMember,
} from "./localStore";

import type {
  ProjectNode,
  WeeklyReport,
  Member,
} from "./types";

// ---- 判断是否使用 KV ----
function hasKV(): boolean {
  // KV_REST_API_URL 是 @vercel/kv / Upstash Redis 自动注入的
  // 本地开发没有这些变量，自动 fallback 到 JSON 文件
  return !!(process.env.KV_REST_API_URL || process.env.KV_URL);
}

// ---- KV 后端 ----
let kvClient: any = null;

async function getKv() {
  if (kvClient) return kvClient;
  const { kv } = await import("@vercel/kv");
  kvClient = kv;
  return kv;
}

// 类型安全的 KV 读取辅助
async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKv();
  return (await kv.get(key)) as T | null;
}

async function kvSet(key: string, value: any): Promise<void> {
  const kv = await getKv();
  // 序列化确保值存储后不可变
  await kv.set(key, JSON.parse(JSON.stringify(value)));
}

// KV 键名
const K_NODES = "nodes";
const K_WEEKLIES = "weeklies";
const K_BLOCKS = "weekly_blocks";
const K_MEMBERS = "members";

// ---- Nodes ----

export async function getAllNodes(): Promise<ProjectNode[]> {
  if (hasKV()) return (await kvGet<ProjectNode[]>(K_NODES)) ?? [];
  return fsGetAllNodes();
}

export async function getNode(id: string): Promise<ProjectNode | null> {
  if (hasKV()) {
    const nodes = await getAllNodes();
    return nodes.find((n) => n.id === id) ?? null;
  }
  return fsGetNode(id);
}

export async function createNode(data: Omit<ProjectNode, "id" | "url">): Promise<ProjectNode> {
  if (hasKV()) {
    const nodes = (await kvGet<ProjectNode[]>(K_NODES)) ?? [];
    const id = idGen();
    const node: ProjectNode = { ...data, id, url: "" };
    nodes.push(node);
    await kvSet(K_NODES, nodes);
    if (data.owner?.trim()) {
      await ensureMemberExists(data.owner.trim());
    }
    return node;
  }
  return fsCreateNode(data);
}

export async function updateNode(id: string, patch: Partial<ProjectNode>): Promise<ProjectNode> {
  if (hasKV()) {
    const nodes = (await kvGet<ProjectNode[]>(K_NODES)) ?? [];
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error(`Node ${id} not found`);
    const updated = { ...nodes[idx], ...patch, id };
    nodes[idx] = updated;
    await kvSet(K_NODES, nodes);
    if (patch.owner?.trim()) {
      await ensureMemberExists(patch.owner.trim());
    }
    return updated;
  }
  return fsUpdateNode(id, patch);
}

export async function deleteNode(id: string): Promise<void> {
  if (hasKV()) {
    const nodes = (await kvGet<ProjectNode[]>(K_NODES)) ?? [];
    const filtered = nodes.filter((n) => n.id !== id);
    await kvSet(K_NODES, filtered);
    return;
  }
  return fsDeleteNode(id);
}

// ---- Weeklies ----

export async function getAllWeeklies(): Promise<WeeklyReport[]> {
  if (hasKV()) return (await kvGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
  return fsGetAllWeeklies();
}

export async function getWeekly(id: string): Promise<WeeklyReport | null> {
  if (hasKV()) {
    const weeklies = await getAllWeeklies();
    return weeklies.find((w) => w.id === id) ?? null;
  }
  return fsGetWeekly(id);
}

export async function getWeekliesForNode(nodeId: string): Promise<WeeklyReport[]> {
  if (hasKV()) {
    const weeklies = await getAllWeeklies();
    return weeklies.filter((w) => w.relatedNodes.includes(nodeId));
  }
  return fsGetWeekliesForNode(nodeId);
}

export async function getWeekliesForWeek(monday: string): Promise<WeeklyReport[]> {
  if (hasKV()) {
    const weeklies = await getAllWeeklies();
    return weeklies.filter((w) => w.week === monday);
  }
  return fsGetWeekliesForWeek(monday);
}

export async function createWeekly(data: Omit<WeeklyReport, "id" | "url">): Promise<WeeklyReport> {
  if (hasKV()) {
    const weeklies = (await kvGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
    const id = idGen();
    const weekly: WeeklyReport = { ...data, id, url: "" };
    weeklies.push(weekly);
    await kvSet(K_WEEKLIES, weeklies);
    return weekly;
  }
  return fsCreateWeekly(data);
}

export async function updateWeekly(id: string, patch: Partial<WeeklyReport>): Promise<WeeklyReport> {
  if (hasKV()) {
    const weeklies = (await kvGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
    const idx = weeklies.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Weekly ${id} not found`);
    const updated = { ...weeklies[idx], ...patch, id };
    weeklies[idx] = updated;
    await kvSet(K_WEEKLIES, weeklies);
    return updated;
  }
  return fsUpdateWeekly(id, patch);
}

export async function deleteWeekly(id: string): Promise<void> {
  if (hasKV()) {
    const weeklies = (await kvGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
    const filtered = weeklies.filter((w) => w.id !== id);
    await kvSet(K_WEEKLIES, filtered);
    // 清理关联 blocks
    const blocks = (await kvGet<Record<string, any[]>>(K_BLOCKS)) ?? {};
    delete blocks[id];
    await kvSet(K_BLOCKS, blocks);
    return;
  }
  return fsDeleteWeekly(id);
}

// ---- Weekly Blocks ----

export async function getWeeklyBlocks(id: string): Promise<any[]> {
  if (hasKV()) {
    const blocks = (await kvGet<Record<string, any[]>>(K_BLOCKS)) ?? {};
    return blocks[id] ?? [];
  }
  return fsGetWeeklyBlocks(id);
}

export async function setWeeklyBlocks(id: string, blocks: any[]): Promise<void> {
  if (hasKV()) {
    const all = (await kvGet<Record<string, any[]>>(K_BLOCKS)) ?? {};
    all[id] = blocks;
    await kvSet(K_BLOCKS, all);
    return;
  }
  return fsSetWeeklyBlocks(id, blocks);
}

// ---- Members ----

export async function getAllMembers(): Promise<Member[]> {
  if (hasKV()) {
    let members = (await kvGet<Member[]>(K_MEMBERS)) ?? [];
    // 自动从 nodes 补充新负责人
    const nodes = await getAllNodes();
    const existingNames = new Set(members.map((m) => m.name));
    const newOwners = Array.from(
      new Set(nodes.map((n) => n.owner).filter(Boolean))
    ).filter((n) => !existingNames.has(n));
    if (newOwners.length > 0) {
      newOwners.forEach((name) => members.push({ id: idGen(), name, archived: false }));
      await kvSet(K_MEMBERS, members);
    }
    return members;
  }
  return fsGetAllMembers();
}

export async function createMember(name: string): Promise<Member> {
  if (hasKV()) {
    const members = await getAllMembers();
    if (members.some((m) => m.name === name)) throw new Error(`成员 "${name}" 已存在`);
    const member: Member = { id: idGen(), name, archived: false };
    members.push(member);
    await kvSet(K_MEMBERS, members);
    return member;
  }
  return fsCreateMember(name);
}

export async function updateMember(id: string, patch: Partial<Member>): Promise<Member> {
  if (hasKV()) {
    const members = await getAllMembers();
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`成员 ${id} 不存在`);
    members[idx] = { ...members[idx], ...patch, id };
    await kvSet(K_MEMBERS, members);
    return members[idx];
  }
  return fsUpdateMember(id, patch);
}

export async function deleteMember(id: string): Promise<void> {
  if (hasKV()) {
    const members = await getAllMembers();
    const filtered = members.filter((m) => m.id !== id);
    await kvSet(K_MEMBERS, filtered);
    return;
  }
  return fsDeleteMember(id);
}

// ---- 内部工具 ----

function idGen(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 仅在 KV 模式下使用：自动将新负责人加入成员列表。
 * JSON 文件模式下，localStore 已内置此逻辑。
 */
async function ensureMemberExists(name: string): Promise<void> {
  const members = (await kvGet<Member[]>(K_MEMBERS)) ?? [];
  if (members.some((m) => m.name === name)) return;
  members.push({ id: idGen(), name, archived: false });
  await kvSet(K_MEMBERS, members);
}
