"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 全局返回按钮。
 * 当前所有子页面（/weeklies/*, /nodes/*, /persons/*）的上级路由都是首页 /。
 * 使用 router.push 确定性跳转，不依赖浏览器历史，确保每次点击都丝滑返回。
 */
export default function BackButton({
  children = "返回",
}: {
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/")}
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-notion-fg mb-6 transition-colors"
      type="button"
    >
      <ArrowLeft size={16} />
      {children}
    </button>
  );
}
