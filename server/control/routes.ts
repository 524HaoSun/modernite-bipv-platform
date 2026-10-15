import {
  Router,
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import {
  ControlError,
  ControlStore,
  controlStore,
  fail,
  requireRole,
  hasRole,
} from "./store";
import {
  sessionUser,
  requestCode,
  verifyCode,
  setSession,
  logout,
  sendLoginEmail,
  sendProjectResumeEmail,
  limit,
  createStaffAccount,
  passwordLogin,
  seedStaffFromEnv,
  resetStaffPassword,
} from "./auth";
import {
  isControlPreview,
  previewLogin,
  previewLoginStatus,
  type PreviewAccount,
} from "./preview";
import {
  beginGoogleOAuth,
  finishGoogleOAuth,
  googleOAuthConfigured,
} from "./google-oauth";
import {
  domains,
  roles,
  parseDomain,
  type ControlUser,
  type Domain,
  type Technical,
} from "../../shared/control";
import {
  canReadDomain,
  submitRelease,
  transition,
  publicCatalogue,
  impact,
} from "./releases";
import {
  savePrivateProject,
  projectVersion,
  calculatePrivateProject,
  createReport,
  quoteProject,
  reportView,
} from "./projects";
const email = z.string().trim().toLowerCase().email().max(254);
const reason = z.string().trim().min(8).max(2000);
const id = z.string().min(1).max(100);
const analyticsVisit = z.object({
  visitor: z.string().uuid(),
  path: z.string().trim().min(1).max(200),
});
const staffUsername = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{2,31}$/);
const staffPassword = z.string().min(12).max(200);
export function registerControlRoutes(
  app: Express,
  getStore: () => ControlStore = controlStore,
  send = sendLoginEmail,
  loginStatus = previewLoginStatus
) {
  try {
    seedStaffFromEnv(getStore());
  } catch (error) {
    console.warn(
      "[control] Staff seed skipped",
      error instanceof Error ? error.message : "unknown error"
    );
  }
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET" && req.method !== "HEAD") {
      const allowed =
        process.env.PUBLIC_BASE_URL ||
        (process.env.NODE_ENV !== "production"
          ? `${req.protocol}://${req.get("host")}`
          : "");
      if (!allowed || req.headers.origin !== new URL(allowed).origin)
        return void res
          .status(403)
          .json({ error: "This request must come from the Modernite website" });
      if (!req.is("application/json"))
        return void res.status(415).json({ error: "Use application/json" });
    }
    next();
  });
  const endpoint =
    (
      fn: (
        req: Request,
        res: Response,
        store: ControlStore,
        user: ControlUser | null
      ) => unknown,
      auth = true
    ) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve()
        .then(() => {
          const store = getStore(),
            user = sessionUser(store, req);
          if (auth && !user) fail(401, "Sign in to continue");
          return fn(req, res, store, user);
        })
        .catch(next);
    };
  router.get(
    "/session",
    endpoint((_req, res, _store, user) => res.json({ user }), false)
  );
  router.post(
    "/analytics/visit",
    endpoint((req, res, store) => {
      const input = analyticsVisit.parse(req.body);
      const today = new Date().toISOString().slice(0, 10);
      const alreadyRecorded = store.db
        .prepare(
          "SELECT id FROM analytics_events WHERE event='visit' AND visitor=? AND path=? AND substr(created_at,1,10)=?"
        )
        .get(input.visitor, input.path, today);
      if (!alreadyRecorded)
        store.db
          .prepare(
            "INSERT INTO analytics_events(id,event,visitor,path,created_at) VALUES(?,?,?,?,?)"
          )
          .run(randomUUID(), "visit", input.visitor, input.path, new Date().toISOString());
      res.status(201).json({ ok: true });
    }, false)
  );
  router.get("/login/status", (_req, res) => {
    const status = loginStatus();
    res.json({
      ...status,
      googleOAuth: status.googleOAuth ?? googleOAuthConfigured(),
    });
  });
  router.get("/oauth/google/start", (req, res, next) => {
    try {
      const url = beginGoogleOAuth(res, {
        returnTo:
          typeof req.query.returnTo === "string" ? req.query.returnTo : "/account",
        emailHint: typeof req.query.email === "string" ? req.query.email : undefined,
        projectId:
          typeof req.query.project === "string" ? req.query.project : undefined,
        inquire: req.query.inquire === "1",
      });
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  });
  router.get("/oauth/google/callback", async (req, res, next) => {
    try {
      const dest = await finishGoogleOAuth(getStore(), req, res);
      res.redirect(dest);
    } catch (error) {
      if (error instanceof ControlError) {
        res.redirect(
          `/account?oauth_error=${encodeURIComponent(error.message)}`
        );
        return;
      }
      next(error);
    }
  });
  if (isControlPreview()) {
    router.post(
      "/preview/login",
      endpoint((req, res, store) => {
        const input = z
          .object({ account: z.enum(["admin", "reviewer"]) })
          .parse(req.body);
        res.json(previewLogin(store, input.account as PreviewAccount, res));
      }, false)
    );
  }
  router.post(
    "/login/request",
    endpoint(async (req, res, store) => {
      const status = loginStatus();
      if (!status.available) fail(503, status.message);
      const input = z.object({ email }).parse(req.body);
      limit(
        store,
        `ip:${createHash("sha256")
          .update(req.ip || "unknown")
          .digest("hex")}`,
        30,
        3600000
      );
      await requestCode(store, input.email, send);
      res.json({
        message: "Check your email for a code. It expires in 10 minutes.",
      });
    }, false)
  );
  router.post(
    "/login/verify",
    endpoint((req, res, store) => {
      const input = z
        .object({
          email,
          code: z.string().regex(/^\d{6}$/),
          authenticator: z
            .string()
            .regex(/^\d{6}$/)
            .or(z.literal(""))
            .default(""),
        })
        .parse(req.body);
      const result = verifyCode(
        store,
        input.email,
        input.code,
        input.authenticator
      );
      setSession(res, result.token, result.expires);
      res.json({ user: result.user });
    }, false)
  );
  router.post(
    "/login/password",
    endpoint((req, res, store) => {
      const input = z.object({ username: staffUsername, password: staffPassword }).parse(req.body);
      const result = passwordLogin(store, input.username, input.password);
      setSession(res, result.token, result.expires);
      res.json({ user: result.user });
    }, false)
  );
  router.post(
    "/logout",
    endpoint((req, res, store) => {
      logout(store, req, res);
      res.json({ ok: true });
    }, false)
  );
  router.get(
    "/report-view/:token",
    endpoint(
      (req, res) =>
        res.json(reportView(z.string().min(20).max(64).parse(req.params.token))),
      false
    )
  );
  router.get(
    "/catalogue",
    endpoint((_req, res, store) => res.json(publicCatalogue(store)), false)
  );
  router.get(
    "/admin/releases",
    endpoint((req, res, store, user) => {
      requireRole(user!, "product", "technical", "pricing", "editor", "approval", "super");
      const rows = store.db
        .prepare("SELECT id FROM releases ORDER BY created_at DESC LIMIT 500")
        .all();
      res.json(
        rows
          .map(r => store.release(String(r.id)))
          .filter(r => canReadDomain(user!, r.domain))
      );
    })
  );
  router.get(
    "/admin/current",
    endpoint((_req, res, store, user) => {
      requireRole(user!, "product", "technical", "pricing", "editor", "approval", "super");
      res.json(
        Object.fromEntries(
          domains
            .filter(d => canReadDomain(user!, d))
            .map(d => [d, store.current(d)])
        )
      );
    })
  );
  router.post(
    "/admin/submissions",
    endpoint((req, res, store, user) => {
      const input = z
        .object({
          domain: z.enum(domains),
          data: z.unknown(),
          baseId: id,
          reason,
          source: z.string().trim().min(3).max(1000),
        })
        .parse(req.body);
      res
        .status(201)
        .json(submitRelease(store, user!, { ...input, data: input.data }));
    })
  );
  router.post(
    "/admin/releases/:id/:action",
    endpoint((req, res, store, user) => {
      const action = z.enum(["approve"]).parse(req.params.action);
      res.json(transition(store, user!, id.parse(req.params.id), action));
    })
  );
  router.post(
    "/admin/impact",
    endpoint((req, res, store, user) => {
      requireRole(user!, "product", "technical", "editor", "super");
      res.json(
        impact(
          parseDomain("technical", req.body) as Technical,
          store.current("technical").data as Technical
        )
      );
    })
  );
  router.get(
    "/admin/audit",
    endpoint((_req, res, store, user) => {
      requireRole(user!, "product", "technical", "pricing", "editor", "approval", "sales", "super");
      const rows = store.db
        .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 250")
        .all();
      res.json(
        rows.filter(r =>
          r.domain
            ? canReadDomain(user!, r.domain as Domain)
            : hasRole(user!, "super", "editor", "approval", "sales") || r.actor === user!.id
        )
      );
    })
  );
  router.get(
    "/admin/users",
    endpoint((_req, res, store, user) => {
      requireRole(user!, "super");
      const rows = store.db
        .prepare(
          `SELECT u.id,c.username
           FROM users u LEFT JOIN staff_credentials c ON c.user_id=u.id
           ORDER BY c.username IS NULL,u.created_at DESC LIMIT 500`
        )
        .all() as { id: string; username: string | null }[];
      res.json(
        rows.map(row => ({ ...store.user(row.id), username: row.username }))
      );
    })
  );
  router.post(
    "/admin/staff-accounts",
    endpoint((req, res, store, user) => {
      requireRole(user!, "super");
      const input = z
        .object({
          username: staffUsername,
          name: z.string().trim().min(2).max(100),
          password: staffPassword,
          role: z.enum(["editor", "approval", "super"]),
        })
        .parse(req.body);
      res.status(201).json(createStaffAccount(store, user!, input));
    })
  );
  router.get(
    "/admin/projects",
    endpoint((_req, res, store, user) => {
      requireRole(user!, "sales", "editor", "approval", "super");
      res.json(
        store.db
          .prepare(
            `SELECT p.id,p.name,p.revision,p.updated_at,u.email
             FROM projects p JOIN users u ON u.id=p.owner
             ORDER BY p.updated_at DESC LIMIT 500`
          )
          .all()
      );
    })
  );
  router.get(
    "/admin/analytics",
    endpoint((_req, res, store, user) => {
      requireRole(user!, "sales", "editor", "approval", "super");
      const scalar = (sql: string, ...params: any[]) =>
        Number((store.db.prepare(sql).get(...params) as { count: number }).count);
      const sinceSevenDays = new Date(Date.now() - 6 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const daily = store.db
        .prepare(
          `SELECT substr(created_at,1,10) AS day,
                  COUNT(*) AS visits,
                  COUNT(DISTINCT visitor) AS visitors
           FROM analytics_events
           WHERE event='visit' AND substr(created_at,1,10) >= ?
           GROUP BY substr(created_at,1,10)
           ORDER BY day DESC`
        )
        .all(sinceSevenDays) as { day: string; visits: number; visitors: number }[];
      const reports = store.db
        .prepare(
          `SELECT substr(created_at,1,10) AS day, COUNT(*) AS reports
           FROM reports WHERE substr(created_at,1,10) >= ?
           GROUP BY substr(created_at,1,10)`
        )
        .all(sinceSevenDays) as { day: string; reports: number }[];
      const calculations = store.db
        .prepare(
          `SELECT substr(updated_at,1,10) AS day, COUNT(*) AS calculations
           FROM projects WHERE substr(updated_at,1,10) >= ?
           GROUP BY substr(updated_at,1,10)`
        )
        .all(sinceSevenDays) as { day: string; calculations: number }[];
      const dayMap = new Map(daily.map(day => [day.day, day]));
      for (const report of reports) {
        const row = dayMap.get(report.day) ?? { day: report.day, visits: 0, visitors: 0 };
        (row as typeof row & { reports?: number }).reports = report.reports;
        dayMap.set(report.day, row);
      }
      for (const calculation of calculations) {
        const row = dayMap.get(calculation.day) ?? { day: calculation.day, visits: 0, visitors: 0 };
        (row as typeof row & { calculations?: number }).calculations = calculation.calculations;
        dayMap.set(calculation.day, row);
      }
      res.json({
        totals: {
          visits: scalar("SELECT COUNT(*) AS count FROM analytics_events WHERE event='visit'"),
          uniqueVisitors: scalar("SELECT COUNT(DISTINCT visitor) AS count FROM analytics_events WHERE event='visit'"),
          visitsLast7Days: scalar("SELECT COUNT(*) AS count FROM analytics_events WHERE event='visit' AND substr(created_at,1,10)>=?", sinceSevenDays),
          savedCalculations: scalar("SELECT COUNT(*) AS count FROM projects"),
          generatedReports: scalar("SELECT COUNT(*) AS count FROM reports"),
          quoteRequests: scalar("SELECT COUNT(*) AS count FROM inquiries WHERE source='quote'"),
          advisorConversations: scalar("SELECT COUNT(*) AS count FROM inquiries WHERE source='advisor'"),
        },
        daily: Array.from(dayMap.values())
          .map(row => ({ ...row, reports: (row as { reports?: number }).reports ?? 0, calculations: (row as { calculations?: number }).calculations ?? 0 }))
          .sort((a, b) => b.day.localeCompare(a.day)),
      });
    })
  );
  router.get(
    "/admin/projects/:id/detail",
    endpoint((req, res, store, user) => {
      requireRole(user!, "sales", "editor", "approval", "super");
      const projectId = id.parse(req.params.id);
      const project = store.db
        .prepare(
          `SELECT p.id,p.name,p.revision,p.updated_at,u.email
           FROM projects p JOIN users u ON u.id=p.owner WHERE p.id=?`
        )
        .get(projectId) as any;
      if (!project) fail(404, "Project not found");
      const version = store.db
        .prepare(
          "SELECT payload,created_at FROM project_versions WHERE project_id=? AND revision=?"
        )
        .get(projectId, project.revision) as any;
      if (!version) fail(404, "Project version not found");
      res.json({
        project,
        savedAt: version.created_at,
        payload: JSON.parse(String(version.payload)),
      });
    })
  );
  router.post(
    "/admin/users/:id",
    endpoint((req, res, store, user) => {
      requireRole(user!, "super");
      const input = z
        .object({
          roles: z.array(z.enum(roles)).min(1),
          active: z.boolean(),
          reason,
        })
        .parse(req.body);
      const target = store.user(id.parse(req.params.id));
      if (!target) fail(404, "Account not found");
      if (target.id === user!.id)
        fail(409, "Ask another super administrator to change your access");
      const factor = store.db
        .prepare("SELECT totp FROM users WHERE id=?")
        .get(target.id);
      const credential = store.db
        .prepare("SELECT user_id FROM staff_credentials WHERE user_id=?")
        .get(target.id);
      if (input.roles.some(r => r !== "customer") && !factor?.totp && !credential)
        fail(
          409,
          "Enroll this person's authenticator using the server provisioning command before granting staff access"
        );
      store.transaction(() => {
        store.db
          .prepare("UPDATE users SET roles=?,active=? WHERE id=?")
          .run(
            JSON.stringify(Array.from(new Set(input.roles))),
            input.active ? 1 : 0,
            target.id
          );
        store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
        store.audit(user!.id, "account.changed", target.id, null, {
          before: { roles: target.roles, active: target.active },
          after: input,
        });
      });
      res.json(store.user(target.id));
    })
  );
  router.post(
    "/admin/users/:id/revoke",
    endpoint((req, res, store, user) => {
      requireRole(user!, "super");
      const target = id.parse(req.params.id);
      store.transaction(() => {
        store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(target);
        store.audit(user!.id, "sessions.revoked", target);
      });
      res.json({ ok: true });
    })
  );
  router.post(
    "/admin/staff-accounts/:id/password",
    endpoint((req, res, store, user) => {
      requireRole(user!, "super");
      const target = id.parse(req.params.id);
      resetStaffPassword(
        store,
        user!,
        target,
        z.object({ password: staffPassword }).parse(req.body).password
      );
      res.json({ ok: true });
    })
  );
  router.get(
    "/projects",
    endpoint((_req, res, store, user) =>
      res.json(
        store.db
          .prepare(
            "SELECT * FROM projects WHERE owner=? ORDER BY updated_at DESC LIMIT 200"
          )
          .all(user!.id)
      )
    )
  );
  router.post(
    "/projects",
    endpoint((req, res, store, user) => {
      const input = z
        .object({
          id: id.optional(),
          name: z.string().trim().min(1).max(100),
          expectedRevision: z.number().int().positive().optional(),
          configuration: z.unknown(),
        })
        .parse(req.body);
      res.status(201).json(
        savePrivateProject(store, user!, {
          ...input,
          configuration: input.configuration,
        })
      );
    })
  );
  router.post(
    "/projects/capture",
    endpoint(async (req, res, store) => {
      const input = z
        .object({
          email: email.optional().or(z.literal("")),
          name: z.string().trim().min(1).max(100).default("My solar project"),
          configuration: z.unknown(),
        })
        .parse(req.body);
      limit(
        store,
        `capture:${createHash("sha256").update(req.ip || "unknown").digest("hex")}`,
        20,
        3600000
      );
      const recipient = input.email || undefined;
      const owner =
        (recipient && store.byEmail(recipient)) ||
        store.createUser(
          recipient || `guest-${randomUUID()}@anonymous.invalid`,
          recipient ? "" : "Guest calculation"
        );
      const saved = savePrivateProject(store, owner, {
        name: input.name,
        configuration: input.configuration,
      });
      const calculated = await calculatePrivateProject(
        store,
        owner,
        saved.id,
        saved.revision,
        false
      );
      const report = await createReport(
        store,
        owner,
        calculated.id,
        calculated.revision
      );
      let emailSent = false;
      if (recipient) {
        try {
          await sendProjectResumeEmail(recipient, {
            id: calculated.id,
            name: input.name,
          });
          emailSent = true;
          store.audit(owner.id, "project.resume_email_sent", calculated.id);
        } catch (error) {
          console.warn("[projects] Saved project but could not send resume email");
        }
      }
      res.status(201).json({
        id: calculated.id,
        revision: calculated.revision,
        reportId: report.reportId,
        emailSent,
        message: recipient
          ? emailSent
            ? "Your project is saved. Check your email for the secure return link."
            : "Your project is saved, but the return email could not be sent."
          : "Your calculation is saved privately. Add an email next time to return to it on another device.",
      });
    }, false)
  );
  router.get(
    "/projects/:id",
    endpoint((req, res, store, user) => {
      const revision = req.query.revision
        ? z.coerce.number().int().positive().parse(req.query.revision)
        : undefined;
      const result = projectVersion(
        store,
        user!,
        id.parse(req.params.id),
        revision
      );
      const history = store.db
        .prepare(
          "SELECT revision,created_at FROM project_versions WHERE project_id=? ORDER BY revision DESC"
        )
        .all(req.params.id);
      res.json({ ...result, history });
    })
  );
  router.post(
    "/projects/:id/calculate",
    endpoint(async (req, res, store, user) => {
      const input = z
        .object({
          revision: z.number().int().positive(),
          useLatest: z.boolean().default(false),
        })
        .parse(req.body);
      limit(store, `calc:${user!.id}`, 20, 3600000);
      res.json(
        await calculatePrivateProject(
          store,
          user!,
          id.parse(req.params.id),
          input.revision,
          input.useLatest
        )
      );
    })
  );
  router.get(
    "/projects/:id/report.pdf",
    endpoint(async (req, res, store, user) => {
      const revision = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.query.revision);
      const language = z
        .string()
        .regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/)
        .catch("en")
        .parse(req.query.lang ?? "en");
      const result = await createReport(
        store,
        user!,
        id.parse(req.params.id),
        revision,
        language
      );
      res
        .type("application/pdf")
        .setHeader(
          "Content-Disposition",
          `attachment; filename="modernite-${result.reportId}.pdf"`
        );
      res.send(Buffer.from(result.bytes));
    })
  );
  router.post(
    "/projects/:id/quote",
    endpoint((req, res, store, user) => {
      const input = z
        .object({ revision: z.number().int().positive() })
        .strict()
        .parse(req.body);
      res.json(
        quoteProject(store, user!, id.parse(req.params.id), input.revision)
      );
    })
  );
  router.get(
    "/quotes",
    endpoint((_req, res, store, user) => {
      res.json(
        store.db
          .prepare(
            "SELECT id,project_id,revision,payload,created_at FROM quotes WHERE owner=? ORDER BY created_at DESC"
          )
          .all(user!.id)
          .map(r => ({ ...r, payload: JSON.parse(String(r.payload)) }))
      );
    })
  );
  router.post(
    "/inquiries",
    endpoint((req, res, store, user) => {
      const input = z
        .object({
          projectId: id,
          revision: z.number().int().positive(),
          name: z.string().trim().min(1).max(100),
          company: z.string().max(200).default(""),
          phone: z.string().max(50).default(""),
          preferredContact: z.enum(["email", "phone"]),
          message: z.string().trim().min(2).max(4000),
        })
        .parse(req.body);
      projectVersion(store, user!, input.projectId, input.revision);
      const inquiryId = randomUUID();
      store.transaction(() => {
        store.db
          .prepare(
            "INSERT INTO inquiries(id,owner,project_id,revision,contact,message,created_at,source) VALUES(?,?,?,?,?,?,?,?)"
          )
          .run(
            inquiryId,
            user!.id,
            input.projectId,
            input.revision,
            JSON.stringify({
              name: input.name,
              company: input.company,
              phone: input.phone,
              email: user!.email,
              preferredContact: input.preferredContact,
            }),
            input.message,
            new Date().toISOString(),
            "quote"
          );
        store.audit(user!.id, "inquiry.created", inquiryId);
      });
      res.status(201).json({ id: inquiryId });
    })
  );
  router.get(
    "/inquiries",
    endpoint((_req, res, store, user) =>
      res.json(
        store.db
          .prepare(
            "SELECT id,project_id,revision,status,created_at,message FROM inquiries WHERE owner=? ORDER BY created_at DESC"
          )
          .all(user!.id)
      )
    )
  );
  router.get(
    "/admin/inquiries",
    endpoint((_req, res, store, user) => {
      requireRole(user!, "sales", "editor", "approval", "super");
      res.json(
        store.db
          .prepare(
            "SELECT * FROM inquiries WHERE assignee=? OR assignee IS NULL ORDER BY created_at DESC LIMIT 250"
          )
          .all(user!.id)
          .map(r =>
            r.assignee === user!.id
              ? {
                  ...r,
                  contact: JSON.parse(String(r.contact)),
                  notes: store.db
                    .prepare(
                      "SELECT actor,body,created_at FROM notes WHERE inquiry_id=? ORDER BY created_at"
                    )
                    .all(r.id),
                }
              : {
                  id: r.id,
                  status: r.status,
                  created_at: r.created_at,
                  assignee: null,
                  source: r.source,
                }
          )
      );
    })
  );
  router.post(
    "/admin/inquiries/:id",
    endpoint((req, res, store, user) => {
      requireRole(user!, "sales", "editor", "approval", "super");
      const input = z
        .object({
          claim: z.boolean().optional(),
          status: z
            .enum(["new", "contacted", "qualified", "quoted", "won", "closed"])
            .optional(),
          note: z.string().trim().min(1).max(4000).optional(),
        })
        .parse(req.body);
      store.transaction(() => {
        const row = store.db
          .prepare("SELECT * FROM inquiries WHERE id=?")
          .get(id.parse(req.params.id));
        if (!row) fail(404, "Inquiry not found");
        if (input.claim && row.assignee === null)
          store.db
            .prepare("UPDATE inquiries SET assignee=? WHERE id=?")
            .run(user!.id, row.id);
        else if (row.assignee !== user!.id)
          fail(403, "This inquiry is not assigned to you");
        if (input.status)
          store.db
            .prepare("UPDATE inquiries SET status=? WHERE id=?")
            .run(input.status, row.id);
        if (input.note)
          store.db
            .prepare("INSERT INTO notes VALUES(?,?,?,?,?)")
            .run(
              randomUUID(),
              row.id,
              user!.id,
              input.note,
              new Date().toISOString()
            );
        store.audit(user!.id, "inquiry.updated", String(row.id), null, {
          status: input.status,
          claimed: input.claim,
          noteAdded: !!input.note,
        });
      });
      res.json({ ok: true });
    })
  );
  router.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError)
        res.status(400).json({
          error: error.issues
            .map(i => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
      else if (error instanceof ControlError)
        res.status(error.status).json({ error: error.message });
      else {
        console.error(
          "[control] Request failed",
          error instanceof Error ? error.name : "UnknownError"
        );
        res.status(500).json({
          error:
            "The request could not be completed. Your saved records have been preserved.",
        });
      }
    }
  );
  app.use("/api/control", router);
}
