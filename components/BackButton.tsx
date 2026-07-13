"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({
  fallback = "/",
  children = "返回",
}: {
  fallback?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        // 优先使用浏览器历史返回，保留用户之前的 Tab 和滚动位置
        // 仅在无历史记录时（如直接打开该页）才使用 fallback
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="inline-flex items-center text-sm text-gray-500 hover:text-notion-fg mb-6"
    >
      <ArrowLeft size={16} className="mr-1" />
      {children}
    </button>
  );
}
