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
import { Save, Trash2, Lightbulb, Sparkles, Loader2, Eye, X } from "lucide-react";
import { sectionsToText } from "@/lib/blocks";

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
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  async function handleAiStructure() {
    if (!weekly || !aiInput.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: aiInput, author: weekly.author, week: weekly.week }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `AI 请求失败 (${res.status})`);
      }
      if (!data.summary && !data.sections) {
        throw new Error("AI 返回数据不完整，请重试");
      }

      const result = sectionsToText(data.summary ?? "", data.sections ?? {});
      setWeekly({ ...weekly, summary: result.summary });
      setBodyText(result.text);
      setShowAiPanel(false);
    } catch (err: any) {
      setError(err.message ?? "AI 结构化失败，请重试");
    } finally {
      setAiLoading(false);
    }
  }

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
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 border border-notion-blue text-notion-blue rounded hover:bg-blue-50 transition-colors"
          >
            <Eye size={16} />
            查看
          </button>
          <button
            onClick={async () => {
              if (!confirm("确定删除该周报？")) return;
              setDeleting(true);
              try {
                const res = await fetch(`/api/weeklies/${id}`, { method: "DELETE" });
                if (!res.ok) throw new Error("删除失败");
                if (typeof window !== "undefined") {
                  if (window.history.length > 1) {
                    router.back();
                  } else {
                    router.push("/");
                  }
                }
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
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Sparkles size={11} className="text-notion-blue" />
            AI 结构化填充时会自动生成基于全部内容的总结，也可手动修改
          </div>
        </div>

        {/* AI 结构化面板 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-gray-500 text-sm">AI 辅助结构化（可选）</label>
            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className="flex items-center gap-1 text-xs text-notion-blue hover:underline"
            >
              <Sparkles size={13} />
              {showAiPanel ? "收起" : "展开 AI 面板"}
            </button>
          </div>
          {showAiPanel && (
            <div className="border border-notion-blue/30 rounded p-3 bg-blue-50/30 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                将本周工作内容粘贴到下方（支持口述转文字），AI 将自动识别内容归属，
                拆解为四段式周报，<strong>同时生成一句话总结和完整正文</strong>。
              </p>
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                className="w-full border border-notion-border rounded px-3 py-2 h-32 text-sm resize-y font-mono"
                placeholder="例如：这周做完了首页改版，上线后点击率提升了15%。同时在推进用户中心的方案设计..."
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {aiInput.length > 0 ? `已输入 ${aiInput.length} 字` : "输入越多，AI 生成越精准"}
                </span>
                <button
                  onClick={handleAiStructure}
                  disabled={aiLoading || !aiInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-notion-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      AI 分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      AI 结构化填充
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
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

      {/* 预览弹窗 */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-notion-fg">{weekly.author || "未署名"}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{weekly.week}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* 弹窗正文 */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              {/* 一句话总结 */}
              {weekly.summary?.trim() && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="text-xs text-blue-500 mb-1 font-medium">一句话总结</div>
                  <p className="text-sm text-gray-800 leading-relaxed">{weekly.summary}</p>
                </div>
              )}

              {/* 周报正文 */}
              <PreviewContent text={bodyText} />
            </div>

            {/* 弹窗底部 */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 border border-notion-border rounded-lg hover:bg-notion-hover text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

/** 预览正文：将纯文本解析为带格式的 HTML */
function PreviewContent({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-sm text-gray-400 italic">暂无正文</p>;
  }

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // 标题行：一、二、三、四、 开头
    if (/^[一二三四五六七八九十]、/.test(trimmed)) {
      // 标题后可能紧跟空行或内容
      const headingContent: React.ReactNode[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "" && !/^[一二三四五六七八九十]、/.test(lines[j].trim())) {
        const item = lines[j].trim();
        // 去除列表前缀
        const content = item.replace(/^[-*•]\s+/, "").replace(/^\d+[.、]\s*/, "");
        if (content) {
          headingContent.push(
            <li key={j} className="text-sm text-gray-700 leading-relaxed">
              {content}
            </li>
          );
        }
        j++;
      }

      elements.push(
        <div key={i} className="mb-4">
          <h3 className="text-base font-bold text-notion-fg mb-2">{trimmed}</h3>
          {headingContent.length > 0 && (
            <ul className="list-disc list-inside space-y-1 pl-1">{headingContent}</ul>
          )}
          {headingContent.length === 0 && (
            <p className="text-xs text-gray-400 italic">（待补充）</p>
          )}
        </div>
      );

      i = j;
      continue;
    }

    // 普通内容行（去除列表前缀）
    const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+[.、]\s*/, "").replace(/^>\s+/, "");
    if (content) {
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {content}
        </p>
      );
    }
    i++;
  }

  return <div className="text-sm">{elements.length > 0 ? elements : <p className="text-gray-400 italic">暂无正文</p>}</div>;
}
