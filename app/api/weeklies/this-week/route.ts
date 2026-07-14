import { NextResponse } from "next/server";
import * as store from "@/lib/storage";
import { getThisWeekMonday } from "@/lib/date";

export async function GET() {
  try {
    const monday = getThisWeekMonday();
    const weeklies = await store.getWeekliesForWeek(monday);
    return NextResponse.json({ weeklies, monday, source: "local" });
  } catch (err: any) {
    console.error("GET /api/weeklies/this-week", err);
    return NextResponse.json({ error: err.message ?? "获取本周周报失败" }, { status: 500 });
  }
}



