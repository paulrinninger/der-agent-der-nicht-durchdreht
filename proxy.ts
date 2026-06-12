import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_TOKEN } from "@/app/api/_lib/gate";

/** Alles hinter dem Passwort-Gate — außer dem Gate selbst und Next-Assets. */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/gate" || pathname === "/api/gate") return NextResponse.next();
  if (req.cookies.get(GATE_COOKIE)?.value === GATE_TOKEN) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Passwort erforderlich — bitte erst über /gate anmelden." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
