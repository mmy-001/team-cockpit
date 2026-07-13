/**
 * 统一存储层
 *
 * - 本地开发（无 Upstash 环境变量）：使用 JSON 文件（data/*.json）
 * - Vercel 生产环境（有 UPSTASH_REDIS_REST_URL）：使用 Upstash Redis
 *
 * Vercel 的 Serverless Functions 没有持久化文件系统，JSON 文件写入
 * 在函数实例销毁后会丢失。因此生产环境必须使用 Redis 或其他远程存储。
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

// ---- 判断是否使用 Redis ----
function hasRedis(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL);
}

// ---- Redis 后端 ----
let redisClient: any = null;

async function getRedis() {
  if (redisClient) return redisClient;
  // 优先使用 @upstash/redis，兼容旧的 @vercel/kv 环境变量
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN;
  if (!url || !token) throw new Error("Missing Redis credentials");
  const { Redis } = await import("@upstash/redis");
  redisClient = new Redis({ url, token });
  return redisClient;
}

// 类型安全的读/写辅助
async function redisGet<T>(key: string): Promise<T | null> {
  const r = await getRedis();
  return (await r.get(key)) as T | null;
}

async function redisSet(key: string, value: any): Promise<void> {
  const r = await getRedis();
  await r.set(key, JSON.parse(JSON.stringify(value)));
}

// Redis 键名
const K_NODES = "nodes";
const K_WEEKLIES = "weeklies";
const K_BLOCKS = "weekly_blocks";
const K_MEMBERS = "members";

// ---- Nodes ----

export async function getAllNodes(): Promise<ProjectNode[]> {
  if (hasRedis()) return (await redisGet<ProjectNode[]>(K_NODES)) ?? [];
  return fsGetAllNodes();
}

export async function getNode(id: string): Promise<ProjectNode | null> {
  if (hasRedis()) {
    const nodes = await getAllNodes();
    return nodes.find((n) => n.id === id) ?? null;
  }
  return fsGetNode(id);
}

export async function createNode(data: Omit<ProjectNode, "id" | "url">): Promise<ProjectNode> {
  if (hasRedis()) {
    const nodes = (await redisGet<ProjectNode[]>(K_NODES)) ?? [];
    const id = idGen();
    const node: ProjectNode = { ...data, id, url: "" };
    nodes.push(node);
    await redisSet(K_NODES, nodes);
    if (data.owner?.trim()) {
      await ensureMemberExists(data.owner.trim());
    }
    return node;
  }
  return fsCreateNode(data);
}

export async function updateNode(id: string, patch: Partial<ProjectNode>): Promise<ProjectNode> {
  if (hasRedis()) {
    const nodes = (await redisGet<ProjectNode[]>(K_NODES)) ?? [];
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error(`Node ${id} not found`);
    const updated = { ...nodes[idx], ...patch, id };
    nodes[idx] = updated;
    await redisSet(K_NODES, nodes);
    if (patch.owner?.trim()) {
      await ensureMemberExists(patch.owner.trim());
    }
    return updated;
  }
  return fsUpdateNode(id, patch);
}

export async function deleteNode(id: string): Promise<void> {
  if (hasRedis()) {
    const nodes = (await redisGet<ProjectNode[]>(K_NODES)) ?? [];
    const filtered = nodes.filter((n) => n.id !== id);
    await redisSet(K_NODES, filtered);
    return;
  }
  return fsDeleteNode(id);
}

// ---- Weeklies ----

export async function getAllWeeklies(): Promise<WeeklyReport[]> {
  if (hasRedis()) return (await redisGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
  return fsGetAllWeeklies();
}

export async function getWeekly(id: string): Promise<WeeklyReport | null> {
  if (hasRedis()) {
    const weeklies = await getAllWeeklies();
    return weeklies.find((w) => w.id === id) ?? null;
  }
  return fsGetWeekly(id);
}

export async function getWeekliesForNode(nodeId: string): Promise<WeeklyReport[]> {
  if (hasRedis()) {
    const weeklies = await getAllWeeklies();
    return weeklies.filter((w) => w.relatedNodes.includes(nodeId));
  }
  return fsGetWeekliesForNode(nodeId);
}

export async function getWeekliesForWeek(monday: string): Promise<WeeklyReport[]> {
  if (hasRedis()) {
    const weeklies = await getAllWeeklies();
    return weeklies.filter((w) => w.week === monday);
  }
  return fsGetWeekliesForWeek(monday);
}

export async function createWeekly(data: Omit<WeeklyReport, "id" | "url">): Promise<WeeklyReport> {
  if (hasRedis()) {
    const weeklies = (await redisGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
    const id = idGen();
    const weekly: WeeklyReport = { ...data, id, url: "" };
    weeklies.push(weekly);
    await redisSet(K_WEEKLIES, weeklies);
    return weekly;
  }
  return fsCreateWeekly(data);
}

export async function updateWeekly(id: string, patch: Partial<WeeklyReport>): Promise<WeeklyReport> {
  if (hasRedis()) {
    const weeklies = (await redisGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
    const idx = weeklies.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Weekly ${id} not found`);
    const updated = { ...weeklies[idx], ...patch, id };
    weeklies[idx] = updated;
    await redisSet(K_WEEKLIES, weeklies);
    return updated;
  }
  return fsUpdateWeekly(id, patch);
}

export async function deleteWeekly(id: string): Promise<void> {
  if (hasRedis()) {
    const weeklies = (await redisGet<WeeklyReport[]>(K_WEEKLIES)) ?? [];
    const filtered = weeklies.filter((w) => w.id !== id);
    await redisSet(K_WEEKLIES, filtered);
    // 清理关联 blocks
    const blocks = (await redisGet<Record<string, any[]>>(K_BLOCKS)) ?? {};
    delete blocks[id];
    await redisSet(K_BLOCKS, blocks);
    return;
  }
  return fsDeleteWeekly(id);
}

// ---- Weekly Blocks ----

export async function getWeeklyBlocks(id: string): Promise<any[]> {
  if (hasRedis()) {
    const blocks = (await redisGet<Record<string, any[]>>(K_BLOCKS)) ?? {};
    return blocks[id] ?? [];
  }
  return fsGetWeeklyBlocks(id);
}

export async function setWeeklyBlocks(id: string, blocks: any[]): Promise<void> {
  if (hasRedis()) {
    const all = (await redisGet<Record<string, any[]>>(K_BLOCKS)) ?? {};
    all[id] = blocks;
    await redisSet(K_BLOCKS, all);
    return;
  }
  return fsSetWeeklyBlocks(id, blocks);
}

// ---- Members ----

export async function getAllMembers(): Promise<Member[]> {
  if (hasRedis()) {
    let members = (await redisGet<Member[]>(K_MEMBERS)) ?? [];
    // 自动从 nodes 补充新负责人
    const nodes = await getAllNodes();
    const existingNames = new Set(members.map((m) => m.name));
    const newOwners = Array.from(
      new Set(nodes.map((n) => n.owner).filter(Boolean))
    ).filter((n) => !existingNames.has(n));
    if (newOwners.length > 0) {
      newOwners.forEach((name) => members.push({ id: idGen(), name, archived: false }));
      await redisSet(K_MEMBERS, members);
    }
    return members;
  }
  return fsGetAllMembers();
}

export async function createMember(name: string): Promise<Member> {
  if (hasRedis()) {
    const members = await getAllMembers();
    if (members.some((m) => m.name === name)) throw new Error(`成员 "${name}" 已存在`);
    const member: Member = { id: idGen(), name, archived: false };
    members.push(member);
    await redisSet(K_MEMBERS, members);
    return member;
  }
  return fsCreateMember(name);
}

export async function updateMember(id: string, patch: Partial<Member>): Promise<Member> {
  if (hasRedis()) {
    const members = await getAllMembers();
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`成员 ${id} 不存在`);
    members[idx] = { ...members[idx], ...patch, id };
    await redisSet(K_MEMBERS, members);
    return members[idx];
  }
  return fsUpdateMember(id, patch);
}

export async function deleteMember(id: string): Promise<void> {
  if (hasRedis()) {
    const members = await getAllMembers();
    const filtered = members.filter((m) => m.id !== id);
    await redisSet(K_MEMBERS, filtered);
    return;
  }
  return fsDeleteMember(id);
}

// ---- 内部工具 ----

function idGen(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 仅在 Redis 模式下使用：自动将新负责人加入成员列表。
 * JSON 文件模式下，localStore 已内置此逻辑。
 */
async function ensureMemberExists(name: string): Promise<void> {
  const members = (await redisGet<Member[]>(K_MEMBERS)) ?? [];
  if (members.some((m) => m.name === name)) return;
  members.push({ id: idGen(), name, archived: false });
  await redisSet(K_MEMBERS, members);
}
