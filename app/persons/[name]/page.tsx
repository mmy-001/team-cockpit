"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useNodes, useWeeklies } from "@/lib/hooks";
import { getThisWeekMonday, prevWeekMonday, nextWeekMonday, weekSunday, isNodeActiveInWeek } from "@/lib/date";
import { isCompleted, isOverdue, isBlocked } from "@/lib/analytics";
import type { ProjectNode } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import BackButton from "@/components/BackButton";
import { ChevronLeft, ChevronRight, AlertTriangle, Clock } from "lucide-react";

const QUADRANTS = [
  { key: "重要紧急", color: "border-red-300 bg-red-50/40", dot: "bg-red-500", label: "重要紧急", sub: "必须马上做" },
  { key: "重要不紧急", color: "border-blue-300 bg-blue-50/40", dot: "bg-blue-500", label: "重要不紧急", sub: "规划排期做" },
  { key: "紧急不重要", color: "border-amber-300 bg-amber-50/40", dot: "bg-amber-500", label: "紧急不重要", sub: "可委派/速战" },
  { key: "不紧急不重要", color: "border-gray-200 bg-gray-50/40", dot: "bg-gray-400", label: "不紧急不重要", sub: "砍掉/延后" },
] as const;

export default function PersonMatrixPage() {
  const { name } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name);
  const router = useRouter();
  const { nodes, isLoading } = useNodes();
  const { weeklies: allWeeklies } = useWeeklies();

  const [currentMonday, setCurrentMonday] = useState(() => getThisWeekMonday());

  const stats = useMemo(() => {
    const personNodes = nodes.filter((n) => n.owner === decodedName);
    // 该人在本周活跃的节点
    const weekActive = personNodes.filter((n) => isNodeActiveInWeek(n, currentMonday));
    // 按四象限分组
    const byQuadrant: Record<string, ProjectNode[]> = {};
    for (const q of QUADRANTS) {
      byQuadrant[q.key] = weekActive.filter((n) => n.priority === q.key);
    }
    // 该人本周的周报
    const personWeeklies = allWeeklies.filter((w) => w.author === decodedName && w.week === currentMonday);
    // 节点统计
    const total = personNodes.length;
    const completed = personNodes.filter(isCompleted).length;
    const overdue = personNodes.filter(isOverdue).length;
    const blocked = personNodes.filter(isBlocked).length;
    const active = personNodes.filter((n) => !isCompleted(n)).length;

    return { personNodes, weekActive, byQuadrant, personWeeklies, total, completed, overdue, blocked, active };
  }, [nodes, allWeeklies, decodedName, currentMonday]);

  const goPrevWeek = () => setCurrentMonday((m) => prevWeekMonday(m));
  const goNextWeek = () => setCurrentMonday((m) => nextWeekMonday(m));
  const goThisWeek = () => setCurrentMonday(getThisWeekMonday());
  const isThisWeek = currentMonday === getThisWeekMonday();
  const thisWeekMonday = getThisWeekMonday();
  const canGoNext = currentMonday < thisWeekMonday;

  const totalQuadrantNodes = Object.values(stats.byQuadrant).reduce((s, a) => s + a.length, 0);

  if (isLoading) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <BackButton />
        <div className="text-sm text-gray-400 py-8">加载中...</div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <BackButton />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-notion-fg">{decodedName} · 个人看板</h1>
        <Link
          href={`/weeklies/new?author=${encodeURIComponent(decodedName)}&week=${currentMonday}`}
          className="px-3 py-1.5 text-sm bg-notion-fg text-white rounded hover:bg-gray-700"
        >
          写周报
        </Link>
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={goPrevWeek} className="p-1.5 rounded hover:bg-notion-hover border border-notion-border" title="上一周">
          <ChevronLeft size={18} />
        </button>
        <span className="text-lg font-medium min-w-[200px] text-center">
          {currentMonday} ~ {weekSunday(currentMonday)}
          {isThisWeek && <span className="ml-2 text-xs text-notion-blue font-normal">本周</span>}
        </span>
        <button
          onClick={goNextWeek}
          disabled={!canGoNext}
          className="p-1.5 rounded hover:bg-notion-hover border border-notion-border disabled:opacity-30"
          title={canGoNext ? "下一周" : "已是本周"}
        >
          <ChevronRight size={18} />
        </button>
        {!isThisWeek && (
          <button onClick={goThisWeek} className="ml-2 text-xs text-notion-blue hover:underline">
            回到本周
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MiniStat label="总节点" value={stats.total} />
        <MiniStat label="活跃" value={stats.active} color="text-blue-600" />
        <MiniStat label="已完成" value={stats.completed} color="text-green-600" />
        <MiniStat label="逾期" value={stats.overdue} color="text-red-600" />
        <MiniStat label="阻塞" value={stats.blocked} color="text-orange-600" />
      </div>

      {/* 四象限 Eisenhower Matrix */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-medium text-gray-700">本周四象限</h2>
          <span className="text-xs text-gray-400">({currentMonday} ~ {weekSunday(currentMonday)})</span>
        </div>

        <div className="grid grid-cols-2 gap-0.5 bg-notion-border rounded-md overflow-hidden">
          {/* Header row: 紧急 / 不紧急 */}
          <div className="text-center text-xs font-medium text-gray-500 bg-white py-1.5">← 紧急 →</div>
          <div className="text-center text-xs font-medium text-gray-500 bg-white py-1.5">← 不紧急 →</div>
          {/* Row 1: 重要 */}
          <QuadrantCell
            {...QUADRANTS[0]}
            nodes={stats.byQuadrant[QUADRANTS[0].key]}
            rowLabel="↑ 重要 ↑"
          />
          <QuadrantCell
            {...QUADRANTS[1]}
            nodes={stats.byQuadrant[QUADRANTS[1].key]}
          />
          {/* Row 2: 不重要 */}
          <QuadrantCell
            {...QUADRANTS[2]}
            nodes={stats.byQuadrant[QUADRANTS[2].key]}
            rowLabel="↓ 不重要 ↓"
          />
          <QuadrantCell
            {...QUADRANTS[3]}
            nodes={stats.byQuadrant[QUADRANTS[3].key]}
          />
        </div>
      </div>

      {/* Weekly report for this person */}
      {stats.personWeeklies.length > 0 && (
        <div className="bg-white border border-notion-border rounded-md p-5 mb-6">
          <h3 className="font-medium mb-3">本周周报</h3>
          {stats.personWeeklies.map((w) => (
            <Link
              key={w.id}
              href={`/weeklies/${w.id}`}
              className="block p-3 border border-notion-border rounded hover:bg-notion-hover mb-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{w.summary || "无总结"}</span>
                <span className="text-xs text-notion-blue">查看详情 →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* All nodes list (补充：该人所有节点一览) */}
      <div className="bg-white border border-notion-border rounded-md overflow-hidden">
        <div className="px-4 py-3 bg-notion-gray border-b border-notion-border flex items-center justify-between">
          <span className="font-medium">全部节点 ({stats.total})</span>
          <span className="text-xs text-gray-400">按到期日排序</span>
        </div>
        {stats.personNodes.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">暂无节点</div>
        ) : (
          <div className="divide-y divide-notion-border max-h-80 overflow-y-auto">
            {[...stats.personNodes]
              .sort((a, b) => (a.end || "9999").localeCompare(b.end || "9999"))
              .map((node) => (
                <Link
                  key={node.id}
                  href={`/nodes/${node.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-notion-hover text-sm"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${STATUS_COLORS[node.status] || ""}`}>
                      {node.status}
                    </span>
                    <span className="font-medium truncate">{node.name || "（未命名）"}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${
                      node.priority === "重要紧急" ? "bg-red-50 text-red-700 border-red-200" :
                      node.priority === "重要不紧急" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      node.priority === "紧急不重要" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                      {node.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0 ml-4">
                    {isOverdue(node) && <span className="text-red-600 flex items-center gap-0.5"><AlertTriangle size={12} />逾期</span>}
                    {isBlocked(node) && <span className="text-orange-600">阻塞</span>}
                    <span>{node.end || "无截止"}</span>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white border border-notion-border rounded-md p-3 text-center">
      <div className={`text-xl font-bold ${color || "text-notion-fg"}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function QuadrantCell({
  key: qKey,
  color,
  dot,
  label,
  sub,
  nodes,
  rowLabel,
}: {
  key: string;
  color: string;
  dot: string;
  label: string;
  sub: string;
  nodes: ProjectNode[];
  rowLabel?: string;
}) {
  return (
    <div className={`border border-notion-border ${color} p-3 min-h-[140px] relative`}>
      {rowLabel && (
        <div className="absolute -left-7 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 whitespace-nowrap" style={{ writingMode: "vertical-lr" }}>
          {rowLabel}
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${dot}`} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-gray-500">({nodes.length})</span>
      </div>
      <div className="text-[10px] text-gray-400 mb-2">{sub}</div>
      {nodes.length === 0 ? (
        <div className="text-xs text-gray-400 italic">空</div>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {nodes.map((n) => (
            <Link
              key={n.id}
              href={`/nodes/${n.id}`}
              className="block text-xs px-2 py-1 bg-white/80 rounded border border-gray-100 hover:bg-white truncate"
              title={n.name}
            >
              {n.name || "（未命名）"}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
