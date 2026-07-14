import { NextResponse } from "next/server";
import * as store from "@/lib/storage";
import { updateProjectNode, archiveProjectNode } from "@/lib/notion";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const node = await store.getNode(params.id);
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    return NextResponse.json({ node, source: "local" });
  } catch (err: any) {
    console.error("GET /api/nodes/[id]", err);
    return NextResponse.json({ error: err.message ?? "获取节点失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await store.updateNode(params.id, body);
    updateProjectNode(params.id, body).catch((err) =>
      console.warn("PATCH /api/nodes/[id] Notion sync failed", err.message)
    );
    return NextResponse.json({ success: true, node: updated, source: "local" });
  } catch (err: any) {
    console.error("PATCH /api/nodes/[id]", err);
    return NextResponse.json({ error: err.message ?? "Failed to update node" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await store.deleteNode(params.id);
    // 同步归档 Notion 中的对应 page
    archiveProjectNode(params.id).catch((err) =>
      console.warn("DELETE /api/nodes/[id] Notion archive failed", err.message)
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/nodes/[id]", err);
    return NextResponse.json({ error: err.message ?? "Failed to delete node" }, { status: 500 });
  }
}




