import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
    // Options are loaded from environment variables by default
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    appBaseUrl: process.env.APP_BASE_URL,
    secret: process.env.AUTH0_SECRET,

    authorizationParameters: {
        // In v4, AUTH0_SCOPE and AUTH0_AUDIENCE are no longer auto-detected for API authorized apps, so provide them explicitly.
        scope: process.env.AUTH0_SCOPE,
        audience: process.env.AUTH0_AUDIENCE,
    }
});
