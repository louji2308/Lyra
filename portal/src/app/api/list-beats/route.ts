import { listBeats } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const beats = await listBeats();
    return Response.json({ beats });
  } catch {
    return Response.json({ beats: [] });
  }
}
