import { NextResponse } from "next/server";
import * as store from "@/lib/storage";
import { createProjectNode } from "@/lib/notion";

export async function GET() {
  try {
    const nodes = await store.getAllNodes();
    return NextResponse.json({ nodes, source: "local" });
  } catch (err: any) {
    console.error("GET /api/nodes", err);
    return NextResponse.json({ error: err.message ?? "获取节点列表失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const node = await store.createNode(body);
    createProjectNode(body).catch((err) => console.warn("POST /api/nodes Notion sync failed", err.message));
    return NextResponse.json({ id: node.id, node }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/nodes", err);
    return NextResponse.json({ error: err.message ?? "Failed to create node" }, { status: 500 });
  }
}



