import { NextResponse } from "next/server";
import { pinJson } from "@/lib/ipfs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cid } = await pinJson(body);
    return NextResponse.json({ cid });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "pin failed" }, { status: 500 });
  }
}
