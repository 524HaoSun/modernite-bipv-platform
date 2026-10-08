import { useEffect, useState } from "react";
import { Leaf, Plus, Save, Download, ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import type { ControlUser } from "../../../shared/control";
import { api } from "./api";
import { Auth } from "./Auth";
import "./control.css";
export default function Account() {
  const [user, setUser] = useState<ControlUser | null | undefined>(),
    [projects, setProjects] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [name, setName] = useState(""),
    [configuration, setConfiguration] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<any>(null),
    [inquiries, setInquiries] = useState<any[]>([]),
    [showInquiry, setShowInquiry] = useState(false),
    [useLatest, setUseLatest] = useState(false);
  useEffect(() => {
    api("/session")
      .then(r => setUser(r.user))
      .catch(e => setError(e.message));
    try {
      const saved = localStorage.getItem("modernite-private-project-input");
      if (saved) {
        setConfiguration(JSON.stringify(JSON.parse(saved), null, 2));
        setName("My solar project");
      }
    } catch {}
  }, []);
  async function reload() {
    setProjects(await api("/projects"));
    setInquiries(await api("/inquiries"));
  }
  useEffect(() => {
    if (user) void reload().catch(e => setError(e.message));
  }, [user]);
  async function action(fn: () => Promise<any>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string, revision?: number) {
    const result = await api(
      `/projects/${id}${revision ? `?revision=${revision}` : ""}`
    );
    setSelected(result);
    setName(result.project.name);
    setConfiguration(JSON.stringify(result.payload.input, null, 2));
    setQuote(null);
    setShowInquiry(false);
  }
  if (user === undefined)
    return (
      <div className="control">
        <div className="control-loading">
          {error || "Opening your projects…"}
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="control">
        <Auth onLogin={setUser} />
      </div>
    );
  return (
    <div className="control">
      <main className="control-account">
        <header>
          <a className="control-brand" href="/">
            <BrandLogo className="control-brand-logo" />
          </a>
          <div className="control-row">
            {user.roles.some(r => !["customer", "dealer"].includes(r)) && (
              <a href="/admin">Administration</a>
            )}
            <small>{user.email}</small>
            <button
              onClick={() =>
                action(async () => {
                  await api("/logout", {});
                  setUser(null);
                }, "Signed out")
              }
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="control-page-heading">
          <div>
            <div className="control-kicker">FROM IDEA TO INSTALLATION</div>
            <h1>A place for your projects.</h1>
            <p>
              Save a design, explore its performance, and start a conversation
              with our team.
            </p>
          </div>
          <a href="/">Open Studio →</a>
        </div>
        {error && (
          <div role="alert" className="control-error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="control-notice">
            {notice}
          </div>
        )}
        <div className="control-account-grid">
          <aside className="control-card control-account-list">
            <h2>My projects</h2>
            <button
              onClick={() => {
                setSelected(null);
                setName("My solar project");
                setConfiguration(
                  localStorage.getItem("modernite-private-project-input") || ""
                );
                setQuote(null);
              }}
            >
              <Plus size={15} /> Save current Studio design
            </button>
            {projects.map(p => (
              <button
                key={p.id}
                className={selected?.project.id === p.id ? "active" : ""}
                onClick={() => action(() => open(p.id), "Project loaded")}
              >
                <strong>{p.name}</strong>
                <small>
                  Revision {p.revision} ·{" "}
                  {new Date(p.updated_at).toLocaleDateString()}
                </small>
              </button>
            ))}
            {!projects.length && <p>Your saved projects will appear here.</p>}
          </aside>
          <section className="control-card">
            <h2>{selected ? name : "Save your design"}</h2>
            {configuration ? (
              <>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    void action(async () => {
                      const result = await api("/projects", {
                        id: selected?.project.id,
                        name,
                        expectedRevision: selected?.revision,
                        configuration: JSON.parse(configuration),
                      });
                      await open(result.id);
                    }, "Project saved as a new revision");
                  }}
                >
                  <label>
                    Project name
                    <input
                      required
                      maxLength={100}
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </label>
                  {selected && (
                    <label>
                      Saved revision
                      <select
                        value={selected.revision}
                        onChange={e =>
                          action(
                            () =>
                              open(selected.project.id, Number(e.target.value)),
                            "Saved revision loaded"
                          )
                        }
                      >
                        {selected.history.map((r: any) => (
                          <option key={r.revision} value={r.revision}>
                            Revision {r.revision} ·{" "}
                            {new Date(r.created_at).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <details>
                    <summary>Project configuration</summary>
                    <p className="control-help">
                      Your saved building and product layout. You can edit the
                      configuration here or download it. Changes are saved as a
                      new revision.
                    </p>
                    <textarea
                      className="control-json"
                      aria-label="Project configuration"
                      value={configuration}
                      onChange={e => setConfiguration(e.target.value)}
                    />
                  </details>
                  <div className="control-row">
                    <button className="control-primary" disabled={busy}>
                      <Save size={16} />{" "}
                      {selected ? "Save new revision" : "Save project"}
                    </button>
                    {selected && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const result = await api("/projects", {
                              name: `${name} — copy`,
                              configuration: JSON.parse(configuration),
                            });
                            await open(result.id);
                          }, "Separate project saved")
                        }
                      >
                        Save a separate copy
                      </button>
                    )}
                  </div>
                </form>
                {selected && (
                  <>
                    <div className="control-project-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const r = await api(
                              `/projects/${selected.project.id}/calculate`,
                              { revision: selected.revision, useLatest }
                            );
                            await open(r.id);
                          }, "Calculation saved as a new revision")
                        }
                      >
                        {busy ? "Working…" : "Calculate saved design"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          action(
                            async () =>
                              setQuote(
                                await api(
                                  `/projects/${selected.project.id}/quote`,
                                  { revision: selected.revision }
                                )
                              ),
                            "Quotation created"
                          )
                        }
                      >
                        Get approved price
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setShowInquiry(true)}
                      >
                        Request a quotation
                      </button>
                      <button
                        onClick={() => {
                          const blob = new Blob(
                            [JSON.stringify(selected.payload.input, null, 2)],
                            { type: "application/json" }
                          );
                          const url = URL.createObjectURL(blob),
                            a = document.createElement("a");
                          a.href = url;
                          a.download = `modernite-project-r${selected.revision}.json`;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                      >
                        <Download size={15} /> Configuration
                      </button>
                      {selected.payload.study && (
                        <a
                          href={`/api/control/projects/${selected.project.id}/report.pdf?revision=${selected.revision}`}
                        >
                          <Download size={15} /> Download report
                        </a>
                      )}
                    </div>
                    <label>
                      Calculation parameters
                      <select
                        value={String(useLatest)}
                        onChange={e => setUseLatest(e.target.value === "true")}
                      >
                        <option value="false">
                          Keep this project's saved parameter versions
                        </option>
                        <option value="true">
                          Use latest published versions in a new result
                        </option>
                      </select>
                    </label>
                    <p className="control-help">
                      Saved results remain unchanged. A new calculation creates
                      a new revision. Server calculations require a connection.
                    </p>
                    {selected.payload.study && (
                      <div className="control-metrics">
                        <div>
                          <small>CAPACITY</small>
                          <strong>
                            {selected.payload.study.result.totalCapacityKwp.toFixed(
                              2
                            )}
                            <span>kWp</span>
                          </strong>
                        </div>
                        <div>
                          <small>ANNUAL GENERATION</small>
                          <strong>
                            {Math.round(
                              selected.payload.study.result.range.representative
                            ).toLocaleString()}
                            <span>kWh / year</span>
                          </strong>
                        </div>
                        <div>
                          <small>PARAMETERS</small>
                          <strong>
                            Saved<span>Version recorded</span>
                          </strong>
                        </div>
                      </div>
                    )}
                    {quote && (
                      <div className="control-impact">
                        <h3>Quotation {quote.id.slice(0, 8)}</h3>
                        <p>
                          {quote.currency} {quote.total.toLocaleString()} ·{" "}
                          {quote.taxBasis.replaceAll("_", " ")}
                        </p>
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Quantity</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.lines.map((l: any) => (
                              <tr key={l.id}>
                                <td>{l.name}</td>
                                <td>
                                  {l.quantity.toFixed(2)} {l.unit}
                                </td>
                                <td>{l.total.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {showInquiry && (
                      <form
                        className="control-change"
                        onSubmit={e => {
                          e.preventDefault();
                          const data = new FormData(e.currentTarget);
                          void action(async () => {
                            await api("/inquiries", {
                              projectId: selected.project.id,
                              revision: selected.revision,
                              name: data.get("name"),
                              company: data.get("company"),
                              phone: data.get("phone"),
                              preferredContact: data.get("preferredContact"),
                              message: data.get("message"),
                            });
                            setShowInquiry(false);
                          }, "Your inquiry has been submitted. Our team can now follow up on this project revision.");
                        }}
                      >
                        <h3>Tell us what you need</h3>
                        <p className="control-help">
                          Your contact details and this saved design will be
                          used to respond to your request. This does not
                          subscribe you to marketing.
                        </p>
                        <div className="control-fields">
                          <label>
                            Your name
                            <input required name="name" maxLength={100} />
                          </label>
                          <label>
                            Company (optional)
                            <input name="company" maxLength={200} />
                          </label>
                          <label>
                            Phone (optional)
                            <input name="phone" maxLength={50} />
                          </label>
                          <label>
                            Preferred contact
                            <select name="preferredContact">
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          Quotation requirements
                          <textarea
                            required
                            name="message"
                            minLength={2}
                            maxLength={4000}
                          />
                        </label>
                        <button className="control-primary" disabled={busy}>
                          Submit inquiry <ArrowRight size={16} />
                        </button>
                      </form>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="control-empty">
                <Leaf size={30} />
                <h2>Start with a design</h2>
                <p>
                  Open Solar Studio, configure your building and products, then
                  choose “Save project” in the header.
                </p>
                <a href="/">Return to Solar Studio →</a>
              </div>
            )}
          </section>
        </div>
        {inquiries.length > 0 && (
          <section className="control-card" style={{ marginTop: 24 }}>
            <h2>Your inquiries</h2>
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map(r => (
                  <tr key={r.id}>
                    <td>{r.id.slice(0, 8)}</td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
