import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RATE_LIMIT_CONFIG } from "./securityConfig";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV === "production";

// Trust the reverse proxy so req.ip / secure-cookie detection use the real
// client IP from X-Forwarded-* headers. Also set in setupAuth(); set here too
// so the rate limiter (registered before routes) keys on the correct IP.
app.set("trust proxy", true);

// Security headers (clickjacking, MIME-sniffing, HSTS, referrer policy, etc.).
// Content-Security-Policy is disabled because the Vite dev server and the
// bundled frontend rely on inline scripts/styles and websockets that a default
// CSP would block; the remaining Helmet defaults are safe for this app.
// Cross-Origin-Embedder-Policy is disabled so external images/resources still load.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    // HSTS only meaningfully applies over HTTPS (production behind the proxy).
    hsts: isProduction
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,
  }),
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Rate limiting. A stricter limit guards the auth/login routes against
// brute-force and OAuth abuse; a broader limit protects the rest of the API
// from runaway clients. Both key on the real client IP (trust proxy is set
// above). Limits are generous enough that normal interactive use is unaffected.
// `validate.trustProxy: false` silences express-rate-limit's warning about the
// permissive `trust proxy: true` above. That setting is intentional and required
// for the app's multi-hop proxy auth; we knowingly key the limiter on req.ip.
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.auth.windowMs,
  max: RATE_LIMIT_CONFIG.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { message: "Too many login attempts. Please try again in a few minutes." },
});

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.api.windowMs,
  max: RATE_LIMIT_CONFIG.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { message: "Too many requests. Please slow down and try again shortly." },
});

app.use([...RATE_LIMIT_CONFIG.auth.paths], authLimiter);
app.use([...RATE_LIMIT_CONFIG.api.paths], apiLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Non-critical startup maintenance. Runs AFTER the server is listening so a slow
// or failing database call can never block the port from binding — a blocked
// bind would make the deployment health check (GET /) time out and fail the
// promote step. Each task is independently guarded so one failure can't stop the
// others or crash the process.
async function runStartupMaintenance() {
  try {
    const { storage } = await import("./storage");
    await storage.initializeDefaultRoles();
  } catch (err) {
    console.error("initializeDefaultRoles failed:", err);
  }

  // Seed sold-upsell categories additively (Task #111). Idempotent: only inserts
  // categories that don't already exist, never deletes/overwrites admin edits.
  try {
    const { storage } = await import("./storage");
    await storage.ensureUpsellCategories();
  } catch (err) {
    console.error("ensureUpsellCategories failed:", err);
  }

  // One-time fix: set is_target=false for all upsell payments that incorrectly have is_target=true
  try {
    const { db } = await import("./db");
    const { payments } = await import("../shared/schema");
    const { eq, and } = await import("drizzle-orm");
    await db.update(payments)
      .set({ isTarget: false })
      .where(and(eq(payments.paymentType, "upsell"), eq(payments.isTarget, true)));
    console.log("Fixed upsell payments is_target flag");
  } catch (err) {
    console.error("Error fixing upsell is_target:", err);
  }

  // One-time backfill: flag existing project managers via the new isProjectManager
  // designation. Idempotent (skips already-flagged users) so it is safe to run on
  // every boot. Sources: legacy PM role, plus any user already referenced as a PM
  // in projects, pm_targets, or kpi monthly reviews.
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      UPDATE users SET is_project_manager = true
      WHERE is_project_manager = false
        AND (
          role IN ('pm', 'project_manager')
          OR id IN (SELECT pm_id FROM projects WHERE pm_id IS NOT NULL)
          OR id IN (SELECT pm_id FROM pm_targets WHERE pm_id IS NOT NULL)
          OR id IN (SELECT pm_id FROM kpi_monthly_reviews WHERE pm_id IS NOT NULL)
        )
    `);
    console.log("Backfilled isProjectManager designation");
  } catch (err) {
    console.error("Error backfilling isProjectManager:", err);
  }

  // Backfill level_id_snapshot for existing kpi_monthly_reviews rows that were
  // written before this column existed. Assigns each PM's current kpiLevelId to
  // all their NULL-snapshot rows. Idempotent (only touches rows where the column
  // is still NULL) so safe to run on every boot.
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      UPDATE kpi_monthly_reviews kmr
      SET level_id_snapshot = u.kpi_level_id
      FROM users u
      WHERE kmr.pm_id = u.id
        AND kmr.level_id_snapshot IS NULL
        AND u.kpi_level_id IS NOT NULL
    `);
    console.log("Backfilled kpi_monthly_reviews.level_id_snapshot");
  } catch (err) {
    console.error("Error backfilling level_id_snapshot:", err);
  }

  // Seed appraisal reference data (Designations + Grades) from the bundled
  // snapshot. Idempotent: each table is only seeded when it is currently empty,
  // so this populates a fresh production database on first publish without ever
  // overwriting data that already exists (e.g. edits made in production). IDs
  // from the snapshot are preserved so the band -> designation foreign keys and
  // any existing references stay consistent.
  try {
    await seedAppraisalReferenceData();
  } catch (err) {
    console.error("Error seeding appraisal reference data:", err);
  }
}

