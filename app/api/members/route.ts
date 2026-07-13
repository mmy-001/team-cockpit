import { NextResponse } from "next/server";
import * as store from "@/lib/storage";

export async function GET() {
  const members = await store.getAllMembers();
  return NextResponse.json({ members });
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "成员姓名不能为空" }, { status: 400 });
    }
    const member = await store.createMember(name.trim());
    return NextResponse.json({ member }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "创建成员失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, archived } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "缺少成员 ID" }, { status: 400 });
    }
    const member = await store.updateMember(id, { archived: !!archived });
    return NextResponse.json({ member });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新成员失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "缺少成员 ID" }, { status: 400 });
    }
    await store.deleteMember(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "删除成员失败" }, { status: 500 });
  }
}
