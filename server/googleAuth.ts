import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const ALLOWED_DOMAIN = "tekrevol.com";

const getGoogleConfig = memoize(
  async () => {
    return await client.discovery(
      new URL("https://accounts.google.com"),
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );
  },
  { maxAge: 3600 * 1000 }
);

let sessionStoreInstance: any = null;

export function getSessionStore() {
  if (!sessionStoreInstance) {
    const pgStore = connectPg(session);
    sessionStoreInstance = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: 30 * 24 * 60 * 60, // 30 days in seconds (connect-pg-simple expects seconds)
      tableName: "sessions",
      disableTouch: true, // Prevent session expiry from being extended on each request
    });
  }
  return sessionStoreInstance;
}

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET!;
}

export function getSession() {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  return session({
    secret: process.env.SESSION_SECRET!,
    store: getSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: false, // Don't reset cookie maxAge on every request - use absolute expiry
    cookie: {
      httpOnly: true,
      // "auto" sets the Secure flag when the request is detected as HTTPS
      // (via X-Forwarded-Proto behind a trusted proxy). On self-hosted setups
      // where the proxy does not forward that header, a plain `secure: true`
      // would cause express-session to silently DROP the cookie, breaking the
      // OAuth state round-trip. "auto" still issues a working cookie in that
      // case so login succeeds; the proxy transport remains HTTPS regardless.
      secure: "auto",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
  dbUserId?: string,
  isNewLogin: boolean = false
) {
  // Preserve the database user ID before updating claims
  const preservedDbUserId = dbUserId || user.dbUserId;
  
  user.claims = tokens.claims?.() || {};
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  
  // Use our own session expiry (30 days from login) instead of Google token expiry
  // Only set on new login, not on token refresh
  if (isNewLogin || !user.sessionExpiresAt) {
    user.sessionExpiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
  }
  
  // Always store and restore the database user ID
  if (preservedDbUserId) {
    user.dbUserId = preservedDbUserId;
    user.claims.sub = preservedDbUserId;
  }
}

async function upsertGoogleUser(claims: any) {
  const email = claims["email"] as string;
  const emailDomain = email.split("@")[1]?.toLowerCase();
  
  // Verify domain restriction
  if (emailDomain !== ALLOWED_DOMAIN) {
    throw new Error(`Access denied. Only @${ALLOWED_DOMAIN} email addresses are allowed.`);
  }
  
  // Check if user exists by email first (to preserve existing permissions)
  const existingUser = await storage.getUserByEmail(email);
  
  if (existingUser) {
    // Update existing user with Google profile info and lastLogin timestamp
    await storage.updateUser(existingUser.id, {
      firstName: claims["given_name"] || existingUser.firstName,
      lastName: claims["family_name"] || existingUser.lastName,
      profileImageUrl: claims["picture"] || existingUser.profileImageUrl,
      lastLogin: new Date(),
    });
    return existingUser;
  }
  
  // Create new user with Google's sub as ID
  await storage.upsertUser({
    id: claims["sub"],
    email: email,
    firstName: claims["given_name"],
    lastName: claims["family_name"],
    profileImageUrl: claims["picture"],
  });
  
  // Update lastLogin for the new user
  await storage.updateUser(claims["sub"], { lastLogin: new Date() });
  
  return await storage.getUser(claims["sub"]);
}

export async function setupAuth(app: Express) {
  // Trust the full proxy chain so Express reads X-Forwarded-Proto and treats
  // HTTPS requests forwarded by a reverse proxy as secure. Without this, the
  // `secure: true` session cookie is silently dropped behind multi-hop proxies
  // (e.g. self-hosted nginx/Cloudflare), losing the OAuth state between
  // /api/login and /api/callback ("Unable to verify authorization request state").
  app.set("trust proxy", true);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getGoogleConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const claims = tokens.claims?.();
      if (!claims) {
        console.error("[auth] verify failed: no claims in token");
        return verified(new Error("Failed to get user claims from token"));
      }
      const email = claims["email"] as string;
      const emailDomain = email?.split("@")[1]?.toLowerCase();

      // Verify domain restriction at token verification
      if (emailDomain !== ALLOWED_DOMAIN) {
        console.error(`[auth] verify failed: email domain "${emailDomain}" is not allowed (email=${email})`);
        return verified(new Error(`Access denied. Only @${ALLOWED_DOMAIN} email addresses are allowed.`));
      }

      // Upsert user and get the database user (may be existing user matched by email)
      let dbUser;
      try {
        dbUser = await upsertGoogleUser(claims);
      } catch (upsertErr: any) {
        console.error(`[auth] verify failed: upsertGoogleUser threw for email=${email}:`, upsertErr?.message || upsertErr);
        if (upsertErr?.stack) console.error(upsertErr.stack);
        return verified(upsertErr as Error);
      }

      if (!dbUser) {
        console.error(`[auth] verify failed: upsertGoogleUser returned null for email=${email}`);
        return verified(new Error("Failed to create or find user"));
      }

      // Create session user with database user ID for authorization
      const user: any = {};
      updateUserSession(user, tokens, dbUser.id, true); // true = new login

      verified(null, user);
    } catch (error: any) {
      console.error("[auth] verify failed (unexpected error):", error?.message || error);
      if (error?.stack) console.error(error.stack);
      verified(error as Error);
    }
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `google:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);

    // Intercept res.redirect so we force the session to be persisted
    // BEFORE the browser is redirected to Google. Without this, the
    // OAuth state/PKCE verifier the strategy wrote to req.session can
    // be lost on the redirect, causing /api/callback to fail with
    // "Unable to verify authorization request state".
    const originalRedirect = res.redirect.bind(res);
    (res as any).redirect = function patchedRedirect(...args: any[]) {
      const url = args[args.length - 1];
      const status = args.length > 1 ? args[0] : 302;
      req.session.save((err) => {
        if (err) {
          console.error("[auth] /api/login session.save error:", err?.message || err);
        }
        originalRedirect(status, url);
      });
    };

    passport.authenticate(`google:${req.hostname}`, {
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      // Restrict to tekrevol.com domain using hd parameter
      hd: ALLOWED_DOMAIN,
    } as any)(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);

    // If Google redirected back with an explicit error (e.g. the user denied
    // consent, or the hd domain restriction rejected the chosen account),
    // surface that reason instead of a generic failure.
    const googleError = (req.query.error as string) || "";
    if (googleError) {
      const desc = (req.query.error_description as string) || "";
      console.error(`[auth] /api/callback google returned error=${googleError} description=${desc} host=${req.hostname}`);
      const reason = encodeURIComponent(desc || googleError);
      return res.redirect(`/login?error=${encodeURIComponent(googleError)}&reason=${reason}`);
    }

    passport.authenticate(`google:${req.hostname}`, (err: any, user: any, info: any) => {
      if (err) {
        console.error("[auth] /api/callback authenticate error:", err?.message || err);
        if (err?.stack) console.error(err.stack);
        const reason = encodeURIComponent(err?.message || "Authentication failed");
        return res.redirect(`/login?error=access_denied&reason=${reason}`);
      }
      if (!user) {
        console.error("[auth] /api/callback no user returned. info:", info);
        const reason = encodeURIComponent((info && (info.message || String(info))) || "No account returned by Google");
        return res.redirect(`/login?error=access_denied&reason=${reason}`);
      }
      req.logIn(user, (loginErr: any) => {
        if (loginErr) {
          console.error("[auth] /api/callback req.logIn error:", loginErr?.message || loginErr);
          if (loginErr?.stack) console.error(loginErr.stack);
          const reason = encodeURIComponent(loginErr?.message || "Failed to establish session");
          return res.redirect(`/login?error=access_denied&reason=${reason}`);
        }
        // Persist the new authenticated session before redirecting to "/"
        // so the cookie carrying it is guaranteed to be set on the response.
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("[auth] /api/callback session.save error:", saveErr?.message || saveErr);
          }
          return res.redirect("/");
        });
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      // Clear session and redirect to home
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // Check session-based expiry (30 days from login), not Google token expiry
  if (!req.isAuthenticated() || !user?.sessionExpiresAt) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if session has expired (30 days since login)
  const now = Math.floor(Date.now() / 1000);
  if (now > user.sessionExpiresAt) {
    // Session expired, force re-login
    req.logout(() => {
      req.session.destroy(() => {});
    });
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }

  // Check if user is blocked in database
  const userId = user.dbUserId || user.claims?.sub;
  if (userId) {
    const dbUser = await storage.getUser(userId);
    if (dbUser?.status === "blocked") {
      // Destroy session and deny access for blocked users
      req.logout(() => {
        req.session.destroy(() => {});
      });
      return res.status(403).json({ message: "Your account has been blocked. Please contact an administrator." });
    }
  }

  // Session is valid - no need to check Google token expiry
  // User stays logged in until session expires (30 days) or they log out
  return next();
};
