import { NextResponse } from "next/server";
import { pinJson } from "@/lib/ipfs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cid } = await pinJson(body);
    return NextResponse.json({ cid });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "pin failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
