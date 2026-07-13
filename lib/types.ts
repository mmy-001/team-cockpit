export type ProjectNode = {
  id: string;
  name: string;
  status: string;
  owner: string;
  start?: string;
  end?: string;
  priority: string;
  dependsOn: string[];
  parents: string[];
  deliverable: string;
  url: string;
};

export type WeeklyReport = {
  id: string;
  title: string;
  author: string;
  week: string;
  relatedNodes: string[];
  summary: string;
  url: string;
};

export type Member = {
  id: string;
  name: string;
  archived?: boolean;
};

export const STATUSES = ["未开始", "进行中", "已完成", "阻塞"] as const;

export const PRIORITIES = ["重要紧急", "重要不紧急", "紧急不重要", "不紧急不重要"] as const;

export const STATUS_COLORS: Record<string, string> = {
  "未开始": "bg-gray-100 text-gray-700 border-gray-200",
  "进行中": "bg-blue-50 text-blue-700 border-blue-200",
  "已完成": "bg-green-50 text-green-700 border-green-200",
  "阻塞": "bg-red-50 text-red-700 border-red-200",
};

// Priority badge 完整配色（背景 + 文字 + 边框），用于标签/分布卡片
export const PRIORITY_COLORS: Record<string, string> = {
  "重要紧急": "bg-red-50 text-red-700 border-red-200",
  "重要不紧急": "bg-blue-50 text-blue-700 border-blue-200",
  "紧急不重要": "bg-amber-50 text-amber-700 border-amber-200",
  "不紧急不重要": "bg-gray-100 text-gray-600 border-gray-200",
};
