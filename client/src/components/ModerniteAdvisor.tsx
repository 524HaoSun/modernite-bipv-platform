import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, LoaderCircle, RotateCcw, Sparkles, X, Zap } from "lucide-react";
import { ADVISOR_COPY, type AdvisorPreset, type AdvisorStage } from "@/lib/advisor-copy";
import { publicPath } from "@/lib/paths";
import { WORKFLOW_LABELS, type WorkflowLanguage } from "@/lib/workflow-labels";

const ADVISOR_ENDPOINT = publicPath("api/studio-advisor");
const STUDIO_INTENTS = ["what", "why", "how", "specs"] as const;

type Route = "entry" | "market" | "location" | "studio" | "energy" | "calculation" | "results";
type Message = { id: number; role: "user" | "assistant"; text: string; source: "instant" | "ai" | "error" | "question" };
type StudioAdvisorCore = { context: () => string; answer: (question: string, intent: string) => string; label: (key: string) => string };

export const ADVISOR_ASK_EVENT = "modernite:advisor-ask";
const ADVISOR_TOGGLE_EVENT = "modernite:advisor-toggle";
const ADVISOR_STATE_EVENT = "modernite:advisor-state";
let advisorOpen = false;

/** The advisor's fixed home in every page header; the panel itself is mounted once by ModerniteAdvisor. */
export function AdvisorHeaderButton({ language }: { language: WorkflowLanguage }) {
  const copy = ADVISOR_COPY[language] ?? ADVISOR_COPY.en;
  const [open, setOpen] = useState(advisorOpen);
  useEffect(() => {
    const sync = (event: Event) => setOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener(ADVISOR_STATE_EVENT, sync);
    return () => window.removeEventListener(ADVISOR_STATE_EVENT, sync);
  }, []);
  return (
    <button
      type="button"
      className={`modernite-advisor-trigger ${open ? "is-open" : ""}`}
      aria-expanded={open}
      aria-controls="modernite-advisor-panel"
      onClick={() => window.dispatchEvent(new Event(ADVISOR_TOGGLE_EVENT))}
    >
      <Sparkles size={14} />
      <span>{copy.launcher}</span>
    </button>
  );
}

function stageFor(route: Route): AdvisorStage {
  if (route === "entry" || route === "market") return "start";
  if (route === "calculation") return "results";
  return route;
}

function studioAdvisorCore(): StudioAdvisorCore | null {
  const frame = document.querySelector<HTMLIFrameElement>("iframe.customer-studio-frame");
  try {
    return (frame?.contentWindow as (Window & { ModerniteAdvisorCore?: StudioAdvisorCore }) | null)?.ModerniteAdvisorCore ?? null;
  } catch {
    return null;
  }
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (part.startsWith("**") && part.endsWith("**") ? <b key={index}>{part.slice(2, -2)}</b> : <Fragment key={index}>{part}</Fragment>));
}

