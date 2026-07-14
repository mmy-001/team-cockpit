import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".webm", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "未找到文件" }, { status: 400 });
    }

    // 文件大小限制
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件过大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024} MB` }, { status: 400 });
    }

    // 白名单校验扩展名，防止上传可执行文件
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `不支持的文件类型: ${ext}` }, { status: 400 });
    }

    if (!existsSync(UPLOAD_DIR)) {
      await import("fs/promises").then((m) => m.mkdir(UPLOAD_DIR, { recursive: true }));
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 仅取文件名部分（去除路径），防止路径遍历攻击
    const safeName = path.basename(file.name);
    const base = safeName.replace(ext, "").replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_").slice(0, 80);
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${base}_${unique}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // 二次确认：最终路径必须在 UPLOAD_DIR 内
    if (!path.resolve(filepath).startsWith(path.resolve(UPLOAD_DIR))) {
      return NextResponse.json({ error: "非法文件路径" }, { status: 400 });
    }

    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ success: true, url, name: file.name });
  } catch (err: any) {
    console.error("POST /api/upload", err);
    return NextResponse.json({ error: err.message ?? "上传失败" }, { status: 500 });
  }
}
