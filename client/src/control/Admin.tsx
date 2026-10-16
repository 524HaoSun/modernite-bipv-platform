import { useEffect, useState } from "react";
import {
  Package,
  SlidersHorizontal,
  Banknote,
  GitPullRequest,
  Users,
  ClipboardList,
  MessageSquare,
  FolderKanban,
  LogOut,
  Search,
  ArrowUpRight,
  CheckCircle2,
  Plus,
  BarChart3,
} from "lucide-react";
import type { ControlUser, Domain, Release } from "../../../shared/control";
import { BrandLogo } from "@/components/BrandLogo";
import { api } from "./api";
import { Auth } from "./Auth";
import "./control.css";
const titles: Record<string, string> = {
  catalogue: "Product catalogue",
  technical: "Technical parameters",
  pricing: "Pricing & costs",
  releases: "Submitted changes",
  inquiries: "Customer inquiries",
  users: "People & access",
  audit: "Activity log",
  projects: "Saved calculations",
  analytics: "Website analytics",
};
const icons: Record<string, any> = {
  catalogue: Package,
  technical: SlidersHorizontal,
  pricing: Banknote,
  releases: GitPullRequest,
  inquiries: MessageSquare,
  users: Users,
  audit: ClipboardList,
  projects: FolderKanban,
  analytics: BarChart3,
};
const labels: Record<string, string> = {
  wp: "Power density · Wp/m²",
  a: "Direct temperature rise · K·m²/W",
  b: "Diffuse / reflected rise · K·m²/W",
  u: "U value · W/(m²·K)",
  g: "g value",
  gamma: "Temperature coefficient · K⁻¹",
  referenceTemperature: "Reference temperature · °C",
  threshold: "Irradiance threshold · W/m²",
  lowIntercept: "Low-light intercept",
  lowSlope: "Low-light slope",
  highLog: "High-light log coefficient",
  highIntercept: "High-light intercept",
  tileWidthDeduction: "Tile width deduction · m",
  tileHeightDeduction: "Tile height deduction · m",
  cost: "Purchase cost per unit",
  sale: "Fixed selling price per unit",
  rate: "Markup / margin rate · fraction",
  minimumMargin: "Minimum margin · fraction",
  maxDiscount: "Maximum discount · fraction",
  wastage: "Material wastage · fraction",
  effectiveFrom: "Effective from",
  effectiveUntil: "Expires at",
  thermalBasis: "Thermal measurement basis",
  areaBasis: "Power area basis",
  taxBasis: "Tax basis",
  wastageIncluded: "Wastage already included in cost",
};
const catalogueTypes = [
  {
    id: "roof_tiles",
    label: "Solar roof tiles",
    profiles: [
      "windsor_black",
      "windsor_colour",
      "cotswold_black",
      "cotswold_colour",
      "yorkshire_black",
      "yorkshire_colour",
      "highland_black",
      "highland_colour",
    ],
    colours: [
      "All Black",
      "Terracotta",
      "Brick Red",
      "Burgundy",
      "Silver Grey",
      "Graphite Grey",
      "Night Blue",
    ],
  },
  {
    id: "railing",
    label: "Solar railing",
    profiles: ["railing"],
    colours: ["Iceberg White", "London Grey", "Senegal Black", "Prague Black"],
  },
  {
    id: "skylight",
    label: "Solar skylight",
    profiles: ["skylight"],
    colours: ["Iceberg White", "London Grey", "Senegal Black", "Prague Black"],
  },
  {
    id: "pergola",
    label: "Solar pergola",
    profiles: ["canopy"],
    colours: ["Iceberg White", "London Grey", "Senegal Black", "Prague Black"],
  },
  {
    id: "shading_canopy",
    label: "Solar shading canopy",
    profiles: ["canopy"],
    colours: ["Iceberg White", "London Grey", "Senegal Black", "Prague Black"],
  },
  {
    id: "carport",
    label: "Solar carport",
    profiles: ["canopy"],
    colours: ["Iceberg White", "London Grey", "Senegal Black", "Prague Black"],
  },
  {
    id: "conservatory",
    label: "Solar conservatory",
    profiles: ["sunroom"],
    colours: ["Iceberg White", "London Grey", "Senegal Black", "Prague Black"],
  },
  {
    id: "facade",
    label: "Solar facade",
    profiles: ["facade_black", "facade_grey", "facade_lt"],
    colours: ["Iceberg White", "London Grey", "Senegal Black", "Prague Black"],
  },
] as const;
function Field({
  name,
  value,
  onChange,
  choices,
  disabled = false,
}: {
  name: string;
  value: any;
  onChange: (v: any) => void;
  choices?: string[];
  disabled?: boolean;
}) {
  const numeric =
    typeof value === "number" ||
    ["cost", "sale", "rate", "minimumMargin", "u", "g"].includes(name);
  const date = name === "effectiveFrom" || name === "effectiveUntil";
  return (
    <label>
      {labels[name] || name.replace(/^[a-z]/, c => c.toUpperCase())}
      {choices ? (
        <select
          disabled={disabled}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
        >
          {choices.map(c => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : typeof value === "boolean" ? (
        <select
          disabled={disabled}
          value={String(value)}
          onChange={e => onChange(e.target.value === "true")}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          disabled={disabled}
          type={date ? "datetime-local" : numeric ? "number" : "text"}
          step="any"
          value={date ? (value?.slice(0, 16) ?? "") : (value ?? "")}
          placeholder={value === null ? "Not set" : ""}
          onChange={e =>
            onChange(
              date
                ? e.target.value
                  ? new Date(e.target.value + "Z").toISOString()
                  : null
                : numeric
                  ? e.target.value === ""
                    ? null
                    : Number(e.target.value)
                  : e.target.value
            )
          }
        />
      )}
    </label>
  );
}

function AdvisorTranscript({ message }: { message: string }) {
  let messages: { role?: string; content?: string }[] = [];
  try {
    const parsed = JSON.parse(message) as { messages?: unknown };
    if (Array.isArray(parsed.messages)) messages = parsed.messages;
  } catch {
    // A malformed historic record should not make the inquiries page unusable.
  }

  if (!messages.length) return <p>Conversation record is unavailable.</p>;
  return (
    <div className="control-chat-transcript">
      {messages.map((message, index) => (
        <p key={index}>
          <strong>{message.role === "user" ? "Visitor" : "Modernité Advisor"}:</strong>{" "}
          {message.content || "—"}
        </p>
      ))}
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState<ControlUser | null | undefined>(),
    [tab, setTab] = useState("catalogue"),
    [current, setCurrent] = useState<Record<string, Release>>({}),
    [releases, setReleases] = useState<Release[]>([]),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState("");
  const [edit, setEdit] = useState<any>(null),
    [selected, setSelected] = useState("windsor_black"),
    [reason, setReason] = useState(""),
    [source, setSource] = useState(""),
    [impact, setImpact] = useState<any[] | null>(null),
    [detail, setDetail] = useState<Release | null>(null),
    [projectDetail, setProjectDetail] = useState<any>(null),
    [catalogueType, setCatalogueType] = useState("roof_tiles");
  const [analytics, setAnalytics] = useState<any>(null);
  const [staffDraft, setStaffDraft] = useState({
    username: "",
    name: "",
    password: "",
    role: "editor",
  });
  const has = (...roles: string[]) => user?.roles.some(r => roles.includes(r));
  const menus = [
    ...(has("product", "editor", "approval", "super") ? ["catalogue"] : []),
    ...(has("product", "technical", "editor", "approval", "super") ? ["technical"] : []),
    ...(has("pricing", "editor", "approval", "super") ? ["pricing"] : []),
    ...(has("product", "technical", "pricing", "editor", "approval", "super") ? ["releases"] : []),
    ...(has("sales", "editor", "approval", "super") ? ["inquiries", "projects", "analytics"] : []),
    ...(has("super") ? ["users"] : []),
    ...(has("product", "technical", "pricing", "editor", "approval", "sales", "super")
      ? ["audit"]
      : []),
  ];
  useEffect(() => {
    api("/session")
      .then(r => setUser(r.user))
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    if (user && menus.length && !menus.includes(tab)) setTab(menus[0]);
  }, [user]);
  async function reload() {
    setLoading(true);
    try {
      if (has("product", "technical", "pricing", "editor", "approval", "super")) {
        const [c, r] = await Promise.all([
          api("/admin/current"),
          api("/admin/releases"),
        ]);
        setCurrent(c);
        setReleases(r);
        if (c[tab]) setEdit(structuredClone(c[tab].data));
      }
      if (["inquiries", "users", "audit", "projects"].includes(tab))
        setRows(await api(`/admin/${tab}`));
      if (tab === "analytics") setAnalytics(await api("/admin/analytics"));
      setImpact(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user) void reload();
  }, [user, tab]);
  async function action(fn: () => Promise<any>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(success);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function completeLogin(nextUser: ControlUser) {
    setError("");
    setNotice("");
    setUser(nextUser);
  }
  async function signOut() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/logout", {});
      window.location.assign("/admin");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changeTab(next: string) {
    if (
      edit &&
      current[tab] &&
      JSON.stringify(edit) !== JSON.stringify(current[tab].data) &&
      !window.confirm(
        "Discard unsaved edits? Changes are only sent when you select Submit change."
      )
    )
      return;
    setTab(next);
    setEdit(null);
    setSearch("");
    setError("");
    setNotice("");
    setDetail(null);
    setProjectDetail(null);
    setReason("");
    setSource("");
  }
  if (user === undefined)
    return (
      <div className="control">
        <div className="control-loading">
          {error || "Opening your workspace…"}
          {error && (
            <button onClick={() => location.reload()}>Try again</button>
          )}
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="control">
        <Auth staff onLogin={completeLogin} />
      </div>
    );
  if (!menus.length)
    return (
      <div className="control">
        <div className="control-auth-card">
          <h1>Staff access required</h1>
          <p>Your account does not have an administration role.</p>
          <a href="/account">Open my projects</a>
          <button
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  const isDomain = ["catalogue", "technical", "pricing"].includes(tab),
    list = edit ? (tab === "technical" ? edit.products : edit) : [],
    item = Array.isArray(list)
      ? list.find((p: any) => p.id === selected)
      : null;
  const name = (id: string) =>
    ((current.catalogue?.data as any[]) || []).find(p => p.id === id)?.name ||
    id.replaceAll("_", " ");
  const activeCatalogueType =
    catalogueTypes.find(type => type.id === catalogueType) || catalogueTypes[0];
  const selectedFrameColour =
    ((current.catalogue?.data as any[]) || []).find(
      product => product.id === selected
    )?.frameColour || activeCatalogueType.colours[0];
  const update = (key: string, value: any) =>
    setEdit((old: any) =>
      tab === "technical"
        ? {
            ...old,
            products: old.products.map((p: any) =>
              p.id === selected ? { ...p, [key]: value } : p
            ),
          }
        : old.map((p: any) => (p.id === selected ? { ...p, [key]: value } : p))
    );
  const canReview = (domain: Domain) =>
    has(
      "super",
      "approval",
      domain === "catalogue"
        ? "product"
        : domain === "technical"
          ? "technical"
          : "pricing"
    );
  const canEditDomain = (domain: Domain) =>
    has(
      "editor",
      "super",
      domain === "catalogue"
        ? "product"
        : domain === "technical"
          ? "technical"
          : "pricing"
    );
  const pending = releases.filter(r => r.status === "submitted").length;
  return (
    <div className="control control-app">
      <aside className="control-sidebar">
        <a className="control-brand" href="/">
          <BrandLogo className="control-brand-logo" />
        </a>
        <div className="control-sidebar-label">WORKSPACE</div>
        <nav>
          {menus.map(key => {
            const Icon = icons[key];
            return (
              <button
                className={tab === key ? "active" : ""}
                key={key}
                onClick={() => changeTab(key)}
              >
                <Icon size={18} />
                {titles[key]}
                {key === "releases" && pending > 0 && <b>{pending}</b>}
              </button>
            );
          })}
        </nav>
        <div className="control-sidebar-bottom">
          <a href="/" target="_blank">
            Open Solar Studio <ArrowUpRight size={15} />
          </a>
          <div className="control-avatar">{user.email[0].toUpperCase()}</div>
          <strong>{user.name || user.email}</strong>
          <small>{user.roles.join(" · ")}</small>
          <button
            onClick={() => void signOut()}
          >
            <LogOut size={15} /> Sign out {user.name || user.email}
          </button>
        </div>
      </aside>
      <main className="control-main">
        <header className="control-topbar">
          <span>Modernité / Administration / {titles[tab]}</span>
          <span className="control-pill">
            <span className="control-dot" /> Secure workspace
          </span>
        </header>
        <div className="control-content">
          <div className="control-page-heading">
            <div>
              <div className="control-kicker">SOLAR STUDIO OPERATIONS</div>
              <h1>{titles[tab]}</h1>
              <p>
                {isDomain
                  ? "Keep every product accurate. Review every change before it reaches a customer."
                  : tab === "releases"
                    ? "A clear record of what changed, who reviewed it, and when it went live."
                    : "Manage your authorized records and follow-up activity."}
              </p>
            </div>
            <button
              disabled={busy || loading}
              onClick={() => {
                if (
                  !isDomain ||
                  JSON.stringify(edit) === JSON.stringify(current[tab]?.data) ||
                  window.confirm("Reload and discard unsaved edits?")
                )
                  void reload();
              }}
            >
              Refresh
            </button>
          </div>
          {error && (
            <div role="alert" className="control-error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="control-notice">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}
          {isDomain && (
            <>
              <div className="control-metrics">
                <div>
                  <small>PRODUCT TYPES</small>
                  <strong>
                    8 <span>with 17 style profiles</span>
                  </strong>
                </div>
                <div>
                  <small>ACTIVE VERSION</small>
                  <strong>
                    v{current[tab]?.version ?? "—"}
                    <span>
                      {current[tab]?.author === "migration"
                        ? "migration baseline"
                        : "approved version"}
                    </span>
                  </strong>
                </div>
                <div>
                  <small>REVIEW QUEUE</small>
                  <strong>
                    {pending}
                    <span>awaiting a decision</span>
                  </strong>
                </div>
              </div>
              {current[tab]?.author === "migration" && (
                <div className="control-banner">
                  V31 migration reference · Technical values, thermal basis and
                  pricing require internal confirmation.
                </div>
              )}
              {loading ? (
                <p className="control-loading">Loading product records…</p>
              ) : (
                edit && (
                  <div className="control-editor">
                    <section className="control-product-list">
                      <div className="control-search">
                        <Search size={16} />
                        <input
                          aria-label="Search products"
                          placeholder="Find a product…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                        />
                      </div>
                      <div className="control-list-label">PRODUCT TYPE</div>
                      {catalogueTypes
                        .filter(type =>
                          type.label
                            .toLowerCase()
                            .includes(search.toLowerCase())
                        )
                        .map(type => (
                          <button
                            key={type.id}
                            onClick={() => {
                              setCatalogueType(type.id);
                              setSelected(type.profiles[0]);
                            }}
                            className={
                              type.id === activeCatalogueType.id
                                ? "selected"
                                : ""
                            }
                          >
                            <div className="control-product-icon">
                              <Package size={19} />
                            </div>
                            <span>
                              <strong>{type.label}</strong>
                              <small>
                                {type.profiles.length} style
                                {type.profiles.length === 1 ? "" : "s"} ·{" "}
                                {type.colours.length} frame colours
                              </small>
                            </span>
                            <ArrowUpRight size={14} />
                          </button>
                        ))}
                    </section>
                    <section className="control-detail">
                      {item ? (
                        <>
                          <div className="control-detail-head">
                            <div>
                              <div className="control-kicker">
                                {selected.replaceAll("_", " / ")}
                              </div>
                              <h2>{item.name || name(selected)}</h2>
                            </div>
                            <span className="control-pill">
                              Ready to submit
                            </span>
                          </div>
                          <fieldset className="control-fields" disabled={!canEditDomain(tab as Domain)}>
                            <label>
                              Product type
                              <input
                                value={activeCatalogueType.label}
                                disabled
                              />
                            </label>
                            <label>
                              Style
                              <select
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                              >
                                {activeCatalogueType.profiles.map(id => (
                                  <option key={id} value={id}>
                                    {name(id)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Frame colour
                              {tab === "catalogue" ? (
                                <select
                                  value={
                                    item.frameColour || selectedFrameColour
                                  }
                                  onChange={e =>
                                    update("frameColour", e.target.value)
                                  }
                                >
                                  {activeCatalogueType.colours.map(colour => (
                                    <option key={colour} value={colour}>
                                      {colour}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input value={selectedFrameColour} disabled />
                              )}
                            </label>
                            {tab === "catalogue" ? (
                              <>
                                <Field
                                  name="name"
                                  value={item.name}
                                  onChange={v => update("name", v)}
                                />
                                <Field
                                  name="active"
                                  value={item.active}
                                  onChange={v => update("active", v)}
                                />
                                <label className="control-wide">
                                  Public description
                                  <textarea
                                    value={item.description}
                                    onChange={e =>
                                      update("description", e.target.value)
                                    }
                                  />
                                </label>
                              </>
                            ) : tab === "technical" ? (
                              <>
                                {["wp", "a", "b", "u", "g"].map(k => (
                                  <Field
                                    key={k}
                                    name={k}
                                    value={item[k]}
                                    onChange={v => update(k, v)}
                                  />
                                ))}
                                <Field
                                  name="role"
                                  value={item.role}
                                  choices={["none", "window", "skylight"]}
                                  onChange={v => {
                                    setEdit((old: any) => ({
                                      ...old,
                                      products: old.products.map((p: any) =>
                                        p.id === selected
                                          ? {
                                              ...p,
                                              role: v,
                                              u: v === "none" ? null : p.u,
                                              g: v === "none" ? null : p.g,
                                              thermalBasis:
                                                v === "none"
                                                  ? "not_applicable"
                                                  : "unconfirmed",
                                            }
                                          : p
                                      ),
                                    }));
                                  }}
                                />
                                <Field
                                  name="thermalBasis"
                                  value={item.thermalBasis}
                                  choices={[
                                    "not_applicable",
                                    "unconfirmed",
                                    "glass",
                                    "whole_assembly",
                                  ]}
                                  onChange={v => update("thermalBasis", v)}
                                />
                                <Field
                                  name="areaBasis"
                                  value={item.areaBasis}
                                  choices={["unconfirmed", "overall", "active"]}
                                  onChange={v => update("areaBasis", v)}
                                />
                              </>
                            ) : (
                              <>
                                <Field
                                  name="currency"
                                  value={item.currency}
                                  choices={["GBP", "EUR", "CAD", "JPY"]}
                                  onChange={v => update("currency", v)}
                                />
                                <Field
                                  name="unit"
                                  value={item.unit}
                                  choices={["m2", "piece", "set", "metre"]}
                                  onChange={v => update("unit", v)}
                                />
                                <Field
                                  name="method"
                                  value={item.method}
                                  choices={["fixed", "markup", "margin"]}
                                  onChange={v => update("method", v)}
                                />
                                <Field
                                  name="taxBasis"
                                  value={item.taxBasis}
                                  choices={["excluding_tax", "including_tax"]}
                                  onChange={v => update("taxBasis", v)}
                                />
                                {[
                                  "cost",
                                  "sale",
                                  "rate",
                                  "minimumMargin",
                                  "maxDiscount",
                                  "wastage",
                                  "wastageIncluded",
                                  "effectiveFrom",
                                  "effectiveUntil",
                                ].map(k => (
                                  <Field
                                    key={k}
                                    name={k}
                                    value={item[k]}
                                    onChange={v => update(k, v)}
                                  />
                                ))}
                                <p className="control-wide control-help">
                                  Enter rates as fractions: 0.2 = 20%. Markup:
                                  cost × (1 + rate). Margin: cost ÷ (1 − rate).
                                  Dates use UTC. Blank required pricing fields
                                  mean “quotation required”.
                                </p>
                                <JsonRows
                                  title="Bill of materials"
                                  value={item.bom}
                                  onChange={v => update("bom", v)}
                                  type="bom"
                                />
                                <JsonRows
                                  title="Price tiers"
                                  value={item.tiers}
                                  onChange={v => update("tiers", v)}
                                  type="tiers"
                                />
                              </>
                            )}
                          </fieldset>
                          {tab === "technical" && (
                            <fieldset disabled={!canEditDomain(tab as Domain)}>
                            <details className="control-model">
                              <summary>
                                Calculation model · applies to the complete
                                release
                              </summary>
                              <p className="control-help">
                                The 140 W/m² baseline has a small discontinuity.
                                Preserve it until technical review. Active-area
                                snapshots already exclude tile borders;
                                deductions are recorded for model provenance and
                                are not applied twice.
                              </p>
                              <div className="control-fields">
                                {Object.entries(edit.model).map(([k, v]) => (
                                  <Field
                                    key={k}
                                    name={k}
                                    value={v}
                                    disabled={
                                      !has("technical", "super") ||
                                      k.startsWith("tile")
                                    }
                                    onChange={v =>
                                      setEdit((old: any) => ({
                                        ...old,
                                        model: { ...old.model, [k]: v },
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                            </details>
                            </fieldset>
                          )}
                          <fieldset className="control-change" disabled={!canEditDomain(tab as Domain)}>
                            <h3>Give this change context</h3>
                            <label>
                              Reason for change
                              <textarea
                                placeholder="What changed, and why?"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                              />
                            </label>
                            <label>
                              Source or technical reference
                              <input
                                placeholder="Test certificate, cost sheet or approved policy"
                                value={source}
                                onChange={e => setSource(e.target.value)}
                              />
                            </label>
                            <div className="control-row">
                              {tab === "technical" && (
                                <button
                                  disabled={busy}
                                  onClick={async () => {
                                    setError("");
                                    try {
                                      setImpact(
                                        await api("/admin/impact", edit)
                                      );
                                    } catch (e) {
                                      setError((e as Error).message);
                                    }
                                  }}
                                >
                                  Preview calculation impact
                                </button>
                              )}
                              <button
                                className="control-primary"
                                disabled={
                                  busy ||
                                  reason.trim().length < 8 ||
                                  source.trim().length < 3
                                }
                                onClick={() =>
                                  action(async () => {
                                    await api("/admin/submissions", {
                                      domain: tab,
                                      data: edit,
                                      baseId: current[tab].id,
                                      reason,
                                      source,
                                    });
                                    setReason("");
                                    setSource("");
                                  }, "Change submitted for approval.")
                                }
                              >
                                <Plus size={16} />
                                Submit change
                              </button>
                            </div>
                            <small>
                              Submitting sends the change to an authorized
                              reviewer. It does not change live values until
                              approval.
                            </small>
                          </fieldset>
                          {impact && (
                            <div className="control-impact">
                              <h3>Sample impact · 10 m², 25°C ambient</h3>
                              <p>
                                80% direct and 20% diffuse radiation, 90% AC
                                factor.
                              </p>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Irradiance W/m²</th>
                                    <th>Current W</th>
                                    <th>Proposed W</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {impact
                                    .find(p => p.id === selected)
                                    ?.points.map((p: any) => (
                                      <tr key={p.irradiance}>
                                        <td>{p.irradiance}</td>
                                        <td>{p.beforeWatts.toFixed(3)}</td>
                                        <td>{p.afterWatts.toFixed(3)}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>Select a product to edit its details.</p>
                      )}
                    </section>
                  </div>
                )
              )}
            </>
          )}
          {tab === "releases" && (
            <section className="control-card">
              <table>
                <thead>
                  <tr>
                    <th>Change</th>
                    <th>Reason / source</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map(r => (
                    <tr key={r.id}>
                      <td>
                        <strong>{titles[r.domain]}</strong>
                        <small>
                          {r.version ? `Version ${r.version}` : "Submitted"} ·{" "}
                          {r.id.slice(0, 8)}
                        </small>
                      </td>
                      <td>
                        {r.reason}
                        <small>{r.source}</small>
                      </td>
                      <td>
                        <span className={`control-status ${r.status}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="control-table-actions">
                          <button
                            onClick={() =>
                              setDetail(detail?.id === r.id ? null : r)
                            }
                          >
                            Inspect
                          </button>
                          {r.status === "submitted" &&
                            r.author !== user.id &&
                            canReview(r.domain) && (
                              <button onClick={() => setDetail(r)}>
                                Review & approve
                              </button>
                            )}
                          {r.status === "submitted" && r.author === user.id && (
                            <button
                              disabled
                              title="A different reviewer must approve this change"
                            >
                              Awaiting reviewer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail && (
                <div className="control-inspect">
                  <h3>
                    {detail.status === "submitted" ? "Review" : "Approved"}{" "}
                    {titles[detail.domain]}
                  </h3>
                  <p>
                    Author: {detail.author} · Reviewer:{" "}
                    {detail.reviewer || "Not reviewed"}
                  </p>
                  <p>{detail.reason}</p>
                  <ChangeSummary
                    before={releases.find(r => r.id === detail.baseId)?.data}
                    after={detail.data}
                  />
                  {detail.status === "approved" && (
                    <div className="control-change">
                      <p>
                        This approved change is active for new calculations.
                        Saved project results retain their recorded versions.
                      </p>
                    </div>
                  )}
                  {detail.status === "submitted" &&
                    detail.author !== user.id &&
                    canReview(detail.domain) && (
                      <div className="control-row">
                        <button
                          className="control-primary"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              await api(
                                `/admin/releases/${detail.id}/approve`,
                                {}
                              );
                              setDetail(null);
                            }, "Change approved and is now active.")
                          }
                        >
                          Approve and make active
                        </button>
                      </div>
                    )}
                  {detail.status === "submitted" &&
                    detail.author === user.id && (
                      <p className="control-help">
                        Awaiting approval from a different authorized reviewer.
                        You cannot approve your own submitted change.
                      </p>
                    )}
                  {detail.status === "submitted" &&
                    detail.author !== user.id &&
                    !canReview(detail.domain) && (
                      <p className="control-help">
                        Your current role cannot approve this type of change.
                      </p>
                    )}
                </div>
              )}
            </section>
          )}
          {tab === "inquiries" && (
            <section className="control-card">
              <div className="control-search">
                <Search size={16} />
                <input
                  placeholder="Search assigned inquiries…"
                  aria-label="Search inquiries"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {rows
                .filter(r =>
                  JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
                )
                .map(r => (
                  <article key={r.id} className="control-inquiry">
                    <div className="control-row">
                      <h3>
                        {r.source === "advisor"
                          ? "AI advisor conversation"
                          : r.contact?.name || "Unassigned inquiry"}
                      </h3>
                      <span className="control-status">{r.status}</span>
                    </div>
                    {r.assignee ? (
                      <>
                        {r.source === "advisor" ? (
                          <AdvisorTranscript message={r.message} />
                        ) : (
                          <>
                            <p>
                              {r.contact.email} ·{" "}
                              {r.contact.phone || "No phone supplied"} ·{" "}
                              {r.contact.company}
                            </p>
                            <p>{r.message}</p>
                          </>
                        )}
                        <small>
                          Project {r.project_id} · revision {r.revision} ·
                          preferred contact: {r.contact.preferredContact}
                        </small>
                        <div className="control-row">
                          <select
                            aria-label="Inquiry status"
                            value={r.status}
                            onChange={e =>
                              action(
                                () =>
                                  api(`/admin/inquiries/${r.id}`, {
                                    status: e.target.value,
                                  }),
                                "Inquiry status updated"
                              )
                            }
                            disabled={busy}
                          >
                            {[
                              "new",
                              "contacted",
                              "qualified",
                              "quoted",
                              "won",
                              "closed",
                            ].map(s => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const note = window.prompt(
                                "Internal follow-up note (only assigned staff can see it)"
                              );
                              if (note)
                                void action(
                                  () =>
                                    api(`/admin/inquiries/${r.id}`, { note }),
                                  "Internal note added"
                                );
                            }}
                          >
                            Add internal note
                          </button>
                        </div>
                        {r.notes.map((n: any, i: number) => (
                          <blockquote key={i}>
                            {n.body}
                            <small>
                              {new Date(n.created_at).toLocaleString()}
                            </small>
                          </blockquote>
                        ))}
                      </>
                    ) : (
                      <>
                        <p>
                          Claim this inquiry to access the customer’s contact
                          details.
                        </p>
                        <button
                          disabled={busy}
                          onClick={() =>
                            action(
                              () =>
                                api(`/admin/inquiries/${r.id}`, {
                                  claim: true,
                                }),
                              "Inquiry assigned to you"
                            )
                          }
                        >
                          Assign to me
                        </button>
                      </>
                    )}
                  </article>
                ))}
              {!loading && !rows.length && (
                <Empty
                  title="Ready for the first conversation"
                  body="Customer quote requests will appear here. Contact details are shown only after assignment."
                />
              )}
            </section>
          )}
          {tab === "users" && (
            <section className="control-card">
              <h2>Create staff account</h2>
              <form
                className="control-staff-form"
                onSubmit={event => {
                  event.preventDefault();
                  void action(async () => {
                    await api("/admin/staff-accounts", staffDraft);
                    setStaffDraft({ username: "", name: "", password: "", role: "editor" });
                  }, "Staff account created");
                }}
              >
                <label>
                  Username
                  <input
                    required
                    pattern="[A-Za-z][A-Za-z0-9_-]{2,31}"
                    placeholder="e.g. editor-jane"
                    value={staffDraft.username}
                    onChange={event => setStaffDraft(current => ({ ...current, username: event.target.value }))}
                  />
                </label>
                <label>
                  Display name
                  <input
                    required
                    minLength={2}
                    placeholder="e.g. Jane Smith"
                    value={staffDraft.name}
                    onChange={event => setStaffDraft(current => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label>
                  Account type
                  <select
                    value={staffDraft.role}
                    onChange={event => setStaffDraft(current => ({ ...current, role: event.target.value }))}
                  >
                    <option value="editor">Editor</option>
                    <option value="approval">Approval</option>
                    <option value="super">Super administrator</option>
                  </select>
                </label>
                <label>
                  Password
                  <input
                    required
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    value={staffDraft.password}
                    onChange={event => setStaffDraft(current => ({ ...current, password: event.target.value }))}
                  />
                </label>
                <button className="control-primary" disabled={busy}>
                  Create account
                </button>
              </form>
              <div className="control-search">
                <Search size={16} />
                <input
                  placeholder="Search accounts…"
                  aria-label="Search accounts"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter(r =>
                      `${r.username || ""} ${r.name} ${r.email}`
                        .toLowerCase()
                        .includes(search.toLowerCase())
                    )
                    .map(r => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.username || r.email}</strong>
                          <small>{r.name}{r.username ? ` · ${r.email}` : ""}</small>
                        </td>
                        <td>
                          {r.username ? (
                            <select
                              value={r.roles[0] || "customer"}
                              disabled={busy || r.id === user.id}
                              onChange={event =>
                                void action(
                                  () => api(`/admin/users/${r.id}`, {
                                    roles: [event.target.value],
                                    active: r.active,
                                    reason: "Staff account type updated",
                                  }),
                                  "Account type updated"
                                )
                              }
                            >
                              <option value="editor">Editor</option>
                              <option value="approval">Approval</option>
                              <option value="super">Super administrator</option>
                            </select>
                          ) : r.roles.join(", ")}
                        </td>
                        <td>{r.active ? "Active" : "Suspended"}</td>
                        <td>
                          <div className="control-table-actions">
                            <button
                              disabled={busy || r.id === user.id}
                              onClick={() => {
                                const why = window.prompt(
                                  "Reason for changing this account status"
                                );
                                if (why)
                                  void action(
                                    () =>
                                      api(`/admin/users/${r.id}`, {
                                        roles: r.roles,
                                        active: !r.active,
                                        reason: why,
                                      }),
                                    "Account updated and sessions revoked"
                                  );
                              }}
                            >
                              {r.active ? "Suspend" : "Reactivate"}
                            </button>
                            {r.id !== user.id && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void action(
                                    () => api(`/admin/users/${r.id}/revoke`, {}),
                                    "All sessions revoked"
                                  )
                                }
                              >
                                Revoke sessions
                              </button>
                            )}
                            {r.username && (
                              <button
                                disabled={busy}
                                onClick={() => {
                                  const password = window.prompt("New password (at least 12 characters)");
                                  if (!password) return;
                                  void action(
                                    () => api(`/admin/staff-accounts/${r.id}/password`, { password }),
                                    "Password reset and existing sessions revoked"
                                  );
                                }}
                              >
                                Reset password
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="control-help">
                Usernames appear immediately after creation. Passwords are stored securely and are never shown again.
              </p>
            </section>
          )}
          {tab === "projects" && (
            <section className="control-card">
              <div className="control-search">
                <Search size={16} />
                <input placeholder="Search projects or email…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <table>
                <thead><tr><th>Project</th><th>Customer</th><th>Revision</th><th>Last saved</th><th>Details</th></tr></thead>
                <tbody>{rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())).map(r => (
                  <tr key={r.id}><td><strong>{r.name}</strong><small>{r.id}</small></td><td>{r.email}</td><td>{r.revision}</td><td>{new Date(r.updated_at).toLocaleString()}</td><td><button onClick={() => action(async () => setProjectDetail(await api(`/admin/projects/${r.id}/detail`)), "Calculation loaded")}>View calculation</button></td></tr>
                ))}</tbody>
              </table>
              {projectDetail && <div className="control-inspect">
                <h3>{projectDetail.project.name}</h3>
                <p>{projectDetail.project.email} · Revision {projectDetail.project.revision} · saved {new Date(projectDetail.savedAt).toLocaleString()}</p>
                <div className="control-fields">
                  <div><small>Location</small><strong>{projectDetail.payload.input.address}</strong></div>
                  <div><small>Market</small><strong>{projectDetail.payload.input.market}</strong></div>
                  <div><small>Capacity</small><strong>{projectDetail.payload.study ? `${projectDetail.payload.study.result.totalCapacityKwp.toFixed(2)} kWp` : "Not calculated"}</strong></div>
                  <div><small>Annual generation</small><strong>{projectDetail.payload.study ? `${Math.round(projectDetail.payload.study.result.range.representative).toLocaleString()} kWh/year` : "Not calculated"}</strong></div>
                </div>
                {projectDetail.payload.study && <table>
                  <thead><tr><th>Surface</th><th>Product</th><th>Area</th><th>Capacity</th><th>Annual generation</th></tr></thead>
                  <tbody>{projectDetail.payload.study.result.surfaces.map((surface: any) => <tr key={surface.surfaceId}>
                    <td>{surface.surfaceLabel}</td><td>{surface.productName}</td><td>{surface.areaM2.toFixed(1)} m²</td><td>{surface.capacityKwp.toFixed(2)} kWp</td><td>{Math.round(surface.annualKwh).toLocaleString()} kWh</td>
                  </tr>)}</tbody>
                </table>}
                <details><summary>Full saved calculation data</summary><pre className="control-json">{JSON.stringify(projectDetail.payload, null, 2)}</pre></details>
              </div>}
              {!loading && !rows.length && <Empty title="No saved calculations yet" body="Website calculations will appear here after a visitor saves a project." />}
            </section>
          )}
          {tab === "analytics" && analytics && (
            <section className="control-card">
              <p className="control-help">Visits are counted once per visitor, page and calendar day. Report and calculation totals include all records saved in this database.</p>
              <div className="control-fields control-analytics-summary">
                <div><small>Total visits</small><strong>{analytics.totals.visits.toLocaleString()}</strong></div>
                <div><small>Unique visitors</small><strong>{analytics.totals.uniqueVisitors.toLocaleString()}</strong></div>
                <div><small>Visits · last 7 days</small><strong>{analytics.totals.visitsLast7Days.toLocaleString()}</strong></div>
                <div><small>Saved calculations</small><strong>{analytics.totals.savedCalculations.toLocaleString()}</strong></div>
                <div><small>Generated reports</small><strong>{analytics.totals.generatedReports.toLocaleString()}</strong></div>
                <div><small>Quote requests</small><strong>{analytics.totals.quoteRequests.toLocaleString()}</strong></div>
                <div><small>Advisor conversations</small><strong>{analytics.totals.advisorConversations.toLocaleString()}</strong></div>
              </div>
              <h3>Recent activity</h3>
              <table>
                <thead><tr><th>Day</th><th>Visits</th><th>Visitors</th><th>Reports</th><th>Calculations</th></tr></thead>
                <tbody>{analytics.daily.map((day: any) => <tr key={day.day}><td>{day.day}</td><td>{day.visits}</td><td>{day.visitors}</td><td>{day.reports}</td><td>{day.calculations}</td></tr>)}</tbody>
              </table>
              {!analytics.daily.length && <Empty title="No activity yet" body="Website visits will start appearing when visitors open the Solar Studio." />}
            </section>
          )}
          {tab === "audit" && (
            <section className="control-card">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Record</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.action}</td>
                      <td>{r.actor}</td>
                      <td>{r.target}</td>
                      <td>
                        <code>{r.detail}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !rows.length && (
                <Empty
                  title="Your activity starts here"
                  body="Changes, approvals and account operations create an audit record."
                />
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="control-empty">
      <Package size={34} />
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
function JsonRows({
  title,
  value,
  onChange,
  type,
}: {
  title: string;
  value: any[];
  onChange: (v: any[]) => void;
  type: "bom" | "tiers";
}) {
  return (
    <div className="control-wide control-subtable">
      <h3>{title}</h3>
      {value.map((row, i) => (
        <div className="control-fields" key={i}>
          {Object.entries(row).map(([k, v]) => (
            <label key={k}>
              {k}
              <input
                value={(v as string) ?? ""}
                type={k === "label" ? "text" : "number"}
                step="any"
                placeholder={k === "to" ? "No upper limit" : ""}
                onChange={e =>
                  onChange(
                    value.map((r, j) =>
                      j === i
                        ? {
                            ...r,
                            [k]:
                              k === "label"
                                ? e.target.value
                                : e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                          }
                        : r
                    )
                  )
                }
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            Remove row
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([
            ...value,
            type === "bom"
              ? { label: "", quantity: 1, unitCost: 0 }
              : { from: value.at(-1)?.to ?? 0, to: null, sale: 1 },
          ])
        }
      >
        + Add {type === "bom" ? "material" : "price tier"}
      </button>
    </div>
  );
}

function ChangeSummary({ before, after }: { before: unknown; after: unknown }) {
  const flatten = (
    value: any,
    prefix = "",
    out: Record<string, unknown> = {}
  ) => {
    if (Array.isArray(value))
      value.forEach((item, index) =>
        flatten(
          item,
          `${prefix}${prefix ? " / " : ""}${item?.id ?? index + 1}`,
          out
        )
      );
    else if (value !== null && typeof value === "object")
      Object.entries(value).forEach(([key, v]) => {
        if (key !== "id")
          flatten(
            v,
            `${prefix}${prefix ? " / " : ""}${labels[key] || key}`,
            out
          );
      });
    else out[prefix] = value;
    return out;
  };
  const previous = flatten(before),
    next = flatten(after),
    keys = Array.from(
      new Set([...Object.keys(previous), ...Object.keys(next)])
    ).filter(k => JSON.stringify(previous[k]) !== JSON.stringify(next[k]));
  const show = (v: unknown) =>
    v === null || v === undefined
      ? "Not set"
      : typeof v === "boolean"
        ? v
          ? "Yes"
          : "No"
        : String(v);
  return (
    <div className="control-change">
      <h3>{keys.length} changed fields</h3>
      {keys.length ? (
        <table>
          <thead>
            <tr>
              <th>Product / field</th>
              <th>Previous</th>
              <th>Proposed</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k}>
                <td>{k.replaceAll("_", " ")}</td>
                <td>{show(previous[k])}</td>
                <td>{show(next[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No parameter values differ from the previous release.</p>
      )}
    </div>
  );
}
