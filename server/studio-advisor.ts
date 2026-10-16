import type { Express, Request, Response } from "express";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { studyFactsFor } from "./estimate-service";
import { controlStore } from "./control/store";
import { randomUUID } from "node:crypto";

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
  conversationId: z.string().uuid().optional(),
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
        "When the context includes the project study on screen, answer questions about climate, surfaces, generation, self-consumption, export and whether a battery is worth it from those figures. Prefer the scenario marked as currently on screen over any other copy of the study.",
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

function saveAdvisorConversation(input: StudioAdvisorInput, answer: string) {
  const conversationId = input.conversationId;
  if (!conversationId) return;
  try {
    const store = controlStore();
    const email = `advisor-${conversationId}@anonymous.invalid`;
    const owner = store.byEmail(email) ?? store.createUser(email, "Website visitor");
    const existing = store.db
      .prepare("SELECT message FROM inquiries WHERE id=?")
      .get(conversationId) as { message?: string } | undefined;
    const old = existing
      ? (JSON.parse(existing.message || "{}").messages as unknown[] | undefined) ?? []
      : [];
    const messages = [
      ...old,
      { role: "user", content: input.message, at: new Date().toISOString() },
      { role: "assistant", content: answer, at: new Date().toISOString() },
    ].slice(-40);
    const now = new Date().toISOString();
    store.transaction(() => {
      if (existing)
        store.db
          .prepare("UPDATE inquiries SET message=?,created_at=? WHERE id=?")
          .run(JSON.stringify({ messages }), now, conversationId);
      else
        store.db
          .prepare(
            "INSERT INTO inquiries(id,owner,project_id,revision,contact,message,status,created_at,source) VALUES(?,?,?,?,?,?,?,?,?)"
          )
          .run(
            conversationId,
            owner.id,
            `advisor-${randomUUID()}`,
            1,
            JSON.stringify({
              name: "Website visitor",
              email: "",
              preferredContact: "email",
              type: "advisor_chat",
              caseId: input.caseId ?? null,
            }),
            JSON.stringify({ messages }),
            "new",
            now,
            "advisor"
          );
      store.audit(owner.id, "advisor.conversation_saved", conversationId);
    });
  } catch (error) {
    console.warn(
      "[studio-advisor] Conversation could not be saved",
      error instanceof Error ? error.message : error
    );
  }
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
      const answer = await askStudioAdvisor(parsed.data);
      saveAdvisorConversation(parsed.data, answer);
      res.json({ answer });
    } catch (error) {
      console.warn("[studio-advisor]", error instanceof Error ? error.message : error);
      res.status(502).json({ error: "Advisor unavailable" });
    }
  });
}
