"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { weeklyProgressText, progressPercentage, isOverdue } from "@/lib/analytics";
import type { ProjectNode, WeeklyReport } from "@/lib/types";
import { STATUSES, STATUS_COLORS, PRIORITY_COLORS } from "@/lib/types";
import { Plus } from "lucide-react";

export default function KanbanBoard({
  nodes,
  weeklies,
  onUpdate,
}: {
  nodes: ProjectNode[];
  weeklies: WeeklyReport[];
  onUpdate: () => void;
}) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const columns = useMemo(() => {
    return STATUSES.map((status) => ({
      status,
      items: nodes.filter((n) => n.status === status),
    }));
  }, [nodes]);

  async function handleDrop(status: string) {
    if (!draggingId || status === nodes.find((n) => n.id === draggingId)?.status) {
      setDraggingId(null);
      setOverStatus(null);
      return;
    }

    const originalNode = nodes.find((n) => n.id === draggingId);
    if (!originalNode) return;

    // Optimistic update is tricky here because parent owns nodes array.
    // Instead we let SWR revalidate after success.
    try {
      setError(null);
      const res = await fetch(`/api/nodes/${draggingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新失败");
      onUpdate();
    } catch (err: any) {
      setError(err.message ?? "拖拽更新失败");
    } finally {
      setDraggingId(null);
      setOverStatus(null);
    }
  }

  async function createNode() {
    setCreating(true);
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "新节点",
          status: "未开始",
          priority: "重要不紧急",
          owner: "",
          start: "",
          end: "",
          deliverable: "",
          dependsOn: [],
          parents: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      router.push(`/nodes/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded border border-notion-border flex-1 mr-3">
          拖拽卡片即可变更状态；卡片下方进度条与最新周报摘要来自关联周报。点击卡片进入节点详情。
        </div>
        <button
          onClick={createNode}
          disabled={creating}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-notion-fg text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          <Plus size={16} />
          {creating ? "创建中..." : "新建节点"}
        </button>
      </div>
      {error && <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">{error}</div>}
      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => (
          <div
            key={col.status}
            className={`bg-notion-gray rounded-md border border-notion-border flex flex-col min-h-[200px] ${
              overStatus === col.status ? "ring-2 ring-blue-300" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStatus(col.status);
            }}
            onDragLeave={() => setOverStatus(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(col.status);
            }}
          >
            <div className="px-3 py-2 text-sm font-medium border-b border-notion-border flex justify-between items-center">
              <span>{col.status}</span>
              <span className="text-xs text-gray-400">{col.items.length}</span>
            </div>
            <div className="p-2 flex-1 space-y-2">
              {col.items.map((node) => {
                const pct = progressPercentage(node);
                const snippet = weeklyProgressText(node, weeklies);
                const overdue = isOverdue(node);
                return (
                  <div
                    key={node.id}
                    draggable
                    onDragStart={() => setDraggingId(node.id)}
                    className={`bg-white border border-notion-border rounded p-3 shadow-sm cursor-move hover:shadow ${
                      draggingId === node.id ? "opacity-50" : ""
                    }`}
                  >
                    <Link href={`/nodes/${node.id}`} className="block font-medium text-sm mb-2 hover:underline">
                      {node.name || "（未命名）"}
                    </Link>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-500">{node.owner || "-"}</span>
                      <span className={PRIORITY_COLORS[node.priority] ?? "text-gray-400"}>{node.priority || "-"}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${
                          node.status === "已完成" ? "bg-green-500" : node.status === "进行中" ? "bg-blue-400" : "bg-gray-300"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {(node.start || node.end) && (
                      <div className={`text-xs ${overdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
                        {node.start ?? "?"} ~ {node.end ?? "?"}
                        {overdue && " · 已逾期"}
                      </div>
                    )}
                    {snippet && (
                      <div className="mt-2 text-xs text-gray-600 line-clamp-2 border-t border-notion-border pt-2">
                        {snippet}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
