"use client";

import { SWRConfig } from "swr";

/**
 * 全局 SWR 配置。
 *
 * 本项目数据全部来自本地 JSON 文件（仅通过用户主动操作变更），不存在外部数据源变更，
 * 因此关闭所有自动重新验证，仅依赖 mutate() 手动触发刷新，避免不必要的网络/文件 I/O。
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 30000,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
