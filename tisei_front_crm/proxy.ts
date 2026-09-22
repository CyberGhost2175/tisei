import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessRoute } from "./lib/role-access";
import type { UserRole } from "./lib/types";

const PUBLIC = ["/login", "/act"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const authed = request.cookies.get("tisei_auth")?.value === "1";
  if (!authed) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  const role = request.cookies.get("tisei_role")?.value as UserRole | undefined;
  if (role && !canAccessRoute(pathname, role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|tisei-logo.png|bereke-logo.png|bereke-mark.png).*)"],
};