function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, index) => <li key={index}>{inline(item)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/^#{1,4}\s+/, "");
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (line) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

export function ModerniteAdvisor({ language, route, getContext, caseId }: {
  language: WorkflowLanguage;
  route: Route;
  getContext: () => string;
  caseId?: string;
}) {
  const copy = ADVISOR_COPY[language] ?? ADVISOR_COPY.en;
  const stage = stageFor(route);
  const stageName = WORKFLOW_LABELS[language][route === "entry" ? "project" : route];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [studioPresets, setStudioPresets] = useState<AdvisorPreset[]>([]);
  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const push = useCallback((role: Message["role"], text: string, source: Message["source"]) => {
    setMessages((current) => [...current, { id: nextId.current++, role, text, source }].slice(-40));
  }, []);

  useEffect(() => {
    if (!open || stage !== "studio") return;
    const core = studioAdvisorCore();
    setStudioPresets(core ? STUDIO_INTENTS.map((intent) => {
      const question = core.label(intent);
      return { id: intent, question, answer: core.answer(question, intent) };
    }) : []);
  }, [open, stage, language]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  const askAi = useCallback(async (question: string) => {
    const text = question.trim().slice(0, 2000);
    if (!text) return;
    const history = messagesRef.current
      .filter((message) => message.source === "question" || message.source === "ai")
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.text.slice(0, 16_000) }));
    push("user", text, "question");
    setDraft("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 45_000);
    setPending(true);
    try {
      const response = await fetch(ADVISOR_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language, history, context: getContext().slice(0, 19_000), ...(caseId ? { caseId } : {}) }),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as { answer?: string };
      if (!response.ok || typeof body.answer !== "string" || !body.answer.trim()) throw new Error("advisor");
      push("assistant", body.answer, "ai");
    } catch {
      if (abortRef.current === controller) push("assistant", copy.failed, "error");
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) {
        abortRef.current = null;
        setPending(false);
      }
    }
  }, [caseId, copy.failed, getContext, language, push]);

  const askPreset = (preset: AdvisorPreset) => {
    push("user", preset.question, "instant");
    push("assistant", preset.answer, "instant");
  };

  const clear = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPending(false);
    setMessages([]);
  };

  const close = useCallback(() => {
    setOpen(false);
    document.querySelector<HTMLButtonElement>(".modernite-advisor-trigger")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    advisorOpen = open;
    window.dispatchEvent(new CustomEvent(ADVISOR_STATE_EVENT, { detail: open }));
  }, [open]);

  useEffect(() => {
    const toggle = () => setOpen((current) => !current);
    window.addEventListener(ADVISOR_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(ADVISOR_TOGGLE_EVENT, toggle);
  }, []);

  useEffect(() => {
    const onAsk = (event: Event) => {
      const question = (event as CustomEvent<{ question?: string }>).detail?.question;
      setOpen(true);
      if (question) void askAi(question);
    };
    window.addEventListener(ADVISOR_ASK_EVENT, onAsk);
    return () => window.removeEventListener(ADVISOR_ASK_EVENT, onAsk);
  }, [askAi]);

  const presets = stage === "studio" ? (studioPresets.length ? studioPresets : copy.presets.start) : copy.presets[stage];

  return (
    <>
      <section
        id="modernite-advisor-panel"
        className="modernite-advisor-panel"
        role="dialog"
        aria-modal="false"
        aria-label={copy.title}
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
      >
        <header className="modernite-advisor-head">
          <span className="modernite-advisor-mark"><Sparkles size={16} /></span>
          <div><strong>{copy.title}</strong><small>{copy.stage(stageName)}</small></div>
          <button type="button" onClick={clear} aria-label={copy.clear} title={copy.clear} disabled={!messages.length && !pending}><RotateCcw size={14} /></button>
          <button type="button" onClick={close} aria-label={copy.close} title={copy.close}><X size={16} /></button>
        </header>
        <div className="modernite-advisor-transcript" ref={transcriptRef} role="log" aria-live="polite">
          <div className="modernite-advisor-bubble is-assistant is-intro"><p>{copy.intro}</p></div>
          {messages.map((message) => (
            <div key={message.id} className={`modernite-advisor-bubble is-${message.role} is-${message.source}`}>
              {message.role === "assistant" && message.source !== "error" && <em>{message.source === "instant" ? <><Zap size={10} /> {copy.instant}</> : <><Sparkles size={10} /> {copy.ai}</>}</em>}
              {message.role === "assistant" ? <RichText text={message.text} /> : <p>{message.text}</p>}
            </div>
          ))}
          {pending && <div className="modernite-advisor-bubble is-assistant is-pending"><LoaderCircle size={13} className="spin" /> {copy.thinking}</div>}
        </div>
        <div className="modernite-advisor-presets">
          {presets.map((preset) => <button key={preset.id} type="button" onClick={() => askPreset(preset)}><Zap size={11} /> {preset.question}</button>)}
        </div>
        <form
          className="modernite-advisor-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) void askAi(draft);
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            maxLength={2000}
            rows={1}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!pending) void askAi(draft);
              }
            }}
          />
          <button type="submit" disabled={pending || !draft.trim()} aria-label={copy.send} title={copy.send}><ArrowUp size={16} /></button>
        </form>
        <p className="modernite-advisor-note">{copy.disclaimer}</p>
      </section>
    </>
  );
}
