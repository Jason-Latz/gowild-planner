import { NextRequest, NextResponse } from "next/server";

import { resolveUserEmail } from "@/lib/auth/user-context";
import { deleteWatch } from "@/lib/services/watch-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const email = await resolveUserEmail(request);
    const { id } = await params;
    await deleteWatch(email, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete watch";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
