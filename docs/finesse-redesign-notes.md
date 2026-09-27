# Finesse redesign notes

Source: [finesse-ui skill](https://raw.githubusercontent.com/mouse-lin/finesse-skill/main/skills/finesse-ui/SKILL.md), [redesign mode](https://raw.githubusercontent.com/mouse-lin/finesse-skill/main/skills/finesse-ui/references/redesign-mode.md), [product UI](https://raw.githubusercontent.com/mouse-lin/finesse-skill/main/skills/finesse-ui/references/product-ui.md), [anti-cheap checklist](https://raw.githubusercontent.com/mouse-lin/finesse-skill/main/skills/finesse-ui/references/anti-cheap.md), and [mobile floor](https://raw.githubusercontent.com/mouse-lin/finesse-skill/main/skills/finesse-ui/references/mobile-floor.md).

## Chosen direction

The Modernité platform is a **product workflow**, not a brand landing page. The redesign therefore uses a 16:9 desktop canvas with a floating application panel, a strict 8px rhythm, fixed product type scale, tinted charcoal and cool-silver surfaces, a single oxidised-copper accent, and high-density workflow cards. It deliberately rejects the previous warm-paper/green dashboard look and avoids brand-page grain, hero blobs, and generic card grids.

## Audit findings from the prior build

The previous entry used a low-contrast warm paper field, oversized headline and decorative CSS house that did not feel like a considered BIPV product. Interior pages repeatedly reused border-heavy cards, used too many small uppercase eyebrows, had inconsistent geometry across controls, and were not intentionally composed for an 16:9 desktop frame. Mobile results also overflowed horizontally because the wide hero range grid did not collapse early enough.

## Implementation rules

- Build around a `max-width: 1600px` 16:9 desktop panel, with a dark outer stage and an inner cool neutral application surface.
- Keep one accent only: oxidised copper; reserve jade/amber only for semantic states.
- Use fixed type sizes in product pages; use `tabular-nums` for values and right-align numeric table columns.
- Replace the landing hero with an asymmetrical operating-system-like opening: architectural grid, live design signal, clear single CTA, and a restrained moving solar-field motif.
- Remove decorative eyebrow duplication; show step numbering only where it conveys the actual workflow.
- Card treatment: 18px radius, extremely soft tinted shadow, translucent border, no hard `#ddd` outlines.
- Declare mobile layouts for every multi-column section, use `minmax(0, 1fr)`, `overflow-x: clip`, and collapse the report range grid before 640px.
- Validate every primary action's focus, active, disabled and loading states; use `prefers-reduced-motion` terminal states.

## Sources cited

Finesse recommends audit-first redesigns: typography, substrate, interaction states, layout, then precision. Product interfaces should use a dedicated product substrate rather than brand hero grammar. Its anti-cheap scan calls for tinted neutrals, one locked accent, no card-grid repetition, no fake data geometry, and no generic dashboard colour triads.
