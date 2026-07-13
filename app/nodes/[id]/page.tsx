"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useNode, useNodes } from "@/lib/hooks";
import BackButton from "@/components/BackButton";
import { PRIORITY_COLORS, STATUS_COLORS, STATUSES, PRIORITIES } from "@/lib/types";
import { Trash2, Plus } from "lucide-react";

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { node, isLoading, mutate } = useNode(id);
  const { nodes: allNodes } = useNodes();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-gray-400">加载中...</div>;
  if (!node) return <div className="p-8 text-red-600">节点不存在或加载失败</div>;

  const {
    id: nodeId,
    name,
    status,
    priority,
    owner,
    start,
    end,
    deliverable,
    dependsOn,
    parents,
  } = node;

  const upstream = allNodes.filter((n) => dependsOn.includes(n.id));
  const downstream = allNodes.filter((n) => n.dependsOn.includes(nodeId));
  const children = allNodes.filter((n) => n.parents.includes(nodeId));
  const parentNodes = allNodes.filter((n) => parents.includes(n.id));
  const candidates = allNodes.filter((n) => n.id !== nodeId);

  async function updateField(field: string, value: any) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      await mutate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addRelation(type: "dependsOn" | "parents", targetId: string) {
    const current = type === "dependsOn" ? dependsOn : parents;
    if (current.includes(targetId)) return;
    await updateField(type, [...current, targetId]);
  }

  async function removeRelation(type: "dependsOn" | "parents", targetId: string) {
    const current = type === "dependsOn" ? dependsOn : parents;
    await updateField(type, current.filter((x) => x !== targetId));
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <BackButton />

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">{error}</div>}

      <div className="mb-4 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded border border-notion-border">
        直接修改下方字段，失焦后自动保存。所有数据存储在本地 JSON 文件中（data/nodes.json），读写毫秒级响应，无需等待外部 API。
      </div>

      <div className="bg-white border border-notion-border rounded-md p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <input
            defaultValue={name}
            onBlur={(e) => updateField("name", e.target.value)}
            className="text-2xl font-bold w-full border-none focus:outline-none focus:ring-0 p-0"
            placeholder="节点名称"
          />
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-gray-400">保存中...</span>}
            <button
              onClick={async () => {
                if (!confirm("确定删除该节点？关联周报不会自动删除。")) return;
                setDeleting(true);
                try {
                  const res = await fetch(`/api/nodes/${id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("删除失败");
                  router.back();
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deleting ? "删除中..." : "删除"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <label className="block text-gray-500 mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full border border-notion-border rounded px-2 py-1.5 bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-1">优先级</label>
            <select
              value={priority}
              onChange={(e) => updateField("priority", e.target.value)}
              className="w-full border border-notion-border rounded px-2 py-1.5 bg-white"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-1">负责人</label>
            <input
              defaultValue={owner}
              onBlur={(e) => updateField("owner", e.target.value)}
              className="w-full border border-notion-border rounded px-2 py-1.5"
              placeholder="负责人姓名"
            />
          </div>
          <div>
            <label className="block text-gray-500 mb-1">起止时间</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={start ?? ""}
                onChange={(e) => updateField("start", e.target.value || null)}
                className="border border-notion-border rounded px-2 py-1.5 flex-1"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={end ?? ""}
                onChange={(e) => updateField("end", e.target.value || null)}
                className="border border-notion-border rounded px-2 py-1.5 flex-1"
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-gray-500 mb-1">交付物描述</label>
            <textarea
              defaultValue={deliverable}
              onBlur={(e) => updateField("deliverable", e.target.value)}
              rows={3}
              className="w-full border border-notion-border rounded px-2 py-1.5"
              placeholder="描述交付物内容"
            />
          </div>
        </div>
      </div>

      {/* Dependency visualization */}
      <div className="bg-white border border-notion-border rounded-md p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">依赖关系</h2>
        <div className="flex items-start gap-4 overflow-x-auto">
          <div className="min-w-[140px]">
            <div className="text-xs text-gray-500 mb-2">上游依赖</div>
            {upstream.length === 0 && <div className="text-sm text-gray-400">无</div>}
            {upstream.map((n) => (
              <Link key={n.id} href={`/nodes/${n.id}`} className="block text-sm px-3 py-2 bg-gray-50 rounded border border-notion-border mb-2 hover:bg-notion-hover">
                {n.name}
              </Link>
            ))}
          </div>
          <div className="pt-6 text-gray-400">→</div>
          <div className="min-w-[140px]">
            <div className="text-xs text-gray-500 mb-2">当前节点</div>
            <div className={`text-sm px-3 py-2 rounded border mb-2 ${STATUS_COLORS[status]}`}>{name}</div>
          </div>
          <div className="pt-6 text-gray-400">→</div>
          <div className="min-w-[140px]">
            <div className="text-xs text-gray-500 mb-2">下游被依赖</div>
            {downstream.length === 0 && <div className="text-sm text-gray-400">无</div>}
            {downstream.map((n) => (
              <Link key={n.id} href={`/nodes/${n.id}`} className="block text-sm px-3 py-2 bg-gray-50 rounded border border-notion-border mb-2 hover:bg-notion-hover">
                {n.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <RelationEditor
            label="依赖于"
            relationIds={dependsOn}
            candidates={candidates}
            onAdd={(tid) => addRelation("dependsOn", tid)}
            onRemove={(tid) => removeRelation("dependsOn", tid)}
          />
          <RelationEditor
            label="父节点"
            relationIds={parents}
            candidates={candidates}
            onAdd={(tid) => addRelation("parents", tid)}
            onRemove={(tid) => removeRelation("parents", tid)}
          />
        </div>
      </div>

    </main>
  );
}

function RelationEditor({
  label,
  relationIds,
  candidates,
  onAdd,
  onRemove,
}: {
  label: string;
  relationIds: string[];
  candidates: { id: string; name: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const relations = candidates.filter((c) => relationIds.includes(c.id));

  return (
    <div>
      <label className="block text-gray-500 mb-2">{label}</label>
      <div className="flex items-center gap-2 mb-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 border border-notion-border rounded px-2 py-1.5 text-sm"
        >
          <option value="">选择节点...</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "（未命名）"}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (!selected) return;
            onAdd(selected);
            setSelected("");
          }}
          className="p-1.5 border border-notion-border rounded hover:bg-notion-hover"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-2">
        {relations.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded border border-notion-border text-sm">
            <span>{r.name || "（未命名）"}</span>
            <button onClick={() => onRemove(r.id)} className="text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {relations.length === 0 && <div className="text-xs text-gray-400">未设置</div>}
      </div>
    </div>
  );
}
