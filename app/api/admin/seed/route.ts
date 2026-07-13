import { NextResponse } from "next/server";
import { seedRedisForce } from "@/lib/storage";

export async function POST() {
  try {
    const result = await seedRedisForce();
    return NextResponse.json({
      success: true,
      message: "Redis 已从 JSON 文件重新导入",
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
