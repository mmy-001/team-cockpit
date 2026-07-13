"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ProjectNode, WeeklyReport } from "@/lib/types";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/types";
import {
  riskLevel,
  riskScore,
  riskReasons,
  dependencyBlockers,
  recommendNextActions,
  ownerWorkload,
  latestWeeklyForNode,
  isCompleted,
  isBlocked,
  isOverdue,
  isDueSoon,
} from "@/lib/analytics";
import { AlertCircle, AlertTriangle, Users, Lightbulb, Flag, TrendingUp } from "lucide-react";

export default function DecisionView({
  nodes,
  weeklies,
}: {
  nodes: ProjectNode[];
  weeklies: WeeklyReport[];
}) {
  const stats = useMemo(() => {
    const highRisk = nodes
      .filter((n) => riskLevel(n) === "high" && !isCompleted(n))
      .sort((a, b) => riskScore(b) - riskScore(a));
    const mediumRisk = nodes
      .filter((n) => riskLevel(n) === "medium" && !isCompleted(n))
      .sort((a, b) => riskScore(b) - riskScore(a));
    const lowRisk = nodes.filter((n) => riskLevel(n) === "low" && !isCompleted(n));
    const workload = ownerWorkload(nodes);
    const critical = nodes.filter((n) => (n.priority === "重要紧急" || n.priority === "重要不紧急") && !isCompleted(n));
    const blockers = nodes.filter((n) => n.priority === "重要紧急" && isBlocked(n));
    const overdueHigh = nodes.filter((n) => n.priority === "重要紧急" && isOverdue(n));
    return { highRisk, mediumRisk, lowRisk, workload, critical, blockers, overdueHigh };
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm border border-dashed border-notion-border rounded-md">
        暂无项目节点，无法生成决策视图
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800">
        <strong>决策视图：</strong>为负责人/Leader 快速定位关键节点、判断卡点并明确下一步。红色=高风险（重要紧急且阻塞/逾期），黄色=中风险，蓝色=需关注。点击节点可直接编辑。
      </div>

      {/* Executive summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <SummaryCard
          icon={AlertCircle}
          value={stats.highRisk.length}
          label="高风险节点"
          desc="重要紧急 + 阻塞/逾期"
          color="bg-red-50 text-red-700 border-red-200"
        />
        <SummaryCard
          icon={Flag}
          value={stats.critical.length}
          label="重要节点"
          desc="重要紧急或重要不紧急"
          color="bg-yellow-50 text-yellow-700 border-yellow-200"
        />
        <SummaryCard
          icon={TrendingUp}
          value={nodes.filter((n) => isDueSoon(n, 7) && !isCompleted(n)).length}
          label="7 天内到期"
          desc="需关注交付进度"
          color="bg-blue-50 text-blue-700 border-blue-200"
        />
      </div>

      {/* Risk matrix */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="font-medium">风险矩阵</h3>
          <span className="text-xs text-gray-400 ml-2">按优先级 × 状态风险排序</span>
        </div>
        <div className="space-y-4">
          <RiskSection title="高风险" nodes={stats.highRisk} weeklies={weeklies} allNodes={nodes} accent="red" />
          <RiskSection title="中风险" nodes={stats.mediumRisk} weeklies={weeklies} allNodes={nodes} accent="yellow" />
          <RiskSection title="需关注" nodes={stats.lowRisk} weeklies={weeklies} allNodes={nodes} accent="blue" />
        </div>
      </div>

      {/* Owner workload */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-notion-blue" />
          <h3 className="font-medium">负责人负载</h3>
          <span className="text-xs text-gray-400 ml-2">按节点数量统计</span>
        </div>
        {stats.workload.length === 0 ? (
          <div className="text-sm text-gray-400">未分配负责人</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.workload.map(([owner, count]) => (
              <div key={owner} className="border border-notion-border rounded p-3 text-sm">
                <div className="font-medium">{owner || "未署名"}</div>
                <div className="text-xs text-gray-500 mt-1">负责 {count} 个节点</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended actions */}
      <div className="bg-white border border-notion-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-yellow-600" />
          <h3 className="font-medium">决策建议</h3>
          <span className="text-xs text-gray-400 ml-2">基于当前节点状态与依赖关系生成</span>
        </div>
        <div className="space-y-3">
          {stats.highRisk.length === 0 ? (
            <div className="text-sm text-gray-400">当前无高风险节点，建议维持既有节奏</div>
          ) : (
            stats.highRisk.slice(0, 6).map((node) => {
              const actions = recommendNextActions(node, nodes);
              return (
                <div key={node.id} className="border border-notion-border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Link href={`/nodes/${node.id}`} className="font-medium text-sm hover:underline">
                      {node.name || "（未命名）"}
                    </Link>
                    <span className="text-xs text-gray-500">
                      {node.priority} · {node.status} · {node.owner || "-"}
                    </span>
                  </div>
                  <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                    {actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  value,
  label,
  desc,
  color,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  desc: string;
  color: string;
}) {
  return (
    <div className={`border rounded-md p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Icon size={18} />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80 mt-1">{desc}</div>
    </div>
  );
}

function RiskSection({
  title,
  nodes,
  weeklies,
  allNodes,
  accent,
}: {
  title: string;
  nodes: ProjectNode[];
  weeklies: WeeklyReport[];
  allNodes: ProjectNode[];
  accent: "red" | "yellow" | "blue";
}) {
  if (nodes.length === 0) return null;
  const accentClass = {
    red: "border-l-4 border-l-red-500",
    yellow: "border-l-4 border-l-yellow-500",
    blue: "border-l-4 border-l-notion-blue",
  }[accent];
  return (
    <div className={accentClass}>
      <div className="text-sm font-medium text-gray-600 mb-2 pl-3">
        {title} <span className="text-gray-400">({nodes.length})</span>
      </div>
      <div className="space-y-2">
        {nodes.map((node) => (
          <RiskRow key={node.id} node={node} weeklies={weeklies} allNodes={allNodes} />
        ))}
      </div>
    </div>
  );
}

function RiskRow({
  node,
  weeklies,
  allNodes,
}: {
  node: ProjectNode;
  weeklies: WeeklyReport[];
  allNodes: ProjectNode[];
}) {
  const reasons = riskReasons(node);
  const blockers = dependencyBlockers(node, allNodes);
  const latest = latestWeeklyForNode(node.id, weeklies);
  return (
    <Link
      href={`/nodes/${node.id}`}
      className="block p-3 border border-notion-border rounded hover:bg-notion-hover"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${PRIORITY_COLORS[node.priority]}`}>{node.priority}</span>
            <span className="font-medium text-sm truncate">{node.name || "（未命名）"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className={`px-1.5 py-0.5 rounded border ${STATUS_COLORS[node.status]}`}>{node.status}</span>
            {reasons.map((r, i) => (
              <span key={i} className="text-red-600">
                {r}
              </span>
            ))}
            {blockers.length > 0 && (
              <span className="text-orange-600">依赖阻塞：{blockers.map((b) => b.name).join("、")}</span>
            )}
          </div>
          {latest && (
            <div className="mt-2 text-xs text-gray-600 line-clamp-2">最新周报：{latest.summary || "无总结"}</div>
          )}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap text-right">
          <div>{node.owner || "-"}</div>
          <div className="mt-1">{node.end || "无截止日期"}</div>
        </div>
      </div>
    </Link>
  );
}
