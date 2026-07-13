import { NextResponse } from "next/server";
import * as store from "@/lib/storage";
import { updateWeeklyReport, replaceWeeklyReportBlocks, archiveWeeklyReport } from "@/lib/notion";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const weekly = await store.getWeekly(params.id);
  if (!weekly) {
    return NextResponse.json({ error: "Weekly not found" }, { status: 404 });
  }
  const blocks = await store.getWeeklyBlocks(params.id);
  return NextResponse.json({ weekly, blocks, source: "local" });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await store.updateWeekly(params.id, {
      title: body.title,
      author: body.author,
      week: body.week,
      relatedNodes: body.relatedNodes,
      summary: body.summary,
    });
    if (body.blocks) {
      await store.setWeeklyBlocks(params.id, body.blocks);
    }
    updateWeeklyReport(params.id, {
      title: body.title,
      author: body.author,
      week: body.week,
      relatedNodes: body.relatedNodes,
      summary: body.summary,
    }).catch((err) => console.warn("PATCH /api/weeklies/[id] Notion sync failed", err.message));
    if (body.blocks) {
      replaceWeeklyReportBlocks(params.id, body.blocks).catch((err) =>
        console.warn("PATCH /api/weeklies/[id] Notion blocks sync failed", err.message)
      );
    }
    return NextResponse.json({ success: true, weekly: updated, source: "local" });
  } catch (err: any) {
    console.error("PATCH /api/weeklies/[id]", err);
    return NextResponse.json({ error: err.message ?? "Failed to update weekly" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await store.deleteWeekly(params.id);
    // 同步归档 Notion 中的周报
    archiveWeeklyReport(params.id).catch((err) =>
      console.warn("DELETE /api/weeklies/[id] Notion archive failed", err.message)
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/weeklies/[id]", err);
    return NextResponse.json({ error: err.message ?? "Failed to delete weekly" }, { status: 500 });
  }
}




