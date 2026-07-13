import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "未找到文件" }, { status: 400 });
    }

    if (!existsSync(UPLOAD_DIR)) {
      await import("fs/promises").then((m) => m.mkdir(UPLOAD_DIR, { recursive: true }));
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || ".bin";
    const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_");
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${base}_${unique}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ success: true, url, name: file.name });
  } catch (err: any) {
    console.error("POST /api/upload", err);
    return NextResponse.json({ error: err.message ?? "上传失败" }, { status: 500 });
  }
}
