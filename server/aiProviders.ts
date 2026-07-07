import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { UpsellAiInsights, UpsellAiProvider, UpsellAnalysisScope } from "@shared/schema";
import type { UpsellAnalysisStats } from "./upsellAnalysis";
import { storage } from "./storage";

// Resolves credentials for a provider. We support three sources, in order:
//   1. A key managed in-app (Settings > AI Providers, stored in the DB)
//   2. Replit-managed AI gateway (AI_INTEGRATIONS_*_BASE_URL / *_API_KEY)
//   3. Direct provider API keys (OPENAI_API_KEY / ANTHROPIC_API_KEY)
// This lets admins manage keys from the UI while still working with the managed
// gateway or environment keys.
type ProviderConfig = { apiKey: string; baseURL?: string; model: string };

async function getOpenAiConfig(): Promise<ProviderConfig | null> {
  const saved = await storage.getAiProviderSetting("openai");
  const gatewayKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const gatewayUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const directKey = process.env.OPENAI_API_KEY;
  const model = saved?.model || process.env.OPENAI_MODEL || "gpt-4o";
  if (saved?.isActive && saved.apiKey) return { apiKey: saved.apiKey, model };
  if (gatewayKey && gatewayUrl) return { apiKey: gatewayKey, baseURL: gatewayUrl, model };
  if (directKey) return { apiKey: directKey, model };
  return null;
}

async function getAnthropicConfig(): Promise<ProviderConfig | null> {
  const saved = await storage.getAiProviderSetting("anthropic");
  const gatewayKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const gatewayUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const directKey = process.env.ANTHROPIC_API_KEY;
  const model = saved?.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  if (saved?.isActive && saved.apiKey) return { apiKey: saved.apiKey, model };
  if (gatewayKey && gatewayUrl) return { apiKey: gatewayKey, baseURL: gatewayUrl, model };
  if (directKey) return { apiKey: directKey, model };
  return null;
}

export async function isProviderConfigured(provider: UpsellAiProvider): Promise<boolean> {
  return provider === "openai" ? (await getOpenAiConfig()) !== null : (await getAnthropicConfig()) !== null;
}

export async function configuredProviders(): Promise<UpsellAiProvider[]> {
  const list: UpsellAiProvider[] = [];
  if (await getAnthropicConfig()) list.push("anthropic");
  if (await getOpenAiConfig()) list.push("openai");
  return list;
}

