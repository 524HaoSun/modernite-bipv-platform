import type { Express, Request, Response } from "express";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { studyFactsFor } from "./estimate-service";

/**
 * The platform-wide Modernite AI advisor (also the online mode of the customer Studio's advisor).
 * Clients POST {message, language, history, context, caseId?} and receive {answer} (≤16 000 chars).
 */
export const STUDIO_ADVISOR_PATH = "/api/studio-advisor";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  fr: "French",
  ja: "Japanese",
  es: "Spanish",
  it: "Italian",
};

export const studioAdvisorInputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  language: z.string().max(12).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(16_000) })).max(8).optional(),
  context: z.string().max(20_000).optional(),
  caseId: z.string().regex(/^MOD-[A-Z0-9-]{4,24}$/).optional(),
});
export type StudioAdvisorInput = z.infer<typeof studioAdvisorInputSchema>;

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string"))
    .map((part) => part.text)
    .join("\n");
}

export function studioAdvisorMessages(input: StudioAdvisorInput, studyFacts?: string | null) {
  const language = LANGUAGE_NAMES[input.language ?? "en"] ?? "English";
  return [
    {
      role: "system" as const,
      content: [
        "You are the Modernite AI advisor for the Modernite building-integrated photovoltaic (BIPV) planning platform. The customer moves through: Project, Market, Site location (map pin, building detection from OpenStreetMap plus external roof geometry reference where available), Design Studio, Home energy, Calculation and Results.",
        "Answer questions about Modernite products (solar roof tiles, solar facade, canopies, pergolas, carports, shading), the customer's current step and configuration, and how to use the platform and the Studio (Building, Products, Finishes, Lighting, Save, Arrange in 3D, energy model, PDF report). Inverter and battery sizing is calculated when the customer confirms the final calculation.",
        "Use only figures that appear in the configuration context below or in the conversation. Never invent specifications, certifications, prices, warranties or performance guarantees; if a figure is not given, say it should be confirmed with Modernite.",
        "Energy figures in the context are planning estimates from the Studio's hourly model, not guarantees. Do not give structural, electrical or planning-permission advice beyond recommending a qualified professional.",
        "Use the platform KPI definitions consistently: Solar Coverage = solar energy used by the home divided by annual household demand; PV self-consumption = configured PV generation kept on site; Export Rate = configured PV generation exported to the grid. In the solar + battery scenario, battery discharge to the home is included in solar energy used by the home, while battery losses are not counted as home use or export.",
        `Reply in ${language}. Be concise and practical (normally under 180 words); use short lists when helpful.`,
        "",
        "Current platform context:",
        input.context?.trim() || "(not provided)",
        ...(studyFacts ? ["", "Calculated project study (authoritative figures):", studyFacts] : []),
      ].join("\n"),
    },
    ...(input.history ?? []).map((item) => ({ role: item.role, content: item.content })),
    { role: "user" as const, content: input.message },
  ];
}

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function askStudioAdvisor(input: StudioAdvisorInput) {
  const response = await invokeLLM({ model: "gpt-6-luna", messages: studioAdvisorMessages(input, input.caseId ? studyFactsFor(input.caseId) : null) });
  const answer = textContent(response.choices[0]?.message.content ?? "").trim();
  if (!answer) throw new Error("Empty advisor response");
  return answer.slice(0, 15_000);
}

export function registerStudioAdvisorRoute(app: Express) {
  app.post(STUDIO_ADVISOR_PATH, async (req: Request, res: Response) => {
    const client = String(req.headers["x-forwarded-for"] ?? req.ip ?? "unknown").split(",")[0].trim();
    if (rateLimited(client)) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    const parsed = studioAdvisorInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid advisor request" });
      return;
    }
    try {
      res.json({ answer: await askStudioAdvisor(parsed.data) });
    } catch (error) {
      console.warn("[studio-advisor]", error instanceof Error ? error.message : error);
      res.status(502).json({ error: "Advisor unavailable" });
    }
  });
}
