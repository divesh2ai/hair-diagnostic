import type { NextResponse } from "next/server";

export function privateAuthResponse(response: NextResponse, from?: NextResponse) {
  from?.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
