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
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-notion-fg mb-6 cursor-pointer"
      type="button"
    >
      <ArrowLeft size={16} />
      {children}
    </button>
  );
}
