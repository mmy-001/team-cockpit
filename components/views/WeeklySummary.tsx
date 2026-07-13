"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WeeklyReport } from "@/lib/types";
import { Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekMonday, getThisWeekMonday, prevWeekMonday, nextWeekMonday, weekSunday } from "@/lib/date";

export default function WeeklySummary({
  weeklies,
}: {
  weeklies: WeeklyReport[];
}) {
  const [currentMonday, setCurrentMonday] = useState(() => getThisWeekMonday());

  const grouped = useMemo(() => {
    const map = new Map<string, WeeklyReport[]>();
    weeklies.forEach((w) => {
      // 仅显示当前周的周报
      if (w.week !== currentMonday) return;
      const list = map.get(w.author) ?? [];
      list.push(w);
      map.set(w.author, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [weeklies, currentMonday]);

  const thisWeekMonday = getThisWeekMonday();
  const isThisWeek = currentMonday === thisWeekMonday;
  const canGoNext = currentMonday < thisWeekMonday;

  const goPrevWeek = () => setCurrentMonday((m) => prevWeekMonday(m));
  const goNextWeek = () => setCurrentMonday((m) => nextWeekMonday(m));
  const goThisWeek = () => setCurrentMonday(thisWeekMonday);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded border border-notion-border flex-1 mr-3">
          按成员分组查看周报。如需写周报，请在「节点列表」中点击成员的「写周报」按钮。
        </div>
        <Link
          href="/weeklies/new"
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-notion-fg text-white rounded hover:bg-gray-700 whitespace-nowrap"
        >
          <Pencil size={16} />
          新建周报
        </Link>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-center gap-3 py-2">
        <button onClick={goPrevWeek} className="p-1 rounded hover:bg-notion-hover border border-notion-border" title="上一周">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          {currentMonday} ~ {weekSunday(currentMonday)}
          {isThisWeek && <span className="ml-2 text-xs text-notion-blue font-normal">本周</span>}
        </span>
        <button
          onClick={goNextWeek}
          disabled={!canGoNext}
          className="p-1 rounded hover:bg-notion-hover border border-notion-border disabled:opacity-30"
          title={canGoNext ? "下一周" : "已是本周"}
        >
          <ChevronRight size={18} />
        </button>
        {!isThisWeek && (
          <button onClick={goThisWeek} className="text-xs text-notion-blue hover:underline">
            回到本周
          </button>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm border border-dashed border-notion-border rounded-md">
          {isThisWeek ? "本周暂无周报" : `${currentMonday} 无周报记录`}
        </div>
      ) : (
        grouped.map(([author, reports]) => (
          <div key={author} className="bg-white border border-notion-border rounded-md overflow-hidden">
            <div className="px-4 py-3 bg-notion-gray border-b border-notion-border flex items-center justify-between">
              <span className="font-medium">{author || "未署名"}</span>
              <Link
                href={`/weeklies/new?author=${encodeURIComponent(author)}&week=${currentMonday}`}
                className="flex items-center gap-1 text-xs text-notion-blue hover:underline"
              >
                <Pencil size={12} />
                写周报
              </Link>
            </div>
            <div className="divide-y divide-notion-border">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/weeklies/${report.id}`}
                  className="block p-4 hover:bg-notion-hover"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm text-gray-500">{report.week}</span>
                        <span className="text-sm">{report.summary || "无总结"}</span>
                      </div>
                    </div>
                    <span className="text-xs text-notion-blue flex items-center gap-1 shrink-0">
                      <Pencil size={14} />
                      编辑
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
