import { NextResponse } from "next/server";

async function tryFetch(url: string) {
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(String(res.status));
  return res;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cid: string }> },
) {
  const { cid } = await params;
  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];

  for (const url of gateways) {
    try {
      const r = await tryFetch(url);
      const contentType = r.headers.get("content-type") || "application/json";
      const body = await r.text();
      return new NextResponse(body, {
        status: 200,
        headers: { "content-type": contentType },
      });
    } catch {}
  }

  return NextResponse.json({ error: "IPFS fetch failed" }, { status: 502 });
}
