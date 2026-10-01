import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { StudioGuideCopy } from "@/lib/studio-guide-copy";

type Rect = { top: number; left: number; width: number; height: number };

export function StudioTour({ copy, targets, onClose }: {
  copy: StudioGuideCopy["tour"];
  /** One target per tour item; null centres the card without a spotlight. */
  targets: Array<() => Element | null>;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const total = copy.items.length;
  const item = copy.items[index]!;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  useLayoutEffect(() => {
    const element = targetsRef.current[index]?.();
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const measure = () => {
      const box = element?.getBoundingClientRect();
      setRect(box && box.width > 0 ? { top: box.top, left: box.left, width: box.width, height: box.height } : null);
    };
    measure();
    const timer = window.setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(total - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  const pad = 8;
  const cardWidth = Math.min(360, window.innerWidth - 32);
  const below = rect ? rect.top + rect.height + pad + 220 < window.innerHeight : true;
  const cardStyle = rect
    ? {
        width: cardWidth,
        left: Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2)),
        ...(below ? { top: Math.min(window.innerHeight - 200, rect.top + rect.height + pad + 12) } : { bottom: Math.max(16, window.innerHeight - rect.top + pad + 12) }),
      }
    : { width: cardWidth, left: (window.innerWidth - cardWidth) / 2, top: window.innerHeight / 2 - 110 };

  return (
    <div className="studio-tour" role="dialog" aria-modal="true" aria-labelledby="studio-tour-title">
      {rect ? <div className="studio-tour__spotlight" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} /> : <div className="studio-tour__backdrop" />}
      <div className="studio-tour__card" style={cardStyle}>
        <div className="studio-tour__head">
          <span>{copy.counter(index + 1, total)}</span>
          <button type="button" onClick={onClose} aria-label={copy.skip}><X size={15} /></button>
        </div>
        <h3 id="studio-tour-title">{item.title}</h3>
        <p>{item.body}</p>
        <div className="studio-tour__dots" aria-hidden="true">{copy.items.map((_, dot) => <i key={dot} className={dot === index ? "is-active" : ""} />)}</div>
        <div className="studio-tour__actions">
          <button type="button" className="button-quiet" onClick={onClose}>{copy.skip}</button>
          <span>
            {index > 0 && <button type="button" className="studio-tour__back" onClick={() => setIndex(index - 1)}><ArrowLeft size={14} /> {copy.back}</button>}
            <button type="button" className="button-primary" onClick={() => (index === total - 1 ? onClose() : setIndex(index + 1))}>{index === total - 1 ? copy.done : copy.next} <ArrowRight size={14} /></button>
          </span>
        </div>
      </div>
    </div>
  );
}