const insightsSchema = z.object({
  summary: z.string(),
  trends: z.array(z.string()),
  easyToUpsell: z.array(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const COMBINED_SYSTEM_PROMPT = `You are a senior revenue operations analyst for a professional services firm.
You analyze upsell performance data spanning both the pipeline and sold upsells, and produce concise, actionable business insights.
"Sold" upsells are locked change requests that already closed as revenue.
"Pipeline" upsells are opportunities that may be open, converted (won), or lost.
Base every statement strictly on the aggregated data provided. Do not invent numbers.
Respond with ONLY a JSON object (no markdown, no prose) matching exactly this shape:
{
  "summary": string,            // 2-4 sentence executive overview
  "trends": string[],           // notable trends over time / by category / by PM
  "easyToUpsell": string[],     // categories/items that convert most easily, with why
  "strengths": string[],        // what is working well
  "weaknesses": string[],       // gaps, low win rates, declining areas
  "recommendations": string[]   // concrete next actions
}
Each array should contain 2-6 short, specific bullet strings.`;

const SOLD_ONLY_SYSTEM_PROMPT = `You are a senior revenue operations analyst for a professional services firm.
You analyze ONLY the closed, revenue-generating "Sold Upsells" (locked change requests) and produce concise, actionable business insights about sold performance.
Do not reference or infer anything about open pipeline opportunities, conversion rates, or win/loss outcomes — that data is intentionally excluded from this analysis.
Base every statement strictly on the aggregated sold-upsell data provided (by category, by project, by project manager, by month, and by tag). Do not invent numbers.
Respond with ONLY a JSON object (no markdown, no prose) matching exactly this shape:
{
  "summary": string,            // 2-4 sentence executive overview of sold upsell performance
  "trends": string[],           // notable trends over time / by category / by PM / by tag
  "easyToUpsell": string[],     // categories/tags that generate the most sold revenue, with why
  "strengths": string[],        // what is working well in sold upsell performance
  "weaknesses": string[],       // gaps, underperforming categories/PMs/tags, declining areas
  "recommendations": string[]   // concrete next actions to grow sold upsell revenue
}
Each array should contain 2-6 short, specific bullet strings.`;

function systemPromptFor(scope: UpsellAnalysisScope): string {
  return scope === "sold" ? SOLD_ONLY_SYSTEM_PROMPT : COMBINED_SYSTEM_PROMPT;
}

// Hard ceiling on the serialized aggregate payload we send to a provider. This
// is a safety guard so an unusually large dataset can never produce an unbounded
// prompt. We only ever send aggregates (never raw rows), and we deterministically
// cap each array to the most significant entries before serializing.
const MAX_PROMPT_CHARS = 24000;

function compactStats(stats: UpsellAnalysisStats, caps: { list: number; months: number }) {
  const base = {
    scope: stats.scope,
    generatedAt: stats.generatedAt,
    overview: stats.overview,
    soldByCategory: stats.soldByCategory.slice(0, caps.list),
    soldByPm: stats.soldByPm.slice(0, caps.list),
    soldByProject: stats.soldByProject.slice(0, caps.list),
    soldByMonth: stats.soldByMonth.slice(-caps.months),
    soldByTag: stats.soldByTag.slice(0, caps.list),
    topCategories: stats.topCategories,
    bottomCategories: stats.bottomCategories,
  };
  if (stats.scope === "sold") return base;
  return {
    ...base,
    pipelineByStatus: stats.pipelineByStatus,
    winRateByCategory: stats.winRateByCategory.slice(0, caps.list),
    monthlyRevenueTrend: stats.monthlyRevenueTrend.slice(-caps.months),
  };
}

function buildUserPrompt(stats: UpsellAnalysisStats): string {
  // Progressively tighten the caps until the serialized payload fits the budget.
  const capOptions = [
    { list: 15, months: 24 },
    { list: 10, months: 18 },
    { list: 8, months: 12 },
    { list: 5, months: 6 },
  ];
  let payload = compactStats(stats, capOptions[0]);
  let truncated = false;
  let serialized = JSON.stringify(payload);
  for (let i = 1; i < capOptions.length && serialized.length > MAX_PROMPT_CHARS; i++) {
    payload = compactStats(stats, capOptions[i]);
    serialized = JSON.stringify(payload);
    truncated = true;
  }
  // Final hard stop: if even the tightest caps overflow, slice the string.
  if (serialized.length > MAX_PROMPT_CHARS) {
    serialized = serialized.slice(0, MAX_PROMPT_CHARS);
    truncated = true;
  }
  const note = truncated
    ? "\n\nNote: the dataset was truncated to its most significant aggregates to fit size limits."
    : "";
  const datasetLabel = stats.scope === "sold" ? "sold upsells" : "upsell";
  return `Analyze this aggregated ${datasetLabel} dataset and return the JSON insights object.${note}\n\nAGGREGATED DATA (JSON):\n${serialized}`;
}

function parseInsights(raw: string): UpsellAiInsights {
  let text = raw.trim();
  // Strip markdown code fences if the model wrapped the JSON.
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // Fall back to the first {...} block if there's surrounding prose.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text);
  return insightsSchema.parse(parsed);
}

async function runOpenAi(stats: UpsellAnalysisStats, cfg: ProviderConfig): Promise<UpsellAiInsights> {
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const completion = await client.chat.completions.create({
    model: cfg.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPromptFor(stats.scope) },
      { role: "user", content: buildUserPrompt(stats) },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  return parseInsights(content);
}

async function runAnthropic(stats: UpsellAnalysisStats, cfg: ProviderConfig): Promise<UpsellAiInsights> {
  const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const message = await client.messages.create({
    model: cfg.model,
    max_tokens: 2000,
    system: systemPromptFor(stats.scope),
    messages: [{ role: "user", content: buildUserPrompt(stats) }],
  });
  const block = message.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  if (!text) throw new Error("Anthropic returned an empty response");
  return parseInsights(text);
}

export type GeneratedInsights = { insights: UpsellAiInsights; model: string };

export async function generateUpsellInsights(
  provider: UpsellAiProvider,
  stats: UpsellAnalysisStats,
): Promise<GeneratedInsights> {
  if (provider === "openai") {
    const cfg = await getOpenAiConfig();
    if (!cfg) throw new ProviderNotConfiguredError("openai");
    return { insights: await runOpenAi(stats, cfg), model: cfg.model };
  }
  const cfg = await getAnthropicConfig();
  if (!cfg) throw new ProviderNotConfiguredError("anthropic");
  return { insights: await runAnthropic(stats, cfg), model: cfg.model };
}

// ===================== Appraisal performance analysis =====================
// On-demand AI analysis of a single PM's appraisal. Reuses the same provider
// credential resolution as the upsell analysis above.

export type AppraisalAnalysisInput = {
  personName: string;
  designation: string | null;
  periodLabel: string;
  averageScore: number | null;
  targetScore: number | null;
  baseIncrementPct: number | null;
  hpPct: number | null;
  servedMonths: number | null;
  eligible: boolean;
  eligibilityReason: string | null;
  currentGradeCode: string | null;
  assignedGradeCode: string | null;
};

const appraisalAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  actionItems: z.array(z.string()),
  plan: z.array(z.string()),
});

export type AppraisalAiInsights = z.infer<typeof appraisalAnalysisSchema>;

const APPRAISAL_SYSTEM_PROMPT = `You are a senior performance coach for the Project Management Office (PMO) of a professional services firm.
You review one Project Manager's appraisal scorecard and produce a concise, constructive performance analysis tailored to the Project Manager role.
"Overall performance" is the employee's average efficiency across the appraisal period (100% means they hit their full weighted target every month).
"Target score" is the threshold their designation must beat to earn an increment.

A Project Manager in this firm is responsible for:
1. Client communication & relationships — owning client-facing communication and keeping clients informed and confident.
2. Escalation control — proactively managing issues so no client becomes frustrated or escalates.
3. Delivery health — keeping deliveries on track, including artifact deliveries and phase/development deliveries.
4. Recurring revenue targets — ensuring the account's recurring targets are met.
5. Initiatives & process improvement — driving new processes and ideas that improve overall departmental performance.
6. Continuous learning — building new skills, including AI knowledge and adoption of new tools.

Anchor the analysis to these six Project Manager responsibility areas. Specifically:
- "improvements", "actionItems", and "plan" MUST each be framed around the responsibility areas above (e.g. client communication, escalation control, delivery health, recurring targets, initiatives/process improvement, continuous learning/AI adoption). Do NOT produce generic advice that could apply to any job — every item should clearly relate to a Project Manager's duties.
- "actionItems" must be concrete and specific to PM work (e.g. "Run a weekly client status sync to surface risks early"), not vague ("communicate better").
- "strengths" and "summary" should reflect how the person performed against these responsibilities given the data.

Be specific, supportive, and practical. Base every statement strictly on the data provided. Do not invent numbers or facts; where the data does not prove a specific outcome, frame improvement items as role-appropriate focus areas rather than asserting facts.
Respond with ONLY a JSON object (no markdown, no prose) matching exactly this shape:
{
  "summary": string,          // 2-4 sentence overview of how this Project Manager performed
  "strengths": string[],      // what they are doing well, tied to PM responsibilities
  "improvements": string[],   // PM-specific areas to improve (one or more of the six responsibility areas)
  "actionItems": string[],    // concrete, specific PM actions they should take
  "plan": string[]            // an ordered, realistic plan to raise their PM performance
}
Each array should contain 2-6 short, specific bullet strings.`;

function buildAppraisalPrompt(input: AppraisalAnalysisInput): string {
  const fmt = (n: number | null) => (n == null ? "N/A" : n.toString());
  const payload = {
    person: input.personName,
    designation: input.designation ?? "N/A",
    appraisalPeriod: input.periodLabel,
    overallPerformancePct: fmt(input.averageScore),
    targetScore: fmt(input.targetScore),
    baseIncrementPct: fmt(input.baseIncrementPct),
    highPerformerBonusPct: fmt(input.hpPct),
    monthsOfService: fmt(input.servedMonths),
    eligibleForIncrement: input.eligible,
    eligibilityNote: input.eligibilityReason ?? (input.eligible ? "Meets all criteria" : "N/A"),
    currentGrade: input.currentGradeCode ?? "N/A",
    newGrade: input.assignedGradeCode ?? "N/A",
  };
  return `Analyze this employee's appraisal and return the JSON analysis object.\n\nAPPRAISAL DATA (JSON):\n${JSON.stringify(payload)}`;
}

function parseAppraisalInsights(raw: string): AppraisalAiInsights {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  }
  return appraisalAnalysisSchema.parse(JSON.parse(text));
}

async function runOpenAiAppraisal(input: AppraisalAnalysisInput, cfg: ProviderConfig): Promise<AppraisalAiInsights> {
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const completion = await client.chat.completions.create({
    model: cfg.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: APPRAISAL_SYSTEM_PROMPT },
      { role: "user", content: buildAppraisalPrompt(input) },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  return parseAppraisalInsights(content);
}

async function runAnthropicAppraisal(input: AppraisalAnalysisInput, cfg: ProviderConfig): Promise<AppraisalAiInsights> {
  const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const message = await client.messages.create({
    model: cfg.model,
    max_tokens: 2000,
    system: APPRAISAL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildAppraisalPrompt(input) }],
  });
  const block = message.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  if (!text) throw new Error("Anthropic returned an empty response");
  return parseAppraisalInsights(text);
}

