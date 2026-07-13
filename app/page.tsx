"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNodes, useWeeklies, useMembers } from "@/lib/hooks";
import NodeList from "@/components/views/NodeList";
import KanbanBoard from "@/components/views/KanbanBoard";
import GanttChart from "@/components/views/GanttChart";
import WeeklySummary from "@/components/views/WeeklySummary";
import Dashboard from "@/components/views/Dashboard";
import { getThisWeekMonday } from "@/lib/date";
import Link from "next/link";
import { List, Kanban, GanttChartSquare, CalendarDays, RefreshCw, LayoutDashboard, Sparkles } from "lucide-react";

const TABS = [
  { id: "overview", label: "项目总览", icon: LayoutDashboard },
  { id: "list", label: "节点列表", icon: List },
  { id: "kanban", label: "任务看板", icon: Kanban },
  { id: "gantt", label: "甘特图", icon: GanttChartSquare },
  { id: "weekly", label: "周报汇总", icon: CalendarDays },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

function resolveInitialTab(): string {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace("#", "");
  if (TAB_IDS.has(hash)) return hash;
  const saved = sessionStorage.getItem("lastActiveTab");
  if (saved && TAB_IDS.has(saved)) return saved;
  return "overview";
}

export default function Home() {
  const { nodes, isLoading, error, mutate } = useNodes();
  const { weeklies: allWeeklies, isLoading: weeklyLoading, mutate: mutateWeekly } = useWeeklies();
  const { members, mutate: mutateMembers } = useMembers();

  const thisWeekMonday = useMemo(() => getThisWeekMonday(), []);
  const thisWeekWeeklies = useMemo(
    () => allWeeklies.filter((w) => w.week === thisWeekMonday),
    [allWeeklies, thisWeekMonday]
  );

  const [activeTab, setActiveTab] = useState(resolveInitialTab);

  // useRef 避免 hashchange handler 里的闭包过期问题
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // 监听浏览器 hash 变化（前进/后退），同步到 activeTab
  useEffect(() => {
    const syncFromHash = () => {
      const id = window.location.hash.replace("#", "");
      if (id && TAB_IDS.has(id) && id !== activeTabRef.current) {
        setActiveTab(id);
        sessionStorage.setItem("lastActiveTab", id);
      }
    };
    window.addEventListener("hashchange", syncFromHash);
    // 首次挂载时也执行一次，兜底 Next.js App Router 客户端导航回来后
    // hash 已存在但 useEffect 的 deps 没变的情况
    syncFromHash();
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const setTab = useCallback((id: string) => {
    if (id === activeTabRef.current) return;
    setActiveTab(id);
    sessionStorage.setItem("lastActiveTab", id);
    // 只在 hash 真的需要变时才改，避免触发不必要的 hashchange
    const currentHash = window.location.hash.replace("#", "");
    if (currentHash !== id) {
      window.location.hash = id;
    }
  }, []);

  const refresh = useCallback(async () => {
    // 并行刷新，不串行阻塞
    await Promise.all([mutate(), mutateWeekly(), mutateMembers()]);
  }, [mutate, mutateWeekly, mutateMembers]);

  const anyLoading = isLoading || weeklyLoading;
  // 初次加载时还没数据，所有 Tab 都显示 loading 而非空白
  const showLoading = anyLoading && nodes.length === 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-notion-fg">产品运营团队管理面板</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/weeklies/new?aiOpen=true"
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 shadow-sm hover:shadow transition-all"
          >
            <Sparkles size={15} />
            AI 快速写周报
          </Link>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-notion-border rounded hover:bg-notion-hover"
          >
            <RefreshCw size={14} className={anyLoading ? "animate-spin" : ""} />
            刷新
          </button>
        </div>
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

      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-4">{error.message}</div>}

      {showLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <RefreshCw size={14} className="animate-spin" />
          正在同步数据...
        </div>
      )}

      {/* 所有 Tab 面板始终挂载，仅用 CSS 控制显隐，避免每次切换时卸载/重挂载导致卡顿 */}
      <div style={{ display: !showLoading && activeTab === "overview" ? "block" : "none" }}>
        <Dashboard nodes={nodes} weeklies={thisWeekWeeklies} members={members} />
      </div>
      <div style={{ display: !showLoading && activeTab === "list" ? "block" : "none" }}>
        <NodeList nodes={nodes} weeklies={allWeeklies} members={members} onRefresh={refresh} />
      </div>
      <div style={{ display: !showLoading && activeTab === "kanban" ? "block" : "none" }}>
        <KanbanBoard nodes={nodes} weeklies={allWeeklies} onUpdate={refresh} />
      </div>
      <div style={{ display: !showLoading && activeTab === "gantt" ? "block" : "none" }}>
        <GanttChart nodes={nodes} />
      </div>
      <div style={{ display: !showLoading && activeTab === "weekly" ? "block" : "none" }}>
        <WeeklySummary weeklies={allWeeklies} />
      </div>
    </main>
  );
}
