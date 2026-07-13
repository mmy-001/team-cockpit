"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ProjectNode, WeeklyReport, Member } from "@/lib/types";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/types";
import {
  projectProgress,
  weightedProjectProgress,
  statusCounts,
  priorityCounts,
  isOverdue,
  isBlocked,
  isDueSoon,
  isCompleted,
  riskLevel,
  recommendNextActions,
  dependencyBlockers,
  ownerWorkload,
  parseDateSafe,
  daysBetween,
} from "@/lib/analytics";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Users, Lightbulb, Flag, Archive } from "lucide-react";

export default function Dashboard({
  nodes,
  weeklies,
  members,
  onRefresh,
}: {
  nodes: ProjectNode[];
  weeklies: WeeklyReport[];
  members: Member[];
  onRefresh?: () => void;
}) {
  const stats = useMemo(() => {
    const total = nodes.length;
    const completed = nodes.filter(isCompleted).length;
    const inProgress = nodes.filter((n) => n.status === "进行中").length;
    const blocked = nodes.filter(isBlocked).length;
    const overdue = nodes.filter(isOverdue).length;
    const dueSoon = nodes.filter((n) => isDueSoon(n, 7)).length;
    const status = statusCounts(nodes);
    const priority = priorityCounts(nodes);
    const simpleProgress = projectProgress(nodes);
    const weightedProgress = weightedProjectProgress(nodes);
    const upcoming = nodes
      .filter((n) => isDueSoon(n, 7) && !isCompleted(n))
      .sort((a, b) => (parseDateSafe(a.end)?.getTime() ?? 0) - (parseDateSafe(b.end)?.getTime() ?? 0));
    const alerts = nodes
      .filter((n) => isBlocked(n) || isOverdue(n))
      .sort((a, b) => riskSort(a) - riskSort(b));
    // 四象限分组（仅非已完成节点）
    const activeNodes = nodes.filter((n) => !isCompleted(n));
    const quadrants = {
      "重要紧急": activeNodes.filter((n) => n.priority === "重要紧急"),
      "重要不紧急": activeNodes.filter((n) => n.priority === "重要不紧急"),
      "紧急不重要": activeNodes.filter((n) => n.priority === "紧急不重要"),
      "不紧急不重要": activeNodes.filter((n) => n.priority === "不紧急不重要"),
    };
    // 高风险节点（用于决策建议）
    const highRisk = nodes
      .filter((n) => riskLevel(n) === "high" && !isCompleted(n))
      .sort((a, b) => {
        const pw: Record<string, number> = { 重要紧急: 4, 重要不紧急: 3, 紧急不重要: 2, 不紧急不重要: 1 };
        return (pw[b.priority] ?? 0) - (pw[a.priority] ?? 0);
      });
    const allWorkload = ownerWorkload(nodes);
    // 只保留活跃成员（非归档）的负载；归档或删除后不再显示
    const activeMemberNames = new Set(members.filter((m) => !m.archived).map((m) => m.name));
    const workload = allWorkload.filter(([owner]) => activeMemberNames.has(owner));

    return {
      total, completed, inProgress, blocked, overdue, dueSoon,
      status, priority, simpleProgress, weightedProgress,
      upcoming, alerts, quadrants, highRisk, workload,
    };
  }, [nodes, members]);

  if (nodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm border border-dashed border-notion-border rounded-md">
        暂无项目节点，请在「节点列表」中添加节点。数据将在添加后自动同步。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 说明栏 */}
      <div className="bg-blue-50 border border-blue-100 rounded-md p-4 text-sm text-blue-800">
        <strong>项目总览：</strong>整合全局指标、四象限优先级分布、负责人负载与决策建议。红色=重要紧急（需立即处理），蓝色=重要不紧急（规划排期），橙色=紧急不重要（可委派），灰色=不紧急不重要（可砍掉/延后）。
      </div>

      {/* ========== 1. 全局指标卡 ========== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CheckCircle2} label="已完成" value={stats.completed} sub={`/ ${stats.total}`} color="text-green-600" />
        <StatCard icon={TrendingUp} label="进行中" value={stats.inProgress} sub={`/ ${stats.total}`} color="text-blue-600" />
        <StatCard icon={AlertTriangle} label="阻塞/逾期" value={stats.blocked + stats.overdue} sub={`阻塞 ${stats.blocked} · 逾期 ${stats.overdue}`} color="text-red-600" />
        <StatCard icon={Flag} label="本周周报" value={weeklies.length} sub="已提交" color="text-notion-blue" />
      </div>

      {/* ========== 2. 进度条 ========== */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-notion-border rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">整体完成度</span>
            <span className="text-lg font-bold text-notion-fg">{stats.simpleProgress}%</span>
          </div>
          <ProgressBar value={stats.simpleProgress} color="bg-green-500" />
          <div className="mt-3 text-xs text-gray-400">基于节点状态统计（未开始 0 / 进行中 50 / 已完成 100）</div>
        </div>
        <div className="bg-white border border-notion-border rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">加权推进进度</span>
            <span className="text-lg font-bold text-notion-fg">{stats.weightedProgress}%</span>
          </div>
          <ProgressBar value={stats.weightedProgress} color="bg-notion-blue" />
          <div className="mt-3 text-xs text-gray-400">
            按四象限优先级加权（重要紧急 4 {'>'} 重要不紧急 3 {'>'} 紧急不重要 2 {'>'} 不紧急不重要 1）
          </div>
        </div>
      </div>

      {/* ========== 3. 状态分布 + 优先级分布 ========== */}
      <div className="grid md:grid-cols-2 gap-4">
        <DistributionCard title="状态分布" data={stats.status} colors={STATUS_COLORS} />
        <DistributionCard title="优先级分布" data={stats.priority} colors={PRIORITY_COLORS} />
      </div>

      {/* ========== 4. 四象限分布 ========== */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <h3 className="font-medium mb-4">四象限分布（活跃节点）</h3>
        <div className="grid grid-cols-2 gap-0.5 rounded overflow-hidden border border-notion-border">
          <div className="text-center text-[11px] text-gray-400 bg-gray-50 py-1.5 font-medium">← 紧急 →</div>
          <div className="text-center text-[11px] text-gray-400 bg-gray-50 py-1.5 font-medium">← 不紧急 →</div>
          <QuadrantTile label="重要紧急" count={stats.quadrants["重要紧急"].length} color="bg-red-50 border-red-200 text-red-700" rowLabel="↑ 重要 ↑" />
          <QuadrantTile label="重要不紧急" count={stats.quadrants["重要不紧急"].length} color="bg-blue-50 border-blue-200 text-blue-700" />
          <QuadrantTile label="紧急不重要" count={stats.quadrants["紧急不重要"].length} color="bg-amber-50 border-amber-200 text-amber-700" rowLabel="↓ 不重要 ↓" />
          <QuadrantTile label="不紧急不重要" count={stats.quadrants["不紧急不重要"].length} color="bg-gray-50 border-gray-200 text-gray-600" />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
          <span>🔴 重要紧急：立即处理</span>
          <span>🔵 重要不紧急：规划排期</span>
          <span>🟡 紧急不重要：委派/速战</span>
          <span>⚪ 不紧急不重要：砍掉/延后</span>
        </div>
      </div>

      {/* ========== 5. 负责人负载 ========== */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-notion-blue" />
          <h3 className="font-medium">负责人负载</h3>
          <span className="text-xs text-gray-400 ml-2">按节点数统计，点击查看个人四象限</span>
        </div>
        {stats.workload.length === 0 ? (
          <div className="text-sm text-gray-400">未分配负责人</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.workload.map(([owner, count]) => (
              <Link
                key={owner}
                href={`/persons/${encodeURIComponent(owner)}`}
                className="border border-notion-border rounded p-3 text-sm hover:bg-notion-hover hover:border-notion-blue/50 transition-colors group"
              >
                <div className="font-medium group-hover:text-notion-blue">{owner || "未署名"}</div>
                <div className="text-xs text-gray-500 mt-1">
                  负责 {count} 个节点
                </div>
                <div className="text-[10px] text-notion-blue/0 group-hover:text-notion-blue/70 mt-1 transition-colors">
                  查看个人看板 →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ========== 6. 决策建议（仅高风险节点） ========== */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-yellow-600" />
          <h3 className="font-medium">决策建议</h3>
          <span className="text-xs text-gray-400 ml-2">基于四象限优先级与节点状态生成</span>
        </div>
        {stats.highRisk.length === 0 ? (
          <div className="text-sm text-gray-400 bg-green-50 border border-green-100 rounded p-3">
            ✅ 当前无高风险节点，可以按既有节奏推进
          </div>
        ) : (
          <div className="space-y-3">
            {stats.highRisk.slice(0, 6).map((node) => {
              const actions = recommendNextActions(node, nodes);
              return (
                <div key={node.id} className="border border-notion-border rounded p-3 hover:bg-notion-hover">
                  <div className="flex items-center justify-between mb-2">
                    <Link href={`/nodes/${node.id}`} className="font-medium text-sm hover:underline">
                      {node.name || "（未命名）"}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[node.priority]}`}>{node.priority}</span>
                      <span>{node.status}</span>
                      <span>{node.owner || "-"}</span>
                    </div>
                  </div>
                  <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                    {actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== 7. 需要关注（阻塞/逾期） ========== */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="font-medium">需要关注</h3>
          <span className="text-xs text-gray-400 ml-2">阻塞或逾期的节点</span>
        </div>
        {stats.alerts.length === 0 ? (
          <div className="text-sm text-gray-400">当前无阻塞或逾期节点</div>
        ) : (
          <div className="space-y-2">
            {stats.alerts.slice(0, 8).map((node) => (
              <AlertRow key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>

      {/* ========== 8. 即将到期 ========== */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-notion-blue" />
          <h3 className="font-medium">即将到期</h3>
          <span className="text-xs text-gray-400 ml-2">未来 7 天</span>
        </div>
        {stats.upcoming.length === 0 ? (
          <div className="text-sm text-gray-400">未来 7 天无到期节点</div>
        ) : (
          <div className="space-y-2">
            {stats.upcoming.map((node) => (
              <DeadlineRow key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Helper components ----

function riskSort(node: ProjectNode): number {
  if (isBlocked(node) && node.priority === "重要紧急") return 0;
  if (isOverdue(node) && node.priority === "重要紧急") return 1;
  if (isBlocked(node)) return 2;
  if (isOverdue(node)) return 3;
  return 4;
}

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: number; sub: string; color: string;
}) {
  return (
    <div className="bg-white border border-notion-border rounded-md p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <Icon size={18} className={color} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-notion-fg">{value}</span>
        <span className="text-xs text-gray-400">{sub}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

function DistributionCard({
  title, data, colors,
}: {
  title: string; data: Record<string, number>; colors: Record<string, string>;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <div className="bg-white border border-notion-border rounded-md p-5">
      <h3 className="font-medium mb-4">{title}</h3>
      <div className="space-y-3">
        {Object.entries(data).map(([key, count]) => {
          const pct = total ? Math.round((count / total) * 100) : 0;
          const colorClass = colors[key] ?? "text-gray-600";
          // 提取文字颜色
          const textColor = colorClass.match(/text-\w+-\d+/)?.[0] ?? "";
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className={textColor}>{key}</span>
                <span className="text-gray-500">{count} ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-300 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuadrantTile({ label, count, color, rowLabel }: {
  label: string; count: number; color: string; rowLabel?: string;
}) {
  return (
    <div className={`border border-notion-border ${color} p-4 min-h-[80px] relative`}>
      {rowLabel && (
        <div className="absolute -left-7 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 whitespace-nowrap" style={{ writingMode: "vertical-lr" }}>
          {rowLabel}
        </div>
      )}
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{count}</span>
        <span className="text-xs opacity-60">个节点</span>
      </div>
    </div>
  );
}

function AlertRow({ node }: { node: ProjectNode }) {
  const end = parseDateSafe(node.end);
  const overdueDays = end && isOverdue(node) ? Math.abs(daysBetween(end, new Date())) : 0;
  return (
    <Link
      href={`/nodes/${node.id}`}
      className="flex items-center justify-between p-3 border border-notion-border rounded hover:bg-notion-hover text-sm"
    >
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[node.status] ?? ""}`}>{node.status}</span>
        <span className="font-medium">{node.name || "（未命名）"}</span>
      </div>
      <div className="text-xs text-gray-500">
        {isBlocked(node) && <span className="text-red-600 mr-2">阻塞</span>}
        {isOverdue(node) && <span className="text-red-600">逾期 {overdueDays} 天</span>}
        <span className="ml-2">{node.owner || "-"}</span>
      </div>
    </Link>
  );
}

function DeadlineRow({ node }: { node: ProjectNode }) {
  const end = parseDateSafe(node.end)!;
  const remaining = daysBetween(new Date(), end);
  return (
    <Link
      href={`/nodes/${node.id}`}
      className="flex items-center justify-between p-3 border border-notion-border rounded hover:bg-notion-hover text-sm"
    >
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[node.status] ?? ""}`}>{node.status}</span>
        <span className="font-medium">{node.name || "（未命名）"}</span>
      </div>
      <div className="text-xs text-gray-500">
        <span className={remaining <= 3 ? "text-red-600 font-medium" : ""}>剩 {remaining} 天</span>
        <span className="ml-3">{node.end}</span>
        <span className="ml-3">{node.owner || "-"}</span>
      </div>
    </Link>
  );
}
