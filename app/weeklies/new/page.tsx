"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import FreeEditor from "@/components/editor/FreeEditor";
import { textToBlocks, toNotionBlocks, sectionsToText, TEMPLATE_TEXT } from "@/lib/blocks";
import { getThisWeekMonday } from "@/lib/date";
import { useMembers } from "@/lib/hooks";
import { Lightbulb, Sparkles, Loader2 } from "lucide-react";

type Attachment = { id: string; url: string; type: "image" | "video" };

export default function NewWeeklyPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">加载中...</div>}>
      <NewWeeklyPage />
    </Suspense>
  );
}

function NewWeeklyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { members } = useMembers();

  function goBack() {
    router.push("/");
  }

  const [author, setAuthor] = useState(searchParams.get("author") || "");
  const [week, setWeek] = useState(searchParams.get("week") || getThisWeekMonday());
  const [summary, setSummary] = useState("");
  const [bodyText, setBodyText] = useState(TEMPLATE_TEXT);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  // AI 面板默认展开，可通过 ?aiOpen=false 关闭
  const [showAiPanel, setShowAiPanel] = useState(
    searchParams.get("aiOpen") !== "false"
  );

  const title = `${author || "未署名"} - ${week}`;

  /** AI 结构化：调用后端 API，将返回的 summary + sections 同时填入输入框和 textarea */
  async function handleAiStructure() {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: aiInput, author, week }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `AI 请求失败 (${res.status})`);
      }

      // 验证返回结果
      if (!data.summary && !data.sections) {
        throw new Error("AI 返回数据不完整，请重试");
      }

      // 用 sectionsToText 将 sections 转为四段式纯文本
      const result = sectionsToText(data.summary ?? "", data.sections ?? {});

      // 同时填充一句话总结和正文
      setSummary(result.summary);
      setBodyText(result.text);
      setShowAiPanel(false);
      setError(null); // 清除之前的错误
    } catch (err: any) {
      setError(err.message ?? "AI 结构化失败，请重试");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!author.trim()) {
      setError("请填写作者");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 正文 textarea 纯文本 → blocks → Notion blocks
      const blocks = textToBlocks(bodyText);

      // 追加附件 blocks（图片/视频）
      for (const att of attachments) {
        if (att.type === "image") {
          blocks.push({ id: att.id, type: "image", content: "", url: att.url });
        } else {
          blocks.push({ id: att.id, type: "video", content: "", url: att.url });
        }
      }

      const res = await fetch("/api/weeklies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          week,
          relatedNodes: [],
          summary,
          blocks: toNotionBlocks(blocks),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      goBack();
    } catch (err: any) {
      setError(err.message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <BackButton />

      <h1 className="text-2xl font-bold mb-2">写本周周报</h1>
      <p className="text-sm text-gray-500 mb-6">
        自由编写正文，完成后点击右上角「一键排版」按模板格式自动整理；也可使用 AI 辅助快速生成。
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* 模板说明 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6 text-sm text-yellow-800">
        <div className="flex items-start gap-2">
          <Lightbulb size={18} className="mt-0.5 shrink-0" />
          <div>
            <strong>周报模板（四段式）：</strong>
            <ol className="list-decimal list-inside mt-1 space-y-0.5">
              <li><strong>已完成</strong> — 将已完成工作进行信息同步，附注数据并分析波动</li>
              <li><strong>进行中</strong> — 描述进行中的工作以及计划完成时间</li>
              <li><strong>问题同步</strong> — 同步本周遇到的风险/阻塞并讨论推进方案</li>
              <li><strong>下周计划</strong> — 描述具体的下一步任务</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-white border border-notion-border rounded-md p-6 mb-6 space-y-5">
        {/* 作者 & 周次 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-500 text-sm mb-1">作者</label>
            <select
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full border border-notion-border rounded px-3 py-2 bg-white"
            >
              <option value="">-- 选择作者 --</option>
              {members
                .filter((m) => !m.archived)
                .map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              {members.some((m) => m.archived) && (
                <>
                  <option disabled>── 已归档 ──</option>
                  {members.filter((m) => m.archived).map((m) => (
                    <option key={m.id} value={m.name}>{m.name} (已归档)</option>
                  ))}
                </>
              )}
              <option value="__custom__">其他（手动输入）</option>
            </select>
            {author === "__custom__" && (
              <input
                value=""
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full border border-notion-border rounded px-3 py-2 mt-1"
                placeholder="输入作者姓名"
                autoFocus
              />
            )}
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">周次（周一）</label>
            <input
              type="date"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="w-full border border-notion-border rounded px-3 py-2"
            />
          </div>
        </div>

        {/* 一句话总结 */}
        <div>
          <label className="block text-gray-500 text-sm mb-1">一句话总结</label>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
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
                placeholder="例如：这周做完了首页改版，上线后点击率提升了15%。同时在推进用户中心的方案设计，预计下周三出初稿。遇到的问题是后端接口还没好，已经和开发确认延期到下周二。下周计划是完成用户中心评审，启动搜索功能调研。"
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

        {/* 正文 — 自由编辑器 */}
        <div>
          <label className="block text-gray-500 text-sm mb-1">正文</label>
          <FreeEditor
            value={bodyText}
            onChange={setBodyText}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            loading={aiLoading || saving}
            placeholder="在此自由编写周报正文，完成后点击右上角「一键排版」即可自动格式化为四段式模板。"
          />
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={goBack}
          className="px-4 py-2 border border-notion-border rounded hover:bg-notion-hover"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-notion-fg text-white rounded hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              保存中...
            </>
          ) : (
            "保存"
          )}
        </button>
      </div>
    </main>
  );
}
