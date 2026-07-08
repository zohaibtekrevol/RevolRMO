---
name: Upsell AI Analysis provider config
description: How the Upsell AI Analysis feature gets its AI credentials and why it degrades instead of failing.
---

# Upsell AI Analysis — AI provider configuration

The Upsell AI Analysis dashboard computes deterministic stats (always available, no AI needed) plus optional AI-generated insights.

**Credential resolution (server/aiProviders.ts), in order per provider:**
1. In-app key managed in Settings > AI Providers (DB row, only when `isActive`) — config fns are async because they read the DB
2. Replit-managed AI gateway env (`AI_INTEGRATIONS_OPENAI_*` / `AI_INTEGRATIONS_ANTHROPIC_*`)
3. Direct keys (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`)

**Why DB-first:** admins manage keys in-app so a saved key should override env. Keep this order if adding providers. The API key is write-only from the UI (responses expose only `hasApiKey`); blank submits preserve the stored key (SMTP pattern).

**Why:** The Replit-managed AI integrations gateway is DISABLED org-wide for this workspace (the setup tool fails). So the feature was built to also accept direct provider API keys. With neither configured, deterministic stats still render and the run endpoint returns `503 PROVIDER_NOT_CONFIGURED`. Low-data (<3 data points) returns `422 INSUFFICIENT_DATA`.

**How to apply:** To enable AI insights, set `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` (request via environment-secrets). Model overrides: `OPENAI_MODEL`, `ANTHROPIC_MODEL`. Only aggregated stats are ever sent to the model — `buildUserPrompt` deterministically caps each array and enforces a ~24k-char budget, never raw upsell/CR rows.

**Gotcha — stale model default 404s the whole feature:** the saved DB AI provider row often has a BLANK model, so the code default is what actually runs. Anthropic retires old model aliases fast; a stale default (e.g. `claude-3-5-sonnet-latest`, and even `claude-sonnet-4-20250514`) returns `404 not_found_error`, which the appraisal AI-analysis route surfaces as `502 PROVIDER_ERROR` (a configured-but-failing call, NOT 503). The shared `generateAppraisalAnalysis`/`generateUpsellInsights` path means this breaks BOTH features at once. **Why:** model names are time-sensitive and the route swallows the real error into a generic 502. **How to apply:** if AI analysis 502s, reproduce by calling the provider directly to read the true error; if it's a model 404, probe candidate model names against the live key and update the code default in `getAnthropicConfig`/`getOpenAiConfig`. As of mid-2026 only `claude-sonnet-4-5` worked on this key (all 3.x/4.0 deprecated).
