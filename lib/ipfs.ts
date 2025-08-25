export type PinResult = { cid: string };

const PINATA_BASE = "https://api.pinata.cloud";

function getAuth() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT missing");
  return `Bearer ${jwt}`;
}

export async function pinJson(json: unknown): Promise<PinResult> {
  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      Authorization: getAuth(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pinataContent: json }),
  });
  if (!res.ok) throw new Error(`Pinata error: ${res.status}`);
  const data = await res.json();
  return { cid: data.IpfsHash };
}

export function ipfsCidUrl(cid: string) {
  return `/api/ipfs/${cid}`;
}
