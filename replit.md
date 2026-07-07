# RevolRMO

RevolRMO is a secure financial management web application for tracking recurring monthly payments, organized by Region and Project Managers, to streamline financial oversight, enhance project management, and improve revenue forecasting.

## Run & Operate

To run the application, ensure the following environment variables are set:
- `DATABASE_URL`: Connection string for PostgreSQL.
- `SESSION_SECRET`: Secret for session encryption.
- `ISSUER_URL`: OpenID Connect issuer URL (e.g., Google OAuth).
- `REPL_ID`: Replit deployment ID.

**Commands:**
- `npm install`: Install dependencies.
- `npm run dev`: Start the development server (frontend & backend).
- `npm run build`: Build the frontend and backend for production.
- `npm run typecheck`: Run TypeScript type checking.
- `npm run db:generate`: Generate Drizzle migrations.
- `npm run db:push`: Apply pending database migrations.

## Stack

- **Frontend:** React, TypeScript, Vite, Wouter, TanStack React Query, shadcn/ui (Radix UI), Tailwind CSS, React Hook Form, Zod, Recharts.
- **Backend:** Express.js, TypeScript, Drizzle ORM, Passport.js, express-session.
- **Database:** PostgreSQL.
- **Validation:** Zod, drizzle-zod.
- **Build Tool:** Vite (frontend), esbuild (backend).

## Where things live

- `src/`: Main application source code.
- `src/server/`: Backend API and server logic.
- `src/client/`: Frontend application code.
- `shared/schema.ts`: Database schema definition (source of truth).
- `drizzle/`: Drizzle migration files.
- `public/`: Static assets.

## Architecture decisions

- **RBAC Enforcement:** Dynamic role-based access control is enforced via Express middleware using permissions defined in `shared/schema.ts`.
- **Shared Schema:** A `shared/` directory centralizes Drizzle schema definitions and Zod types for consistent validation and type safety across frontend and backend.
- **Session Management:** `connect-pg-simple` is used for PostgreSQL-backed session storage with a 30-day absolute lifetime and no inactivity timeout.
- **Real-time Jira Sync:** A webhook endpoint is provided for real-time worklog synchronization from Jira, alongside manual sync options.
- **Transactional Project Merge:** Project merging is an atomic, transactional operation ensuring data integrity and providing an audit trail.

## Product

- **Dashboard:** Executive overview with KPIs, charts (Revenue vs Target, Collection Rate, Cashflow, Invoice Status, Aging), and a triage panel for items needing attention.
- **Recurring Payment Management:** Plan, track, and manage monthly payments, including status updates and comment threads.
- **Payment Comments & Table Screenshot:** Per-payment comment threads on the Recurring Overview table, visible to all users. Each row has a Notes column with chat icon + count badge; popover shows chronological comments with author/avatar/relative time and an inline composer. Author-only edit; author or admin delete. A "Capture Screenshot" toolbar button uses `html-to-image` to download the filtered/sorted table as PNG; in screenshot mode the Notes column inline-renders the latest comment (author · relative time + body + "+N more" badge). Backed by the new `payment_comments` table (paymentId FK cascade, userId FK, comment text, timestamps) and routes `GET/POST /api/payments/:id/comments`, `GET /api/payment-comments/summary?paymentIds=`, `PATCH/DELETE /api/payment-comments/:commentId`.
- **Project Management:** Create, manage, and merge projects with various billing types (FTFC, TBE, MRR), milestones, and associated financial tracking.
- **Invoice Management:** Full CRUD for invoices, including automatic generation, status tracking, PDF generation, and SMTP email delivery.
- **Forecasting Module:** Monthly and project-level revenue forecasting with auto-population for MRR and milestone-based projects.
- **Upsell Planning:** Track upsell opportunities through a pipeline, activity timeline, and conversion to payment records.
- **PMO KPIs:** Track project manager performance with configurable parameters, scoring, and monthly performance reports.
- **User & Role Management:** Dynamic RBAC system for granular permissions and user management.
- **Notification System:** Manual and automatic payment reminders, configurable via admin interface and SMTP settings.
- **Theme Customization:** User-specific and global theme settings for primary color and appearance mode.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

- Project deletion is permanent after a 30-second undo window; use with caution.
- Jira integration requires manual mapping of projects between Jira and RevolRMO.
- To include converted upsells in project value calculations, ensure the "Cost & Margin Upsells Toggle" is ON in the Hourly Buckets tab.

## Pointers

- **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **TanStack Query Docs:** [https://tanstack.com/query/latest/docs/react/overview](https://tanstack.com/query/latest/docs/react/overview)
- **Radix UI Docs:** [https://www.radix-ui.com/docs/primitives/overview](https://www.radix-ui.com/docs/primitives/overview)
- **Tailwind CSS Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **React Hook Form Docs:** [https://react-hook-form.com/get-started](https://react-hook-form.com/get-started)
- **Zod Docs:** [https://zod.dev/](https://zod.dev/)
- **Jira Server Documentation:** [http://10.10.30.35:8080](http://10.10.30.35:8080) (internal)