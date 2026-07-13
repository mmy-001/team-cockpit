import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { ProjectNode, WeeklyReport, Member } from "./types";

const DATA_DIR = join(process.cwd(), "data");
export const NODES_FILE = join(DATA_DIR, "nodes.json");
export const WEEKLIES_FILE = join(DATA_DIR, "weeklies.json");
export const WEEKLY_BLOCKS_FILE = join(DATA_DIR, "weekly_blocks.json");
export const MEMBERS_FILE = join(DATA_DIR, "members.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    return mkdir(DATA_DIR, { recursive: true });
  }
  return Promise.resolve();
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  await ensureDir();
  if (!existsSync(path)) {
    await writeFile(path, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
  const raw = await readFile(path, "utf-8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---- 简易文件写入锁 ----
// 防止并发读写导致数据丢失。Node.js 单线程天然有事件循环串行化的优势，
// 但 async/await 的 yield 点（await readFile / await writeFile 之间）
// 仍可能导致竞态条件。这里用 Promise 链串行化每个文件的写操作。
const writeQueues: Record<string, Promise<void>> = {};

function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueues[filePath] ?? Promise.resolve();
  const next = prev.then(fn, fn); // 即使前一个失败也继续
  writeQueues[filePath] = next.then(() => undefined).catch(() => undefined);
  return next;
}

export async function writeJsonFile<T>(path: string, data: T): Promise<void> {
  await ensureDir();
  await withFileLock(path, async () => {
    await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  });
}

// ---- Nodes ----

export async function getAllNodes(): Promise<ProjectNode[]> {
  return readJson<ProjectNode[]>(NODES_FILE, []);
}

export async function getNode(id: string): Promise<ProjectNode | null> {
  const nodes = await getAllNodes();
  return nodes.find((n) => n.id === id) ?? null;
}

export async function updateNode(id: string, patch: Partial<ProjectNode>): Promise<ProjectNode> {
  const nodes = await getAllNodes();
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx === -1) throw new Error(`Node ${id} not found`);
  const updated = { ...nodes[idx], ...patch, id };
  nodes[idx] = updated;
  await writeJsonFile(NODES_FILE, nodes);

  // 若修改了负责人，自动将其加入成员列表
  if (patch.owner && patch.owner.trim()) {
    await ensureMemberExists(patch.owner.trim());
  }

  return updated;
}

export async function createNode(data: Omit<ProjectNode, "id" | "url">): Promise<ProjectNode> {
  const nodes = await getAllNodes();
  const id = cryptoRandomId();
  const node: ProjectNode = { ...data, id, url: "" };
  nodes.push(node);
  await writeJsonFile(NODES_FILE, nodes);

  // 若指定了负责人，自动将其加入成员列表（避免 Dashboard 遗漏）
  if (data.owner && data.owner.trim()) {
    await ensureMemberExists(data.owner.trim());
  }

  return node;
}

export async function deleteNode(id: string): Promise<void> {
  const nodes = await getAllNodes();
  const filtered = nodes.filter((n) => n.id !== id);
  await writeJsonFile(NODES_FILE, filtered);
}

// ---- Weeklies ----

export async function getAllWeeklies(): Promise<WeeklyReport[]> {
  return readJson<WeeklyReport[]>(WEEKLIES_FILE, []);
}

export async function getWeekly(id: string): Promise<WeeklyReport | null> {
  const weeklies = await getAllWeeklies();
  return weeklies.find((w) => w.id === id) ?? null;
}

export async function getWeekliesForNode(nodeId: string): Promise<WeeklyReport[]> {
  const weeklies = await getAllWeeklies();
  return weeklies.filter((w) => w.relatedNodes.includes(nodeId));
}

export async function getWeekliesForWeek(monday: string): Promise<WeeklyReport[]> {
  const weeklies = await getAllWeeklies();
  return weeklies.filter((w) => w.week === monday);
}

export async function updateWeekly(id: string, patch: Partial<WeeklyReport>): Promise<WeeklyReport> {
  const weeklies = await getAllWeeklies();
  const idx = weeklies.findIndex((w) => w.id === id);
  if (idx === -1) throw new Error(`Weekly ${id} not found`);
  const updated = { ...weeklies[idx], ...patch, id };
  weeklies[idx] = updated;
  await writeJsonFile(WEEKLIES_FILE, weeklies);
  return updated;
}

export async function createWeekly(data: Omit<WeeklyReport, "id" | "url">): Promise<WeeklyReport> {
  const weeklies = await getAllWeeklies();
  const id = cryptoRandomId();
  const weekly: WeeklyReport = { ...data, id, url: "" };
  weeklies.push(weekly);
  await writeJsonFile(WEEKLIES_FILE, weeklies);
  return weekly;
}

export async function deleteWeekly(id: string): Promise<void> {
  const weeklies = await getAllWeeklies();
  const filtered = weeklies.filter((w) => w.id !== id);
  await writeJsonFile(WEEKLIES_FILE, filtered);
  const blocks = await getAllWeeklyBlocks();
  delete blocks[id];
  await writeJsonFile(WEEKLY_BLOCKS_FILE, blocks);
}

// ---- Weekly blocks ----

type BlockStore = Record<string, any[]>;

export async function getAllWeeklyBlocks(): Promise<BlockStore> {
  return readJson<BlockStore>(WEEKLY_BLOCKS_FILE, {});
}

export async function getWeeklyBlocks(id: string): Promise<any[]> {
  const blocks = await getAllWeeklyBlocks();
  return blocks[id] ?? [];
}

export async function setWeeklyBlocks(id: string, blocks: any[]): Promise<void> {
  const all = await getAllWeeklyBlocks();
  all[id] = blocks;
  await writeJsonFile(WEEKLY_BLOCKS_FILE, all);
}

// ---- helpers ----

function cryptoRandomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Members ----

async function ensureMemberExists(name: string): Promise<void> {
  const members = await readJson<Member[]>(MEMBERS_FILE, []);
  if (members.some((m) => m.name === name)) return;
  members.push({ id: cryptoRandomId(), name, archived: false });
  await writeJsonFile(MEMBERS_FILE, members);
}

export async function getAllMembers(): Promise<Member[]> {
  let members = await readJson<Member[]>(MEMBERS_FILE, []);
  // 自动从 nodes 中补充已有负责人（避免历史数据丢失成员）
  if (members.length === 0) {
    const nodes = await getAllNodes();
    const owners = Array.from(new Set(nodes.map((n) => n.owner).filter(Boolean)));
    if (owners.length > 0) {
      members = owners.map((name) => ({ id: cryptoRandomId(), name, archived: false }));
      await writeJsonFile(MEMBERS_FILE, members);
    }
  }
  // 自动从 nodes 补充新负责人（有人被分配了节点但不在成员列表里）
  const nodes = await getAllNodes();
  const existingNames = new Set(members.map((m) => m.name));
  const newOwners = Array.from(new Set(nodes.map((n) => n.owner).filter(Boolean))).filter((n) => !existingNames.has(n));
  if (newOwners.length > 0) {
    newOwners.forEach((name) => members.push({ id: cryptoRandomId(), name, archived: false }));
    await writeJsonFile(MEMBERS_FILE, members);
  }
  return members;
}

export async function createMember(name: string): Promise<Member> {
  const members = await getAllMembers();
  if (members.some((m) => m.name === name)) {
    throw new Error(`成员 "${name}" 已存在`);
  }
  const member: Member = { id: cryptoRandomId(), name, archived: false };
  members.push(member);
  await writeJsonFile(MEMBERS_FILE, members);
  return member;
}

export async function updateMember(id: string, patch: Partial<Member>): Promise<Member> {
  const members = await getAllMembers();
  const idx = members.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error(`成员 ${id} 不存在`);
  members[idx] = { ...members[idx], ...patch, id };
  await writeJsonFile(MEMBERS_FILE, members);
  return members[idx];
}

export async function deleteMember(id: string): Promise<void> {
  const members = await getAllMembers();
  const member = members.find((m) => m.id === id);
  if (!member) throw new Error(`成员 ${id} 不存在`);

  // 1. 级联删除该成员负责的所有节点
  const nodes = await getAllNodes();
  const remainingNodes = nodes.filter((n) => n.owner !== member.name);
  if (remainingNodes.length !== nodes.length) {
    await writeJsonFile(NODES_FILE, remainingNodes);
  }

  // 2. 级联删除该成员撰写的所有周报（含 blocks）
  const weeklies = await getAllWeeklies();
  const memberWeeklyIds: string[] = [];
  const remainingWeeklies = weeklies.filter((w) => {
    if (w.author === member.name) {
      memberWeeklyIds.push(w.id);
      return false;
    }
    return true;
  });
  if (remainingWeeklies.length !== weeklies.length) {
    await writeJsonFile(WEEKLIES_FILE, remainingWeeklies);
    if (memberWeeklyIds.length > 0) {
      const blocks = await getAllWeeklyBlocks();
      memberWeeklyIds.forEach((wid) => delete blocks[wid]);
      await writeJsonFile(WEEKLY_BLOCKS_FILE, blocks);
    }
  }

  // 3. 物理删除成员
  const filtered = members.filter((m) => m.id !== id);
  await writeJsonFile(MEMBERS_FILE, filtered);
}
