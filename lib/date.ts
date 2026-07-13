/**
 * 获取当前北京时间（Asia/Shanghai，UTC+8）。
 * 统一使用该函数替代 new Date()，确保时区一致。
 */
export function beijingNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
}

/**
 * 将 Date 格式化为 YYYY-MM-DD（使用 Date 自身的本地字段）。
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 将 YYYY-MM-DD 字符串解析为本地时间 Date 对象（避免 UTC 偏移）。
 * 例如 "2026-07-06" → Date(2026, 6, 6) 本地时间 00:00。
 */
export function parseLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 获取指定日期所在周的周一（周一～周日为一周）。
 * 始终以北京时间计算，无论服务器运行在什么时区。
 */
export function getWeekMonday(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  const dt = d.getDate();
  const day = d.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const offset = day === 0 ? -6 : 1 - day; // 需要加多少天到周一
  const monday = new Date(y, m, dt + offset);
  return formatDate(monday);
}

/**
 * 获取北京时间的本周一日期。
 * 这是 getWeekMonday(beijingNow()) 的便捷封装。
 */
export function getThisWeekMonday(): string {
  return getWeekMonday(beijingNow());
}

/**
 * 在 YYYY-MM-DD 字符串上增减天数（始终基于本地时间计算，避免 UTC 偏差）。
 */
export function addDays(d: string, days: number): string {
  const date = parseLocal(d);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/** 获取下一周的周一日期 */
export function nextWeekMonday(monday: string): string {
  return addDays(monday, 7);
}

/** 获取上一周的周一日期 */
export function prevWeekMonday(monday: string): string {
  return addDays(monday, -7);
}

/** 获取周日的日期（周一 + 6 天） */
export function weekSunday(monday: string): string {
  return addDays(monday, 6);
}

/** 判断节点是否在指定周活跃（非已完成，且时间段与本周有交集） */
export function isNodeActiveInWeek(node: { start?: string; end?: string; status: string }, monday: string): boolean {
  if (node.status === "已完成" || node.status === "阻塞") return node.status === "阻塞"; // 阻塞也算活跃（需要关注）
  const sun = weekSunday(monday);
  const nodeStart = node.start || monday;
  const nodeEnd = node.end || sun;
  // 时间段有交集即算活跃：节点开始 <= 周日 && 节点结束 >= 周一
  return nodeStart <= sun && nodeEnd >= monday;
}
