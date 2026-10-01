import type { ReactNode } from "react";

export function PageIntro({ chapter, eyebrow, icon, title, lede, aside, className = "" }: {
  chapter: number;
  eyebrow: string;
  icon?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`page-intro ${className}`.trim()}>
      <div className="page-intro__chapter" aria-hidden="true"><span>{String(chapter).padStart(2, "0")}</span><i /></div>
      <div className="page-intro__copy">
        <p className="page-intro__eyebrow">{icon}{eyebrow}</p>
        <h1>{title}</h1>
        {lede && <p className="page-intro__lede">{lede}</p>}
      </div>
      {aside && <div className="page-intro__aside">{aside}</div>}
    </header>
  );
}
