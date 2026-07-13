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
    <button
      onClick={() => {
        if (typeof window !== "undefined") {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = fallback;
          }
        }
      }}
      className="inline-flex items-center text-sm text-gray-500 hover:text-notion-fg mb-6 cursor-pointer bg-transparent border-none p-0"
      type="button"
    >
      <ArrowLeft size={16} className="mr-1" />
      {children}
    </button>
  );
}
