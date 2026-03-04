import { NextRequest, NextResponse } from "next/server";

import { searchFlights, searchRequestSchema } from "@/lib/services/search-service";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = searchRequestSchema.parse(params);
    const response = await searchFlights(parsed);

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
