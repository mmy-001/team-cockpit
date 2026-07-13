"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import FreeEditor from "@/components/editor/FreeEditor";
import {
  fromNotionBlocks,
  toNotionBlocks,
  blocksToText,
  textToBlocks,
  type EditorBlock,
} from "@/lib/blocks";
import type { WeeklyReport } from "@/lib/types";
import { Save, Trash2 } from "lucide-react";

type Attachment = { id: string; url: string; type: "image" | "video" };

export default function WeeklyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/weeklies/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setWeekly(data.weekly);

        // 将 Notion blocks 转为 EditorBlock，再分离文本块和附件
        const editorBlocks = fromNotionBlocks(data.blocks ?? []);
        const textBlocks: EditorBlock[] = [];
        const atts: Attachment[] = [];
        for (const block of editorBlocks) {
          if (block.type === "image" || block.type === "video") {
            atts.push({ id: block.id, url: block.url ?? "", type: block.type });
          } else {
            textBlocks.push(block);
          }
        }
        setAttachments(atts);
        setBodyText(blocksToText(textBlocks));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    if (!weekly) return;
    if (!weekly.author.trim()) {
      setError("请填写作者");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 正文 textarea 纯文本 → blocks
      const blocks = textToBlocks(bodyText);

      // 追加附件
      for (const att of attachments) {
        if (att.type === "image") {
          blocks.push({ id: att.id, type: "image", content: "", url: att.url });
        } else {
          blocks.push({ id: att.id, type: "video", content: "", url: att.url });
        }
      }

      const res = await fetch(`/api/weeklies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${weekly.author} - ${weekly.week}`,
          author: weekly.author,
          week: weekly.week,
          relatedNodes: [],
          summary: weekly.summary,
          blocks: toNotionBlocks(blocks),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">加载中...</div>;
  if (error && !weekly) return <div className="p-8 text-red-600">{error}</div>;
  if (!weekly) return <div className="p-8 text-gray-400">周报不存在</div>;

  const title = `${weekly.author || "未署名"} - ${weekly.week}`;

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <BackButton />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">编辑周报</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">已保存</span>}
          <button
            onClick={async () => {
              if (!confirm("确定删除该周报？")) return;
              setDeleting(true);
              try {
                const res = await fetch(`/api/weeklies/${id}`, { method: "DELETE" });
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-notion-fg text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">{error}</div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-6 text-sm text-blue-800">
        <strong>编辑提示：</strong>正文支持自由编写，右上角「一键排版」可随时重新格式化。完成后点击右上角「保存」即可。
      </div>

      <div className="bg-white border border-notion-border rounded-md p-6 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-500 text-sm mb-1">作者</label>
            <input
              value={weekly.author}
              onChange={(e) => setWeekly({ ...weekly, author: e.target.value })}
              className="w-full border border-notion-border rounded px-3 py-2"
              placeholder="你的名字"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">周次（周一）</label>
            <input
              type="date"
              value={weekly.week}
              onChange={(e) => setWeekly({ ...weekly, week: e.target.value })}
              className="w-full border border-notion-border rounded px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-500 text-sm mb-1">一句话总结</label>
          <input
            value={weekly.summary}
            onChange={(e) => setWeekly({ ...weekly, summary: e.target.value })}
            className="w-full border border-notion-border rounded px-3 py-2"
            placeholder="例如：本周完成用户调研并输出报告，下周进入方案设计阶段"
          />
          <div className="text-xs text-gray-400 mt-1">这句话会显示在项目面板中，建议包含关键进展与下一步计划</div>
        </div>

        <div>
          <label className="block text-gray-500 text-sm mb-1">正文</label>
          <FreeEditor
            value={bodyText}
            onChange={setBodyText}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <BackButton fallback="/" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-notion-fg text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </main>
  );
}
