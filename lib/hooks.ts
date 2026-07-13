"use client";

import useSWR from "swr";
import type { ProjectNode, WeeklyReport, Member } from "./types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * 全量节点列表 —— 高频使用的核心数据。所有视图共享同一 SWR key，确保数据一致。
 * 默认 SWR 行为：挂载时若缓存 stale 则后台重新验证；窗口聚焦时自动刷新。
 */
export function useNodes() {
  const { data, error, isLoading, mutate } = useSWR<{ nodes: ProjectNode[]; source?: string }>(
    "/api/nodes",
    fetcher
  );
  return {
    nodes: data?.nodes ?? [],
    source: data?.source,
    error,
    isLoading,
    mutate,
  };
}

/**
 * 成员列表。
 */
export function useMembers() {
  const { data, error, isLoading, mutate } = useSWR<{ members: Member[] }>(
    "/api/members",
    fetcher
  );
  return {
    members: data?.members ?? [],
    error,
    isLoading,
    mutate,
  };
}

/**
 * 单个节点详情。
 */
export function useNode(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ node: ProjectNode }>(
    id ? `/api/nodes/${id}` : null,
    fetcher
  );
  return { node: data?.node, error, isLoading, mutate };
}

/**
 * 某节点关联的周报列表。
 */
export function useNodeWeeklies(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{ weeklies: WeeklyReport[] }>(
    id ? `/api/nodes/${id}/weeklies` : null,
    fetcher
  );
  return { weeklies: data?.weeklies ?? [], error, isLoading, mutate };
}

/**
 * 本周周报 —— 较短 dedup 窗口，因为新建/编辑周报后需要及时反映。
 */
export function useThisWeekWeeklies() {
  const { data, error, isLoading, mutate } = useSWR<{ weeklies: WeeklyReport[]; monday: string; source?: string }>(
    "/api/weeklies/this-week",
    fetcher
  );
  return { weeklies: data?.weeklies ?? [], monday: data?.monday, source: data?.source, error, isLoading, mutate };
}

/**
 * 全量周报 —— 用于周报汇总页的多周导航。所有视图共享同一 SWR key。
 */
export function useWeeklies() {
  const { data, error, isLoading, mutate } = useSWR<{ weeklies: WeeklyReport[]; source?: string }>(
    "/api/weeklies",
    fetcher
  );
  return { weeklies: data?.weeklies ?? [], source: data?.source, error, isLoading, mutate };
}
