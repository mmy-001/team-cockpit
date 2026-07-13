"use client";

import { ArrowLeft } from "lucide-react";

export default function BackButton({
  fallback = "/",
  children = "返回",
}: {
  fallback?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href="javascript:history.back()"
      onClick={(e) => {
        // 如果 history.back() 无效（比如没有历史记录），则fallback
        if (window.history.length <= 1) {
          e.preventDefault();
          window.location.href = fallback;
        }
        // 否则让 href="javascript:history.back()" 原生执行，不经过 React router
      }}
      className="inline-flex items-center text-sm text-gray-500 hover:text-notion-fg mb-6 cursor-pointer"
    >
      <ArrowLeft size={16} className="mr-1" />
      {children}
    </a>
  );
}
