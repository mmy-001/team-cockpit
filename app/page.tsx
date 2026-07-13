"use client";

import { useState, useEffect, useMemo } from "react";
import { useNodes, useWeeklies, useMembers } from "@/lib/hooks";
import NodeList from "@/components/views/NodeList";
import KanbanBoard from "@/components/views/KanbanBoard";
import GanttChart from "@/components/views/GanttChart";
import WeeklySummary from "@/components/views/WeeklySummary";
import Dashboard from "@/components/views/Dashboard";
import { getThisWeekMonday } from "@/lib/date";
import { List, Kanban, GanttChartSquare, CalendarDays, RefreshCw, LayoutDashboard } from "lucide-react";

const TABS = [
  { id: "overview", label: "项目总览", icon: LayoutDashboard },
  { id: "list", label: "节点列表", icon: List },
  { id: "kanban", label: "任务看板", icon: Kanban },
  { id: "gantt", label: "甘特图", icon: GanttChartSquare },
  { id: "weekly", label: "周报汇总", icon: CalendarDays },
];

export default function Home() {
  const { nodes, isLoading, error, mutate } = useNodes();
  const { weeklies: allWeeklies, isLoading: weeklyLoading, mutate: mutateWeekly } = useWeeklies();
  const { members, mutate: mutateMembers } = useMembers();

  // 从全量周报中提取本周周报，用于项目总览和节点列表
  const thisWeekMonday = useMemo(() => getThisWeekMonday(), []);
  const thisWeekWeeklies = useMemo(
    () => allWeeklies.filter((w) => w.week === thisWeekMonday),
    [allWeeklies, thisWeekMonday]
  );

  // 从 URL hash 或 sessionStorage 恢复上次活跃的 Tab
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "overview";
    const hash = window.location.hash.replace("#", "");
    if (TABS.some((t) => t.id === hash)) return hash;
    const saved = sessionStorage.getItem("lastActiveTab");
    if (saved && TABS.some((t) => t.id === saved)) return saved;
    return "overview";
  });

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (TABS.some((t) => t.id === hash) && hash !== activeTab) {
      setActiveTab(hash);
    }
    const onHashChange = () => {
      const id = window.location.hash.replace("#", "");
      if (TABS.some((t) => t.id === id)) setActiveTab(id);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function setTab(id: string) {
    setActiveTab(id);
    if (typeof window !== "undefined") {
      window.location.hash = id;
      sessionStorage.setItem("lastActiveTab", id);
    }
  }

  async function refresh() {
    await mutate();
    await mutateWeekly();
    await mutateMembers();
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-notion-fg">团队驾驶舱</h1>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-notion-border rounded hover:bg-notion-hover"
        >
          <RefreshCw size={14} />
          刷新
        </button>
      </div>

      <div className="flex border-b border-notion-border mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-notion-fg text-notion-fg"
                  : "border-transparent text-gray-500 hover:text-notion-fg"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {(isLoading || weeklyLoading) && activeTab !== "weekly" && activeTab !== "overview" && (
        <div className="text-sm text-gray-400 py-8">加载中...</div>
      )}
      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-4">{error.message}</div>}

      {activeTab === "overview" && <Dashboard nodes={nodes} weeklies={thisWeekWeeklies} members={members} />}
      {activeTab === "list" && <NodeList nodes={nodes} weeklies={allWeeklies} members={members} onRefresh={refresh} />}
      {activeTab === "kanban" && <KanbanBoard nodes={nodes} weeklies={allWeeklies} onUpdate={refresh} />}
      {activeTab === "gantt" && <GanttChart nodes={nodes} />}
      {activeTab === "weekly" && <WeeklySummary weeklies={allWeeklies} />}
    </main>
  );
}
