"use client";

import { useState, useRef } from "react";
import type { EditorBlock, BlockType } from "@/lib/blocks";
import { createBlock, toNotionBlocks } from "@/lib/blocks";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Image as ImageIcon,
  Video,
  Trash2,
  Plus,
  UploadCloud,
} from "lucide-react";

const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ElementType }[] = [
  { type: "paragraph", label: "段落", icon: Type },
  { type: "heading_1", label: "标题 1", icon: Heading1 },
  { type: "heading_2", label: "标题 2", icon: Heading2 },
  { type: "heading_3", label: "标题 3", icon: Heading3 },
  { type: "bulleted_list_item", label: "无序列表", icon: List },
  { type: "numbered_list_item", label: "有序列表", icon: ListOrdered },
  { type: "quote", label: "引用", icon: Quote },
  { type: "divider", label: "分隔线", icon: Minus },
];

export default function BlockEditor({
  initialBlocks = [createBlock("paragraph")],
  onChange,
  readOnly = false,
}: {
  initialBlocks?: EditorBlock[];
  onChange?: (blocks: EditorBlock[]) => void;
  readOnly?: boolean;
}) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(initialBlocks);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function updateBlock(id: string, patch: Partial<EditorBlock>) {
    const next = blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
    setBlocks(next);
    onChange?.(next);
  }

  function addBlock(type: BlockType = "paragraph", index?: number) {
    const block = createBlock(type);
    const idx = index ?? blocks.length;
    const next = [...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)];
    setBlocks(next);
    onChange?.(next);
  }

  function removeBlock(id: string) {
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    onChange?.(next);
  }

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
          return { url: data.url as string, type: isVideo ? ("video" as const) : ("image" as const) };
        })
      );
      const next = [...blocks, ...results.map(({ url, type }) => ({ id: cryptoRandomId(), type, content: "", url }))];
      setBlocks(next);
      onChange?.(next);
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

  function exportBlocks() {
    return toNotionBlocks(blocks);
  }

  return (
    <div
      className={`border rounded-md bg-white transition-colors ${dragOver ? "border-notion-blue bg-blue-50 ring-2 ring-blue-100" : "border-notion-border"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-notion-border bg-notion-gray">
          {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => addBlock(type)}
              title={label}
              className="p-1.5 rounded hover:bg-notion-hover text-gray-600"
            >
              <Icon size={16} />
            </button>
          ))}
          <div className="w-px h-5 bg-notion-border mx-1" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="插入图片"
            className="p-1.5 rounded hover:bg-notion-hover text-gray-600 disabled:opacity-50"
          >
            <ImageIcon size={16} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="插入视频"
            className="p-1.5 rounded hover:bg-notion-hover text-gray-600 disabled:opacity-50"
          >
            <Video size={16} />
          </button>
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
          {uploading && <span className="ml-2 text-xs text-gray-500">上传中...</span>}
        </div>
      )}

      <div className="p-4 space-y-2 min-h-[200px] relative">
        {dragOver && (
          <div className="absolute inset-0 z-10 bg-blue-50/90 border-2 border-dashed border-notion-blue rounded flex flex-col items-center justify-center text-notion-blue">
            <UploadCloud size={32} className="mb-2" />
            <span className="text-sm font-medium">松开即可上传图片或视频</span>
          </div>
        )}
        {blocks.map((block, idx) => (
          <BlockRow
            key={block.id}
            block={block}
            readOnly={readOnly}
            onChange={(patch) => updateBlock(block.id, patch)}
            onRemove={() => removeBlock(block.id)}
            onAddBelow={() => addBlock("paragraph", idx)}
          />
        ))}
        {!readOnly && blocks.length === 0 && (
          <div className="text-sm text-gray-400 py-4 text-center">
            点击上方按钮添加内容，或直接把图片/视频拖进来
          </div>
        )}
      </div>
    </div>
  );
}

function BlockRow({
  block,
  readOnly,
  onChange,
  onRemove,
  onAddBelow,
}: {
  block: EditorBlock;
  readOnly: boolean;
  onChange: (patch: Partial<EditorBlock>) => void;
  onRemove: () => void;
  onAddBelow: () => void;
}) {
  if (block.type === "divider") {
    return (
      <div className="flex items-center gap-2 group">
        <hr className="flex-1 border-notion-border" />
        {!readOnly && (
          <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="group relative inline-block">
        {block.url ? (
          <img src={block.url} alt="" className="max-h-64 rounded border border-notion-border" />
        ) : (
          <div className="h-24 w-48 bg-gray-100 border border-dashed border-notion-border rounded flex items-center justify-center text-sm text-gray-400">
            图片
          </div>
        )}
        {!readOnly && (
          <button onClick={onRemove} className="absolute -top-2 -right-2 p-1 bg-white border border-notion-border rounded shadow opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <div className="group relative">
        {block.url ? (
          <video src={block.url} controls className="max-h-64 rounded border border-notion-border" />
        ) : (
          <div className="h-24 w-48 bg-gray-100 border border-dashed border-notion-border rounded flex items-center justify-center text-sm text-gray-400">
            视频
          </div>
        )}
        {!readOnly && (
          <button onClick={onRemove} className="absolute -top-2 -right-2 p-1 bg-white border border-notion-border rounded shadow opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  const Tag = block.type === "quote" ? "blockquote" : "div";
  const className =
    {
      paragraph: "text-sm py-1",
      heading_1: "text-xl font-bold py-2",
      heading_2: "text-lg font-bold py-1.5",
      heading_3: "text-base font-bold py-1",
      bulleted_list_item: "text-sm pl-4 relative before:content-['•'] before:absolute before:left-0",
      numbered_list_item: "text-sm pl-6 relative",
      quote: "text-sm border-l-4 border-gray-300 pl-3 italic text-gray-600 py-1",
    }[block.type] ?? "text-sm py-1";

  const placeholder: Record<string, string> = {
    heading_1: "输入大标题，例如：本周核心进展",
    heading_2: "输入小标题，例如：项目 A 进度",
    heading_3: "输入子标题",
    quote: "引用或重点提示，例如：下周是关键节点...",
  };
  const placeholderText =
    placeholder[block.type] ?? (block.type.includes("list") ? "列表项内容" : "输入内容，例如：完成了用户调研报告初稿");

  const rows = Math.max(1, block.content.split("\n").length);

  return (
    <div className="group flex items-start gap-2">
      {block.type === "numbered_list_item" && <span className="text-sm select-none">•</span>}
      <Tag className={`flex-1 ${className}`}>
        <textarea
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          readOnly={readOnly}
          placeholder={placeholderText}
          rows={rows}
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 p-0 resize-none overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              // 普通 Enter 在当前块内换行；Shift+Enter 也是换行
              // 不阻止默认行为，textarea 会自动插入换行
            }
          }}
        />
      </Tag>
      {!readOnly && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={onAddBelow} title="下方添加段落" className="text-gray-400 hover:text-notion-fg">
            <Plus size={14} />
          </button>
          <button onClick={onRemove} title="删除" className="text-gray-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export { toNotionBlocks };
