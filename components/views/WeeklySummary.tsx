"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import type { WeeklyReport } from "@/lib/types";
import { Pencil, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { getWeekMonday, getThisWeekMonday, prevWeekMonday, nextWeekMonday, weekSunday } from "@/lib/date";
import { fromNotionBlocks, blocksToText } from "@/lib/blocks";

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

  const [preview, setPreview] = useState<{
    weekly: WeeklyReport;
    text: string;
    loading: boolean;
  } | null>(null);

  const openPreview = useCallback(async (report: WeeklyReport) => {
    setPreview({ weekly: report, text: "", loading: true });
    try {
      const res = await fetch(`/api/weeklies/${report.id}`);
      const data = await res.json();
      if (data.weekly && data.blocks) {
        const textBlocks = fromNotionBlocks(data.blocks).filter(
          (b) => b.type !== "image" && b.type !== "video"
        );
        const text = blocksToText(textBlocks);
        setPreview({ weekly: data.weekly, text, loading: false });
      } else {
        setPreview((prev) => (prev ? { ...prev, text: "暂无正文", loading: false } : null));
      }
    } catch {
      setPreview((prev) => (prev ? { ...prev, text: "加载失败", loading: false } : null));
    }
  }, []);

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
                <div
                  key={report.id}
                  className="flex items-start justify-between gap-4 p-4 hover:bg-notion-hover"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm text-gray-500">{report.week}</span>
                      <span className="text-sm">{report.summary || "无总结"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => openPreview(report)}
                      className="text-xs text-notion-blue flex items-center gap-1 hover:underline"
                    >
                      <Eye size={14} />
                      查看
                    </button>
                    <Link
                      href={`/weeklies/${report.id}`}
                      className="text-xs text-notion-blue flex items-center gap-1 hover:underline"
                    >
                      <Pencil size={14} />
                      编辑
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      {/* 预览弹窗 */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-notion-fg">{preview.weekly.author || "未署名"}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{preview.weekly.week}</p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* 弹窗正文 */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              {preview.loading ? (
                <div className="text-sm text-gray-400 text-center py-8">加载中…</div>
              ) : (
                <>
                  {/* 一句话总结 */}
                  {preview.weekly.summary?.trim() && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <div className="text-xs text-blue-500 mb-1 font-medium">一句话总结</div>
                      <p className="text-sm text-gray-800 leading-relaxed">{preview.weekly.summary}</p>
                    </div>
                  )}

                  {/* 正文 */}
                  <PreviewBody text={preview.text} />
                </>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setPreview(null)}
                className="px-6 py-2 border border-notion-border rounded-lg hover:bg-notion-hover text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 弹窗内正文渲染：按四段式结构化展示 */
function PreviewBody({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-sm text-gray-400 italic">暂无正文</p>;
  }

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") { i++; continue; }

    // 标题行：一、二、三、四、开头
    if (/^[一二三四五六七八九十]、/.test(trimmed)) {
      const items: React.ReactNode[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "" && !/^[一二三四五六七八九十]、/.test(lines[j].trim())) {
        const item = lines[j].trim().replace(/^[-*•]\s+/, "").replace(/^\d+[.、]\s*/, "");
        if (item) items.push(<li key={j} className="text-sm text-gray-700 leading-relaxed">{item}</li>);
        j++;
      }
      elements.push(
        <div key={i} className="mb-4">
          <h3 className="text-base font-bold text-notion-fg mb-2">{trimmed}</h3>
          {items.length > 0 ? <ul className="list-disc list-inside space-y-1 pl-1">{items}</ul> : <p className="text-xs text-gray-400 italic">（待补充）</p>}
        </div>
      );
      i = j;
      continue;
    }

    // 普通行
    const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+[.、]\s*/, "").replace(/^>\s+/, "");
    if (content) {
      elements.push(<p key={i} className="text-sm text-gray-700 leading-relaxed">{content}</p>);
    }
    i++;
  }

  return <div className="text-sm">{elements.length > 0 ? elements : <p className="text-gray-400 italic">暂无正文</p>}</div>;
}


