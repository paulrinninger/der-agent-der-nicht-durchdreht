import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_PASSWORD, GATE_TOKEN } from "../_lib/gate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const pw = String(form?.get("password") ?? "");
  const url = req.nextUrl.clone();
  url.search = "";

  if (pw.trim().toLowerCase() === GATE_PASSWORD.toLowerCase()) {
    url.pathname = "/";
    const res = NextResponse.redirect(url, 303);
    res.cookies.set(GATE_COOKIE, GATE_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      // am Protokoll festmachen, nicht an NODE_ENV: `next start` ist auch
      // lokal "production", aber http — ein Secure-Cookie ginge dort verloren
      secure: req.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });
    return res;
  }

  url.pathname = "/gate";
  url.search = "?falsch=1";
  return NextResponse.redirect(url, 303);
}
