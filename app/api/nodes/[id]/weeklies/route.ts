import { NextResponse } from "next/server";
import * as store from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const weeklies = await store.getWeekliesForNode(params.id);
  return NextResponse.json({ weeklies, source: "local" });
}