export type GeneratedAppraisalAnalysis = { insights: AppraisalAiInsights; provider: UpsellAiProvider; model: string };

// Generate an appraisal analysis. If no provider is given, the first configured
// provider is used (Anthropic preferred, then OpenAI). Throws
// ProviderNotConfiguredError when nothing is configured.
export async function generateAppraisalAnalysis(
  input: AppraisalAnalysisInput,
  provider?: UpsellAiProvider,
): Promise<GeneratedAppraisalAnalysis> {
  let chosen = provider;
  if (!chosen) {
    const available = await configuredProviders();
    if (available.length === 0) throw new ProviderNotConfiguredError("openai");
    chosen = available[0];
  }
  if (chosen === "openai") {
    const cfg = await getOpenAiConfig();
    if (!cfg) throw new ProviderNotConfiguredError("openai");
    return { insights: await runOpenAiAppraisal(input, cfg), provider: "openai", model: cfg.model };
  }
  const cfg = await getAnthropicConfig();
  if (!cfg) throw new ProviderNotConfiguredError("anthropic");
  return { insights: await runAnthropicAppraisal(input, cfg), provider: "anthropic", model: cfg.model };
}

export class ProviderNotConfiguredError extends Error {
  provider: UpsellAiProvider;
  constructor(provider: UpsellAiProvider) {
    super(`AI provider '${provider}' is not configured`);
    this.name = "ProviderNotConfiguredError";
    this.provider = provider;
  }
}
