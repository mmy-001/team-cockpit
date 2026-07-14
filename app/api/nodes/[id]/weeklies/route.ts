import { NextResponse } from "next/server";
import * as store from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const weeklies = await store.getWeekliesForNode(params.id);
    return NextResponse.json({ weeklies, source: "local" });
  } catch (err: any) {
    console.error("GET /api/nodes/[id]/weeklies", err);
    return NextResponse.json({ error: err.message ?? "获取关联周报失败" }, { status: 500 });
  }
}



