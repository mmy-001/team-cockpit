import { NextResponse } from "next/server";
import * as store from "@/lib/storage";
import { getThisWeekMonday } from "@/lib/date";

export async function GET() {
  const monday = getThisWeekMonday();
  const weeklies = await store.getWeekliesForWeek(monday);
  return NextResponse.json({ weeklies, monday, source: "local" });
}



