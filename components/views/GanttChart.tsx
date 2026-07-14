"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectNode } from "@/lib/types";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

const DAY_WIDTH = 44;
const ROW_HEIGHT = 46;
const HEADER_HEIGHT = 44;
const BAR_HEIGHT = 22;
const SIDEBAR_WIDTH = 200;
const WINDOW_DAYS = 21; // 今天前 10 天 + 今天 + 后 10 天

import { beijingNow, parseLocal } from "@/lib/date";

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

function formatMonthDay(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekdayLabel(d: Date): string {
  return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
}

export default function GanttChart({ nodes }: { nodes: ProjectNode[] }) {
  const router = useRouter();
  const today = useMemo(() => beijingNow(), []);
  const [offsetDays, setOffsetDays] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);

  const {
    activeRows,
    completedInWindow,
    startDate,
    totalDays,
    endDate,
  } = useMemo(() => {
    const center = addDays(today, offsetDays);
    const start = addDays(center, -Math.floor(WINDOW_DAYS / 2));
    const end = addDays(center, Math.floor(WINDOW_DAYS / 2));
    const totalDays = daysBetween(start, end) + 1;

    // 判断节点日期范围是否与当前窗口有交集
    function overlapsWindow(node: ProjectNode): boolean {
      if (!node.start) return true; // 未排期始终显示
      const nodeStart = parseLocal(node.start)!;
      const nodeEnd = node.end ? parseLocal(node.end)! : nodeStart;
      return nodeEnd >= start && nodeStart <= end;
    }

    const active = nodes.filter((n) => n.status !== "已完成");
    const completed = nodes.filter((n) => n.status === "已完成");

    // 活跃节点：有日期 + 与窗口有交集，未排期始终保留
    const activeDated = active.filter((n) => n.start && overlapsWindow(n));
    const activeUndated = active.filter((n) => !n.start);
    const activeRows = [...activeDated, ...activeUndated];

    // 已完成节点：仅在窗口内有交集的
    const completedInWindow = completed.filter((n) => overlapsWindow(n));

    return { activeRows, completedInWindow, startDate: start, endDate: end, totalDays };
  }, [nodes, today, offsetDays]);

  const completedHiddenCount = completedInWindow.length;
  const allRows = showCompleted
    ? [...activeRows, ...completedInWindow]
    : activeRows;
  const width = totalDays * DAY_WIDTH;
  const height = HEADER_HEIGHT + allRows.length * ROW_HEIGHT + 12;

  function shiftWeek(days: number) {
    setOffsetDays((o) => o + days);
  }

  function resetToday() {
    setOffsetDays(0);
  }

  return (
    <div className="space-y-3">
      {/* 控制栏 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded border border-notion-border">
            以 {formatMonthDay(today)} 为中心 × {WINDOW_DAYS} 天；展示 {allRows.length} 个任务
            {completedHiddenCount > 0 && !showCompleted && (
              <span className="text-gray-400 ml-1">（{completedHiddenCount} 个已完成已隐藏）</span>
            )}
          </span>
          {/* 显示已完成开关 */}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={showCompleted}
              onClick={() => setShowCompleted((v) => !v)}
              className={`relative w-8 h-4.5 rounded-full transition-colors ${
                showCompleted ? "bg-notion-blue" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                  showCompleted ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            显示已完成
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftWeek(-7)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-notion-border rounded hover:bg-notion-hover"
          >
            <ChevronLeft size={14} /> 前一周
          </button>
          <button
            onClick={resetToday}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-notion-border rounded hover:bg-notion-hover"
            title="回到今天"
          >
            <RotateCcw size={14} /> 今天
          </button>
          <button
            onClick={() => shiftWeek(7)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-notion-border rounded hover:bg-notion-hover"
          >
            后一周 <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 空状态 */}
      {allRows.length === 0 ? (
        <div className="border border-notion-border rounded-md bg-white py-16 text-center text-gray-400">
          <p className="text-sm">当前时间窗口内无活跃任务</p>
          <p className="text-xs mt-1">试试切换到其他时间段，或打开「显示已完成」查看历史任务</p>
        </div>
      ) : (
      <div className="border border-notion-border rounded-md overflow-hidden bg-white flex">
        {/* Left sidebar */}
        <div className="shrink-0 border-r border-notion-border bg-notion-gray" style={{ width: SIDEBAR_WIDTH }}>
          <div className="h-11 border-b border-notion-border flex items-center px-3 text-xs font-medium text-gray-500">
            任务
          </div>
          {allRows.map((node) => (
            <div
              key={node.id}
              className="h-[46px] border-b border-notion-border px-3 flex flex-col justify-center cursor-pointer hover:bg-notion-hover"
              onClick={() => router.push(`/nodes/${node.id}`)}
            >
              <div className="text-xs truncate font-medium">{node.name || "（未命名）"}</div>
              <div className="text-[10px] text-gray-500 truncate">
                {node.start ? `${node.start} ~ ${node.end || node.start}` : "未排期"}
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="overflow-x-auto flex-1">
          <svg width={width} height={height}>
            {/* Day grid + header */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = addDays(startDate, i);
              const x = i * DAY_WIDTH;
              const isToday = isSameDay(d, today);
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={0}
                    width={DAY_WIDTH}
                    height={height}
                    fill={isToday ? "#fef2f2" : i % 2 === 0 ? "#fafafa" : "#ffffff"}
                  />
                  <line
                    x1={x}
                    y1={HEADER_HEIGHT}
                    x2={x}
                    y2={HEADER_HEIGHT + allRows.length * ROW_HEIGHT}
                    stroke={isToday ? "#fca5a5" : "#f0f0f0"}
                    strokeWidth={isToday ? 2 : 1}
                  />
                  <text x={x + 6} y={20} className="text-[10px] fill-gray-500 font-medium">
                    {getWeekdayLabel(d)}
                  </text>
                  <text x={x + 6} y={36} className="text-[10px] fill-gray-400">
                    {formatMonthDay(d)}
                  </text>
                </g>
              );
            })}

            {/* Today line */}
            {(() => {
              const todayOffset = daysBetween(startDate, today);
              if (todayOffset < 0 || todayOffset >= totalDays) return null;
              const x = todayOffset * DAY_WIDTH + DAY_WIDTH / 2;
              return (
                <line
                  x1={x}
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={HEADER_HEIGHT + allRows.length * ROW_HEIGHT}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              );
            })()}

            {/* Bars */}
            {allRows.map((node, i) => {
              const y = HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
              if (!node.start) {
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => router.push(`/nodes/${node.id}`)}
                  >
                    <rect x={8} y={y} width={120} height={BAR_HEIGHT} rx={4} fill="#f3f4f6" stroke="#e5e7eb" />
                    <text x={14} y={y + 15} className="text-[10px] fill-gray-500 pointer-events-none">
                      未排期
                    </text>
                  </g>
                );
              }
              const start = parseLocal(node.start)!;
              const end = (node.end ? parseLocal(node.end) : null) ?? start;
              const x = daysBetween(startDate, start) * DAY_WIDTH;
              const w = Math.max((daysBetween(start, end) + 1) * DAY_WIDTH, DAY_WIDTH * 0.5);
              // 限制在当前窗口内的可见范围
              const visibleX = Math.max(0, x);
              const visibleW = Math.min(width, x + w) - visibleX;
              if (visibleW <= 0) return null;
              return (
                <g
                  key={node.id}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => router.push(`/nodes/${node.id}`)}
                >
                  <rect
                    x={visibleX}
                    y={y}
                    width={visibleW}
                    height={BAR_HEIGHT}
                    rx={4}
                    fill={STATUS_FILL[node.status] ?? "#f3f4f6"}
                    stroke="#e5e7eb"
                  />
                  {visibleW > 60 && (
                    <text x={visibleX + 6} y={y + 15} className="text-[10px] fill-gray-700 pointer-events-none">
                      {node.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      )}
    </div>
  );
}

const STATUS_FILL: Record<string, string> = {
  "未开始": "#e5e7eb",
  "进行中": "#bfdbfe",
  "已完成": "#bbf7d0",
  "阻塞": "#fecaca",
};
