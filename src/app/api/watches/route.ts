import { NextRequest, NextResponse } from "next/server";

import { resolveUserEmail } from "@/lib/auth/user-context";
import { createWatch, listWatches, watchInputSchema } from "@/lib/services/watch-service";

export async function GET(request: NextRequest) {
  try {
    const email = await resolveUserEmail(request);
    const watches = await listWatches(email);
    return NextResponse.json({ watches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load watches";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = await resolveUserEmail(request);
    const payload = await request.json();
    const parsed = watchInputSchema.parse(payload);
    const watch = await createWatch(email, parsed);

    return NextResponse.json({ watch }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create watch";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
