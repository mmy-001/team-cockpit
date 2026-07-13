"use client";

import { useState, useRef, useCallback } from "react";
import { autoFormatText, TEMPLATE_TEXT } from "@/lib/blocks";
import { Sparkles, Wand2, Image as ImageIcon, Video, UploadCloud, X, Trash2 } from "lucide-react";

type Attachment = { id: string; url: string; type: "image" | "video" };

export default function FreeEditor({
  value,
  onChange,
  attachments = [],
  onAttachmentsChange,
  loading = false,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  loading?: boolean;
  placeholder?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 一键排版
  const handleAutoFormat = useCallback(() => {
    const formatted = autoFormatText(value);
    onChange(formatted);
  }, [value, onChange]);

  // 重置为模板
  const handleResetTemplate = useCallback(() => {
    if (!value.trim() || confirm("当前内容将被覆盖，确定加载模板？")) {
      onChange(TEMPLATE_TEXT);
    }
  }, [value, onChange]);

  // 文件上传
  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fileArray = Array.from(files);
      const results = await Promise.all(
        fileArray.map(async (file) => {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `${file.name} 上传失败`);
          const isVideo = file.type.startsWith("video/");
          return {
            id: cryptoRandomId(),
            url: data.url as string,
            type: (isVideo ? "video" : "image") as "image" | "video",
          };
        })
      );
      onAttachmentsChange?.([...attachments, ...results]);
    } catch (err: any) {
      alert(err.message ?? "上传失败");
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    uploadFiles(e.dataTransfer.files);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = e.clipboardData.files;
    if (files.length > 0) {
      e.preventDefault();
      uploadFiles(files);
    }
  }

  function removeAttachment(id: string) {
    onAttachmentsChange?.(attachments.filter((a) => a.id !== id));
  }

  // 预览排版效果
  const previewLines = value.split("\n");

  return (
    <div className="space-y-3">
      {/* 正文编辑区 */}
      <div
        className={`relative border rounded-md bg-white transition-colors ${
          dragOver ? "border-notion-blue bg-blue-50 ring-2 ring-blue-100" : "border-notion-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-notion-border bg-notion-gray">
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetTemplate}
              title="加载模板"
              className="text-xs px-2 py-1 rounded hover:bg-notion-hover text-gray-500"
            >
              加载模板
            </button>
            <span className="text-xs text-gray-300">|</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="上传图片/视频"
              className="p-1 rounded hover:bg-notion-hover text-gray-600 disabled:opacity-50"
            >
              <UploadCloud size={14} />
            </button>
            {uploading && <span className="text-xs text-gray-400">上传中...</span>}
            <span className="text-xs text-gray-400">
              可直接拖拽/粘贴图片或视频
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs px-2 py-1 rounded hover:bg-notion-hover text-gray-500"
            >
              {showPreview ? "编辑" : "预览"}
            </button>
            <button
              onClick={handleAutoFormat}
              title="一键排版"
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-notion-blue text-white rounded hover:bg-blue-600 transition-colors"
            >
              <Wand2 size={13} />
              一键排版
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* 拖拽遮罩 */}
        {dragOver && (
          <div className="absolute inset-0 z-20 bg-blue-50/90 border-2 border-dashed border-notion-blue rounded flex flex-col items-center justify-center text-notion-blue">
            <UploadCloud size={32} className="mb-2" />
            <span className="text-sm font-medium">松开即可上传图片或视频</span>
          </div>
        )}

        {showPreview ? (
          /* 预览模式 */
          <div className="p-4 min-h-[300px] max-h-[600px] overflow-y-auto text-sm leading-relaxed space-y-1">
            {previewLines.map((line, i) => {
              const trimmed = line.trim();
              if (trimmed === "") return <div key={i} className="h-3" />;
              if (/^[一二三四五六七八九十]、/.test(trimmed)) {
                return <div key={i} className="text-xl font-bold pt-3 pb-1">{trimmed}</div>;
              }
              if (trimmed.startsWith("- ")) {
                return <div key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0">{trimmed.slice(2)}</div>;
              }
              if (/^\d+\.\s/.test(trimmed)) {
                return <div key={i} className="pl-4">{trimmed}</div>;
              }
              if (trimmed.startsWith("> ")) {
                return <div key={i} className="border-l-4 border-gray-300 pl-3 italic text-gray-600">{trimmed.slice(2)}</div>;
              }
              return <div key={i}>{trimmed}</div>;
            })}
          </div>
        ) : (
          /* 编辑模式 */
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "在此自由编写周报正文，完成后点击右上角「一键排版」即可自动格式化。\n\n模板格式：\n一、已完成\n- 具体条目…\n二、进行中\n- 具体条目…\n三、问题同步\n- 风险/阻塞…\n四、下周计划\n1. 具体任务…"}
            className="w-full p-4 min-h-[350px] bg-transparent border-none focus:outline-none focus:ring-0 text-sm leading-relaxed resize-y font-mono"
            rows={18}
          />
        )}
      </div>

      {/* 附件区域 */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.id} className="group relative border border-notion-border rounded overflow-hidden">
              {a.type === "image" ? (
                <img src={a.url} alt="" className="h-20 w-auto object-cover" />
              ) : (
                <video src={a.url} className="h-20 w-auto" />
              )}
              <button
                onClick={() => removeAttachment(a.id)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-white/80 rounded text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 格式提示 */}
      <div className="bg-gray-50 border border-notion-border rounded-md p-3 text-xs text-gray-500 space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={12} className="text-notion-blue" />
          <strong className="text-gray-600">格式说明</strong>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div><code className="bg-gray-100 px-1 rounded">一、已完成</code> — 节标题（Heading）</div>
          <div><code className="bg-gray-100 px-1 rounded">- 内容</code> — 无序列表</div>
          <div><code className="bg-gray-100 px-1 rounded">1. 内容</code> — 有序列表</div>
          <div><code className="bg-gray-100 px-1 rounded">&gt; 内容</code> — 引用块</div>
          <div><code className="bg-gray-100 px-1 rounded">---</code> — 分隔线</div>
          <div className="col-span-2">支持拖拽/粘贴图片或视频文件自动上传为附件</div>
        </div>
      </div>
    </div>
  );
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
