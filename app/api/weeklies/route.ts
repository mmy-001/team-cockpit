import { NextResponse } from "next/server";
import * as store from "@/lib/storage";
import { createWeeklyReport } from "@/lib/notion";

export async function GET() {
  try {
    const weeklies = await store.getAllWeeklies();
    return NextResponse.json({ weeklies, source: "local" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch weeklies" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const weekly = await store.createWeekly({
      title: body.title,
      author: body.author,
      week: body.week,
      relatedNodes: body.relatedNodes,
      summary: body.summary,
    });
    if (body.blocks?.length) {
      await store.setWeeklyBlocks(weekly.id, body.blocks);
    }
    // Try to sync to Notion without blocking response.
    createWeeklyReport(body).catch((err) =>
      console.warn("POST /api/weeklies Notion sync failed", err.message)
    );
    return NextResponse.json({ id: weekly.id, weekly }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/weeklies", err);
    return NextResponse.json({ error: err.message ?? "Failed to create weekly" }, { status: 500 });
  }
}

