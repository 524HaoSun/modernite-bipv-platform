import { createRequire } from "node:module";
import type { DatabaseSync as SQLiteDatabase } from "node:sqlite";
// Loaded on first use so a runtime without node:sqlite can still serve the public calculator.
const loadSqlite = () =>
  createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { catalogue, technical, pricing } from "./baseline";
import type { ControlUser, Release, Domain, Role } from "../../shared/control";

export class ControlError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new ControlError(status, message);
}
export class ControlStore {
  db: SQLiteDatabase;
  constructor(filename: string) {
    if (filename !== ":memory:")
      mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new (loadSqlite().DatabaseSync)(filename);
    if (filename !== ":memory:") chmodSync(filename, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL DEFAULT '',roles TEXT NOT NULL DEFAULT '["customer"]',active INTEGER NOT NULL DEFAULT 1,totp TEXT,totp_step INTEGER NOT NULL DEFAULT -1,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS codes(email TEXT PRIMARY KEY,hash TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL,sent INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS releases(id TEXT PRIMARY KEY,domain TEXT NOT NULL,version INTEGER NOT NULL,status TEXT NOT NULL,base_id TEXT NOT NULL,author TEXT NOT NULL,reviewer TEXT,reason TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,published_at TEXT,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,domain TEXT,detail TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS project_versions(project_id TEXT NOT NULL REFERENCES projects(id),revision INTEGER NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(project_id,revision));
      CREATE TABLE IF NOT EXISTS inquiries(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,revision INTEGER NOT NULL,contact TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',assignee TEXT,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,inquiry_id TEXT NOT NULL REFERENCES inquiries(id),actor TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,owner TEXT NOT NULL,project_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY,owner TEXT NOT NULL,project_id TEXT NOT NULL,revision INTEGER NOT NULL,price_version TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL);
    `);
    this.db
      .prepare("UPDATE releases SET status='approved' WHERE status='published'")
      .run();
    this.db
      .prepare("UPDATE releases SET status='submitted' WHERE status='draft'")
      .run();
    this.transaction(() => {
      for (const [domain, data] of Object.entries({
        catalogue,
        technical,
        pricing,
      })) {
        if (
          !this.db.prepare("SELECT id FROM releases WHERE domain=?").get(domain)
        ) {
          const now = new Date().toISOString();
          this.db
            .prepare(
              "INSERT INTO releases VALUES(?,?,1,'approved','','migration',NULL,?,?,?, ?,?)"
            )
            .run(
              `baseline-${domain}`,
              domain,
              "V31 migration reference; technical approval pending",
              "Modernite report, 2026-09-30",
              now,
              now,
              JSON.stringify(data)
            );
        }
      }
      for (const [domain, data] of Object.entries({
        catalogue,
        technical,
        pricing,
      })) {
        this.db
          .prepare(
            "UPDATE releases SET data=? WHERE domain=? AND author='migration'"
          )
          .run(JSON.stringify(data), domain);
      }
    });
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(
    actor: string,
    action: string,
    target: string,
    domain: Domain | null = null,
    detail: unknown = {}
  ) {
    this.db
      .prepare(
        "INSERT INTO audit(actor,action,target,domain,detail,created_at) VALUES(?,?,?,?,?,?)"
      )
      .run(
        actor,
        action,
        target,
        domain,
        JSON.stringify(detail),
        new Date().toISOString()
      );
  }
  user(id: string): ControlUser | null {
    const r = this.db
      .prepare(
        "SELECT id,email,name,roles,active,created_at FROM users WHERE id=?"
      )
      .get(id) as any;
    return r
      ? {
          id: r.id,
          email: r.email,
          name: r.name,
          roles: JSON.parse(r.roles),
          active: !!r.active,
          createdAt: r.created_at,
        }
      : null;
  }
  byEmail(email: string) {
    const row = this.db
      .prepare("SELECT id FROM users WHERE email=?")
      .get(email);
    return row ? this.user(String(row.id)) : null;
  }
  createUser(email: string, name = "", roles: Role[] = ["customer"]) {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO users(id,email,name,roles,created_at) VALUES(?,?,?,?,?)"
      )
      .run(id, email, name, JSON.stringify(roles), new Date().toISOString());
    return this.user(id)!;
  }
  release(id: string): Release {
    const r = this.db
      .prepare("SELECT * FROM releases WHERE id=?")
      .get(id) as any;
    if (!r) fail(404, "Release not found");
    return {
      id: r.id,
      domain: r.domain,
      version: r.version,
      status: r.status,
      baseId: r.base_id,
      author: r.author,
      reviewer: r.reviewer,
      reason: r.reason,
      source: r.source,
      createdAt: r.created_at,
      publishedAt: r.published_at,
      data: JSON.parse(r.data),
    };
  }
  current(domain: Domain): Release {
    const row = this.db
      .prepare(
        "SELECT id FROM releases WHERE domain=? AND status='approved' ORDER BY version DESC LIMIT 1"
      )
      .get(domain)!;
    return this.release(String(row.id));
  }
  close() {
    this.db.close();
  }
}
let singleton: ControlStore | undefined;
export function controlStore() {
  return (singleton ??= new ControlStore(
    process.env.CONTROL_DB_PATH ||
      path.join(process.env.DATA_DIR || ".data", "control.sqlite")
  ));
}
export const hasRole = (user: ControlUser, ...roles: Role[]) =>
  user.roles.some(r => roles.includes(r));
export function requireRole(user: ControlUser, ...roles: Role[]) {
  if (!user.active || !hasRole(user, ...roles))
    fail(403, "Your role cannot perform this action");
}