async function seedAppraisalReferenceData() {
  const { db } = await import("./db");
  const { grades, salaryGradeBands } = await import("../shared/schema");
  const { sql } = await import("drizzle-orm");
  // Imported (not read from disk) so esbuild inlines the snapshot into the
  // production bundle and it is available regardless of working directory.
  const raw = (await import("./seed-data/appraisal-reference-data.json", {
    with: { type: "json" },
  })).default as {
    grades: Array<Record<string, any>>;
    bands: Array<Record<string, any>>;
  };

  await db.transaction(async (tx) => {
    const [gradeCount] = await tx.select({ n: sql<number>`count(*)` }).from(grades);
    if (Number(gradeCount?.n ?? 0) === 0 && raw.grades.length > 0) {
      await tx.insert(grades).values(
        raw.grades.map((g) => ({
          id: g.id,
          name: g.name,
          code: g.code ?? null,
          targetScore: String(g.target_score),
          baseIncrementPct: String(g.base_increment_pct),
          sortOrder: g.sort_order ?? 0,
        })),
      );
      console.log(`Seeded ${raw.grades.length} designations`);
    }

    const [bandCount] = await tx.select({ n: sql<number>`count(*)` }).from(salaryGradeBands);
    if (Number(bandCount?.n ?? 0) === 0 && raw.bands.length > 0) {
      // Resolve each band's parent Designation against whatever is actually in
      // the DB now, so seeding stays FK-safe even when `grades` was populated
      // separately (e.g. manually) with different IDs than the snapshot. Match
      // by id first, then by the snapshot designation name; fall back to null
      // (the FK is nullable and designationName is kept either way).
      const currentGrades = await tx
        .select({ id: grades.id, name: grades.name })
        .from(grades);
      const idSet = new Set(currentGrades.map((g) => g.id));
      const byName = new Map(
        currentGrades.map((g) => [g.name.trim().toLowerCase(), g.id]),
      );

      await tx.insert(salaryGradeBands).values(
        raw.bands.map((b) => {
          let designationId: string | null = null;
          if (b.designation_id && idSet.has(b.designation_id)) {
            designationId = b.designation_id;
          } else if (b.designation_name) {
            designationId =
              byName.get(String(b.designation_name).trim().toLowerCase()) ?? null;
          }
          return {
            id: b.id,
            designationId,
            designationName: b.designation_name ?? null,
            gradeCode: b.grade_code ?? null,
            label: b.label ?? null,
            salaryAmount: String(b.salary_amount),
            details: b.details ?? null,
            sortOrder: b.sort_order ?? 0,
          };
        }),
      );
      console.log(`Seeded ${raw.bands.length} grade bands`);
    }
  });
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    // Always log the full error (including stack) server-side for debugging.
    console.error("Unhandled error:", err);

    // Never leak internal stack traces or DB details to the client. Client
    // errors (4xx) can safely surface their own message; for 5xx in production
    // return a generic message. Do NOT re-throw after responding — that would
    // crash the process and expose nothing useful to the client.
    const message =
      status < 500
        ? err.message || "Request failed"
        : isProduction
          ? "Internal Server Error"
          : err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Bind first, then run maintenance in the background so the health check
      // can succeed immediately regardless of database state.
      void runStartupMaintenance();
    },
  );
})();
