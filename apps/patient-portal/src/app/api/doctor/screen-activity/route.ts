import { NextResponse, type NextRequest } from "next/server";
import { getAuthClaims } from "@/lib/auth";
import { DOCTOR_SCREEN_COOKIE, DOCTOR_SESSION_SECONDS, GOOGLE_SESSION_COOKIE } from "@/lib/auth/doctorSessionPolicy";
import { doctorScreenCookie } from "@/lib/auth/googleSessionBinding";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const binding = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  const claims = await getAuthClaims();
  if (!binding || claims?.user_role !== "DOCTOR") return new NextResponse(null, { status: 403 });
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(DOCTOR_SCREEN_COOKIE, doctorScreenCookie(binding), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DOCTOR_SESSION_SECONDS,
  });
  return response;
}
