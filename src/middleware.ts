import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "erp_apaa_token";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "erp_apaa_super_secret_jwt_key_2026_change_in_production"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  let isValidSession = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isValidSession = true;
    } catch {
      isValidSession = false;
    }
  }

  // Se já está logado e tenta acessar /login -> redireciona para a home /
  if (pathname === "/login" && isValidSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Se não está logado e tenta acessar a raiz ou rotas protegidas -> redireciona para /login
  if (pathname === "/" && !isValidSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
