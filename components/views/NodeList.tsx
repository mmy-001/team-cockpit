"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, Plus, X, UserPlus, Pencil, Archive, Box, ArchiveRestore } from "lucide-react";
import { weeklyProgressText, isOverdue, isCompleted } from "@/lib/analytics";
import { getThisWeekMonday } from "@/lib/date";
import type { ProjectNode, WeeklyReport, Member } from "@/lib/types";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/types";


function NodeRow({
  node,
  weeklies,
}: {
  node: ProjectNode;
  weeklies: WeeklyReport[];
}) {
  const snippet = weeklyProgressText(node, weeklies);
  const overdue = isOverdue(node);

  return (
    <Link
      href={`/nodes/${node.id}`}
      className="flex items-center py-2 px-3 hover:bg-notion-hover border-b border-notion-border text-sm"
    >
      <span className="flex-1 font-medium truncate pl-6">{node.name || "（未命名）"}</span>
      <span className={`w-20 text-xs px-2 py-1 rounded border text-center ${STATUS_COLORS[node.status] ?? "bg-gray-50"}`}>
        {node.status || "未设置"}
      </span>
      <span className="w-24 truncate px-3 text-gray-600">{node.owner || "-"}</span>
      <span className={`w-40 text-xs ${overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
        {node.start ? `${node.start}${node.end ? ` ~ ${node.end}` : ""}` : "-"}
        {overdue && " · 逾期"}
      </span>
      <span className="w-32 text-xs text-gray-600 truncate px-2" title={snippet}>
        {snippet || "-"}
      </span>
      <span className={`w-10 text-xs font-medium text-right ${PRIORITY_COLORS[node.priority] ?? ""}`}>
        {node.priority || "-"}
      </span>
    </Link>
  );
}

export default function NodeList({
  nodes,
  weeklies,
  members,
  onRefresh,
}: {
  nodes: ProjectNode[];
  weeklies?: WeeklyReport[];
  members: Member[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const wl = weeklies ?? [];

  // 分离活跃/归档成员
  const activeMembers = useMemo(() => members.filter((m) => !m.archived), [members]);
  const archivedMembers = useMemo(() => members.filter((m) => m.archived), [members]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingNode, setCreatingNode] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showArchivedNodes, setShowArchivedNodes] = useState(false);
  const [archivedNodesExpanded, setArchivedNodesExpanded] = useState<Set<string>>(new Set());
  // 过往人员归档区
  const [showArchivedMembers, setShowArchivedMembers] = useState(false);
  const [archivedMembersExpanded, setArchivedMembersExpanded] = useState<Set<string>>(new Set());
  const [archivingMember, setArchivingMember] = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);

  // 初始化：把所有活跃成员设为展开
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized && activeMembers.length > 0) {
      setExpanded(new Set(activeMembers.map((m) => m.id)));
      setInitialized(true);
    }
  }, [activeMembers, initialized]);

  // 按 owner 分组节点
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectNode[]>();
    members.forEach((m) => map.set(m.name, []));
    nodes.forEach((n) => {
      const key = n.owner || "未分配";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return map;
  }, [nodes, members]);

  // 获取未分配节点（owner 为空或不在已知成员列表中）
  const unassignedNodes = useMemo(() => {
    const memberNames = new Set(members.map((m) => m.name));
    const direct = grouped.get("未分配") ?? [];
    // 还要找出 owner 有值但不在 members 中的节点
    const orphanNodes: ProjectNode[] = [];
    nodes.forEach((n) => {
      if (n.owner && !memberNames.has(n.owner)) {
        orphanNodes.push(n);
      }
    });
    return [...direct, ...orphanNodes];
  }, [nodes, members, grouped]);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const toggleArchivedNodes = (id: string) => {
    const next = new Set(archivedNodesExpanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setArchivedNodesExpanded(next);
  };

  const toggleArchivedMembers = (id: string) => {
    const next = new Set(archivedMembersExpanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setArchivedMembersExpanded(next);
  };

  async function createNode(owner: string, memberId: string) {
    setCreatingNode(memberId);
    setError(null);
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "新节点",
          status: "未开始",
          priority: "重要不紧急",
          owner,
          start: "",
          end: "",
          deliverable: "",
          dependsOn: [],
          parents: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      await onRefresh();
      if (typeof window !== "undefined") {
        sessionStorage.setItem("lastActiveTab", "list");
      }
      router.push(`/nodes/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingNode(null);
    }
  }

  async function handleAddMember() {
    const name = newMemberName.trim();
    if (!name) return;
    setAddingMember(true);
    setError(null);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "添加失败");
      setNewMemberName("");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingMember(false);
    }
  }

  /** 归档/取消归档成员 */
  async function toggleArchiveMember(memberId: string, currentArchived: boolean) {
    setArchivingMember(memberId);
    setError(null);
    try {
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId, archived: !currentArchived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "操作失败");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchivingMember(null);
    }
  }

  async function handleDeleteMember(id: string, name: string) {
    if (!confirm(
      `确定删除成员「${name}」？\n\n` +
      `这将同时删除该成员负责的所有节点和撰写的所有周报，此操作不可撤销。`
    )) return;
    setError(null);
    try {
      const res = await fetch("/api/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "删除失败");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const thisWeekMonday = getThisWeekMonday();

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">{error}</div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded border border-notion-border flex-1 min-w-[200px]">
          按成员分组查看节点。点击成员展开/折叠，点击人名进入个人四象限看板。人员离职后可归档。
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowArchivedNodes(!showArchivedNodes)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded whitespace-nowrap ${
              showArchivedNodes
                ? "bg-notion-fg text-white border-notion-fg"
                : "text-gray-600 border-notion-border hover:bg-notion-hover"
            }`}
            title="显示/隐藏已完成节点的归档区"
          >
            <Archive size={14} />
            节点归档
          </button>
          {archivedMembers.length > 0 && (
            <button
              onClick={() => setShowArchivedMembers(!showArchivedMembers)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded whitespace-nowrap ${
                showArchivedMembers
                  ? "bg-amber-600 text-white border-amber-600"
                  : "text-gray-600 border-notion-border hover:bg-notion-hover"
              }`}
              title={`查看已归档人员 (${archivedMembers.length})`}
            >
              <ArchiveRestore size={14} />
              过往人员 ({archivedMembers.length})
            </button>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddMember(); }}
              placeholder="新成员姓名..."
              className="w-32 px-2 py-1.5 text-sm border border-notion-border rounded"
            />
            <button
              onClick={handleAddMember}
              disabled={addingMember || !newMemberName.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-notion-fg text-white rounded hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
            >
              <UserPlus size={16} />
              {addingMember ? "添加中..." : "添加成员"}
            </button>
          </div>
        </div>
      </div>

      {/* 活跃成员列表 */}
      {activeMembers.map((member) => {
        const memberNodes = grouped.get(member.name) ?? [];
        const activeNodes = memberNodes.filter((n) => !isCompleted(n));
        const completedNodes = memberNodes.filter(isCompleted);
        const isExpanded = expanded.has(member.id);
        const isArchNodesOpen = archivedNodesExpanded.has(member.id);

        return (
          <MemberSection
            key={member.id}
            member={member}
            isExpanded={isExpanded}
            onToggle={() => toggle(member.id)}
            activeNodes={activeNodes}
            completedNodes={completedNodes}
            showArchivedNodes={showArchivedNodes}
            isArchNodesOpen={isArchNodesOpen}
            onToggleArchNodes={() => toggleArchivedNodes(member.id)}
            weeklies={wl}
            thisWeekMonday={thisWeekMonday}
            creatingNode={creatingNode === member.id}
            onCreateNode={() => createNode(member.name, member.id)}
            onArchive={() => toggleArchiveMember(member.id, false)}
            onDelete={() => handleDeleteMember(member.id, member.name)}
            archivingMember={archivingMember === member.id}
            isArchived={false}
          />
        );
      })}

      {/* 过往人员归档区 */}
      {showArchivedMembers && archivedMembers.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-notion-border" />
            <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
              <ArchiveRestore size={12} />
              过往人员 ({archivedMembers.length})
            </span>
            <div className="h-px flex-1 bg-notion-border" />
          </div>
          {archivedMembers.map((member) => {
            const memberNodes = grouped.get(member.name) ?? [];
            const activeNodes = memberNodes.filter((n) => !isCompleted(n));
            const completedNodes = memberNodes.filter(isCompleted);
            const isArchMembersExpanded = archivedMembersExpanded.has(member.id);
            const isArchNodesOpen = archivedNodesExpanded.has(`arch-${member.id}`);

            return (
              <MemberSection
                key={member.id}
                member={member}
                isExpanded={isArchMembersExpanded}
                onToggle={() => toggleArchivedMembers(member.id)}
                activeNodes={activeNodes}
                completedNodes={completedNodes}
                showArchivedNodes={showArchivedNodes}
                isArchNodesOpen={isArchNodesOpen}
                onToggleArchNodes={() => toggleArchivedNodes(`arch-${member.id}`)}
                weeklies={wl}
                thisWeekMonday={thisWeekMonday}
                creatingNode={creatingNode === member.id}
                onCreateNode={() => createNode(member.name, member.id)}
                onArchive={() => toggleArchiveMember(member.id, true)}
                onDelete={() => handleDeleteMember(member.id, member.name)}
                archivingMember={archivingMember === member.id}
                isArchived={true}
              />
            );
          })}
        </div>
      )}

      {/* 未分配节点：owner 为空或不属于任何成员的节点 */}
      {unassignedNodes.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowUnassigned(!showUnassigned)}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-red-50/50 border border-red-200 rounded-md text-sm text-red-700 hover:bg-red-100 transition-colors"
          >
            {showUnassigned ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="font-medium">未分配节点</span>
            <span className="text-xs text-red-500">({unassignedNodes.length})</span>
            <span className="text-xs text-red-400 ml-auto">
              这些节点没有对应的负责人，请联系管理员处理
            </span>
          </button>
          {showUnassigned && (
            <div className="overflow-x-auto border border-red-200 border-t-0 rounded-b-md">
              <div className="min-w-[640px]">
                <div className="flex items-center py-2 px-3 bg-red-50/30 text-xs font-medium text-red-600">
                  <span className="flex-1 pl-6">节点名称</span>
                  <span className="w-20 text-center">状态</span>
                  <span className="w-24 px-3">负责人</span>
                  <span className="w-40">起止时间</span>
                  <span className="w-32 px-2">最新周报进度</span>
                  <span className="w-10 text-right">优先级</span>
                </div>
                {unassignedNodes.map((node) => (
                  <NodeRow key={node.id} node={node} weeklies={wl} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {members.length === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm border border-dashed border-notion-border rounded-md">
          暂无成员，请先添加成员再管理节点。
        </div>
      )}
    </div>
  );
}

// ---- 独立的成员区块组件 ----
function MemberSection({
  member,
  isExpanded,
  onToggle,
  activeNodes,
  completedNodes,
  showArchivedNodes,
  isArchNodesOpen,
  onToggleArchNodes,
  weeklies,
  thisWeekMonday,
  creatingNode,
  onCreateNode,
  onArchive,
  onDelete,
  archivingMember,
  isArchived,
}: {
  member: Member;
  isExpanded: boolean;
  onToggle: () => void;
  activeNodes: ProjectNode[];
  completedNodes: ProjectNode[];
  showArchivedNodes: boolean;
  isArchNodesOpen: boolean;
  onToggleArchNodes: () => void;
  weeklies: WeeklyReport[];
  thisWeekMonday: string;
  creatingNode: boolean;
  onCreateNode: () => void;
  onArchive: () => void;
  onDelete: () => void;
  archivingMember: boolean;
  isArchived: boolean;
}) {
  const router = useRouter();

  return (
    <div className={`bg-white border rounded-md overflow-hidden ${
      isArchived ? "border-amber-200 bg-amber-50/30" : "border-notion-border"
    }`}>
      {/* Header */}
      <div className={`flex items-center px-4 py-3 border-b flex-wrap gap-2 ${
        isArchived ? "bg-amber-50/50 border-amber-200" : "bg-gray-50/80 border-notion-border"
      }`}>
        <button onClick={onToggle} className="p-1 mr-1 rounded hover:bg-gray-200">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <Link
          href={`/persons/${encodeURIComponent(member.name)}`}
          className="font-medium flex-1 hover:text-notion-blue hover:underline min-w-[80px]"
        >
          {member.name}
          {isArchived && (
            <span className="ml-2 text-xs text-amber-600 font-normal">已归档</span>
          )}
        </Link>
        <span className="text-xs text-gray-400 mr-2">
          {activeNodes.length} 活跃
          {completedNodes.length > 0 && ` · ${completedNodes.length} 已完成`}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push(`/weeklies/new?author=${encodeURIComponent(member.name)}&week=${thisWeekMonday}`)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-notion-blue border border-notion-blue/30 rounded hover:bg-blue-50"
          >
            <Pencil size={14} />
            写周报
          </button>
          <button
            onClick={onCreateNode}
            disabled={creatingNode}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-notion-fg text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            <Plus size={16} />
            {creatingNode ? "创建中..." : "新建节点"}
          </button>
          <button
            onClick={onArchive}
            disabled={archivingMember}
            className={`p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 ${
              isArchived ? "text-green-600" : "text-amber-600"
            }`}
            title={isArchived ? "恢复为活跃成员" : "归档此成员"}
          >
            {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-200"
            title={`删除成员 ${member.name}`}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 展开后的节点表格 */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="flex items-center py-2 px-3 bg-notion-gray border-b border-notion-border text-xs font-medium text-gray-500">
              <span className="flex-1 pl-6">节点名称</span>
              <span className="w-20 text-center">状态</span>
              <span className="w-24 px-3">负责人</span>
              <span className="w-40">起止时间</span>
              <span className="w-32 px-2">最新周报进度</span>
              <span className="w-10 text-right">优先级</span>
            </div>
            {activeNodes.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">暂无活跃节点，点击「新建节点」开始添加</div>
            ) : (
              activeNodes.map((node) => (
                <NodeRow key={node.id} node={node} weeklies={weeklies} />
              ))
            )}

            {/* 已完成节点归档区 */}
            {showArchivedNodes && completedNodes.length > 0 && (
              <div>
                <button
                  onClick={onToggleArchNodes}
                  className="flex items-center w-full px-4 py-2.5 bg-gray-50/50 border-t border-notion-border text-sm text-gray-500 hover:bg-gray-100"
                >
                  {isArchNodesOpen ? <ChevronDown size={14} className="mr-1.5" /> : <ChevronRight size={14} className="mr-1.5" />}
                  <Box size={14} className="mr-1.5 text-green-500" />
                  已完成节点
                  <span className="ml-2 text-xs text-gray-400">({completedNodes.length})</span>
                </button>
                {isArchNodesOpen && (
                  <div>
                    {completedNodes.map((node) => (
                      <NodeRow key={node.id} node={node} weeklies={weeklies} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
