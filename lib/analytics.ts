import type { ProjectNode, WeeklyReport } from "./types";
import { parseLocal, beijingNow } from "./date";

export function parseDateSafe(s?: string): Date | null {
  if (!s) return null;
  // 使用 parseLocal 避免 UTC 时区偏移：new Date("2026-07-06") 在 UTC 时区会得到 7/5 20:00
  return parseLocal(s);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function isCompleted(node: ProjectNode): boolean {
  return node.status === "已完成";
}

export function isBlocked(node: ProjectNode): boolean {
  return node.status === "阻塞";
}

export function isInProgress(node: ProjectNode): boolean {
  return node.status === "进行中";
}

export function isNotStarted(node: ProjectNode): boolean {
  return node.status === "未开始";
}

export function isOverdue(node: ProjectNode): boolean {
  if (isCompleted(node)) return false;
  const end = parseDateSafe(node.end);
  if (!end) return false;
  const now = beijingNow();
  return startOfDay(end).getTime() < startOfDay(now).getTime();
}

export function isDueSoon(node: ProjectNode, days = 7): boolean {
  if (isCompleted(node) || isBlocked(node)) return false;
  const end = parseDateSafe(node.end);
  if (!end) return false;
  const now = beijingNow();
  const diff = daysBetween(startOfDay(now), end);
  return diff >= 0 && diff <= days;
}

export function progressPercentage(node: ProjectNode): number {
  if (isCompleted(node)) return 100;
  if (isInProgress(node)) return 50;
  return 0;
}

export function projectProgress(nodes: ProjectNode[]): number {
  if (nodes.length === 0) return 0;
  const total = nodes.reduce((sum, n) => sum + progressPercentage(n), 0);
  return Math.round(total / nodes.length);
}

export function weightedProjectProgress(nodes: ProjectNode[]): number {
  if (nodes.length === 0) return 0;
  // 四象限优先级权重：重要紧急 4 > 重要不紧急 3 > 紧急不重要 2 > 不紧急不重要 1
  const weights: Record<string, number> = { 重要紧急: 4, 重要不紧急: 3, 紧急不重要: 2, 不紧急不重要: 1 };
  let weighted = 0;
  let totalWeight = 0;
  nodes.forEach((n) => {
    const w = weights[n.priority] ?? 1;
    weighted += progressPercentage(n) * w;
    totalWeight += w;
  });
  return Math.round(weighted / totalWeight);
}

export function latestWeeklyForNode(
  nodeId: string,
  weeklies: WeeklyReport[]
): WeeklyReport | null {
  const matches = weeklies.filter((w) => w.relatedNodes.includes(nodeId));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.week.localeCompare(a.week))[0];
}

export function weeklyProgressText(node: ProjectNode, weeklies: WeeklyReport[]): string {
  const latest = latestWeeklyForNode(node.id, weeklies);
  return latest?.summary?.trim() ?? "";
}

export type RiskLevel = "high" | "medium" | "low" | "none";

export function riskLevel(node: ProjectNode): RiskLevel {
  if (isBlocked(node) && node.priority === "重要紧急") return "high";
  if (isOverdue(node) && node.priority === "重要紧急") return "high";
  if (isBlocked(node) || isOverdue(node)) return "medium";
  if (isDueSoon(node, 3) && node.priority === "重要紧急") return "medium";
  if (isDueSoon(node, 3)) return "low";
  return "none";
}

export function riskScore(node: ProjectNode): number {
  const level = riskLevel(node);
  const priorityWeight: Record<string, number> = { 重要紧急: 4, 重要不紧急: 3, 紧急不重要: 2, 不紧急不重要: 1 };
  const levelWeight: Record<RiskLevel, number> = { high: 4, medium: 2, low: 1, none: 0 };
  return (priorityWeight[node.priority] ?? 1) * (levelWeight[level] ?? 0);
}

export function riskReasons(node: ProjectNode): string[] {
  const reasons: string[] = [];
  const now = beijingNow();
  if (isBlocked(node)) reasons.push("状态阻塞");
  if (isOverdue(node)) reasons.push(`已逾期 ${Math.abs(daysBetween(parseDateSafe(node.end)!, now))} 天`);
  if (isDueSoon(node, 3)) reasons.push("3 天内到期");
  else if (isDueSoon(node, 7)) reasons.push("7 天内到期");
  return reasons;
}

export function dependencyBlockers(node: ProjectNode, allNodes: ProjectNode[]): ProjectNode[] {
  return allNodes.filter((n) => node.dependsOn.includes(n.id) && !isCompleted(n));
}

export function statusCounts(nodes: ProjectNode[]) {
  const counts: Record<string, number> = { 未开始: 0, 进行中: 0, 已完成: 0, 阻塞: 0 };
  nodes.forEach((n) => {
    counts[n.status] = (counts[n.status] ?? 0) + 1;
  });
  return counts;
}

export function priorityCounts(nodes: ProjectNode[]) {
  const counts: Record<string, number> = { 重要紧急: 0, 重要不紧急: 0, 紧急不重要: 0, 不紧急不重要: 0 };
  nodes.forEach((n) => {
    counts[n.priority] = (counts[n.priority] ?? 0) + 1;
  });
  return counts;
}

export function ownerWorkload(nodes: ProjectNode[]) {
  const map = new Map<string, number>();
  nodes.forEach((n) => {
    if (!n.owner) return;
    map.set(n.owner, (map.get(n.owner) ?? 0) + 1);
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

export function recommendNextActions(node: ProjectNode, allNodes: ProjectNode[]): string[] {
  const actions: string[] = [];
  const blockers = dependencyBlockers(node, allNodes);
  if (blockers.length > 0) {
    actions.push(`依赖项未完成：${blockers.map((b) => b.name).join("、")}，需优先推动`);
  }
  if (isBlocked(node)) {
    actions.push("当前节点被阻塞，建议负责人同步阻塞原因与解除计划");
  }
  if (isOverdue(node)) {
    actions.push("节点已逾期，建议重新评估 Deadline 或协调资源追赶");
  }
  if (isDueSoon(node, 3) && !isCompleted(node)) {
    actions.push("节点即将到期，建议确认交付物与验收标准");
  }
  if (isInProgress(node) && blockers.length === 0) {
    actions.push("节点推进中，建议按原计划跟进交付");
  }
  return actions;
}
