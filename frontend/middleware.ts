import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
    try {
        return await auth0.middleware(request);
    } catch (error) {
        // A stale or foreign session cookie (for example one encrypted with a
        // different AUTH0_SECRET) makes the Auth0 middleware throw a JWE/JWT
        // decryption error. Don't let that take down every route: clear the bad
        // cookie and continue as an unauthenticated request. Re-throw anything
        // that isn't a session-decryption error so real misconfig still surfaces.
        const name = error instanceof Error ? error.name : "";
        const code = (error as { code?: string })?.code ?? "";
        const isSessionDecryptError = name.includes("JWE") || name.includes("JWT") || code.startsWith("ERR_JW");
        if (!isSessionDecryptError) throw error;

        const response = NextResponse.next();
        response.cookies.delete("appSession");
        response.cookies.delete("__session");
        return response;
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};