/** Run on the server by an authorized operator. Does not email, publish, or deploy. */
import "dotenv/config";
import { z } from "zod";
import { controlStore } from "../server/control/store";
import { seal } from "../server/control/auth";
import { roles } from "../shared/control";
const email = z.string().email().parse(process.argv[2]).trim().toLowerCase();
const assigned = z
  .array(z.enum(roles))
  .min(1)
  .parse((process.argv[3] || "").split(","));
const secret = z
  .string()
  .regex(/^[A-Z2-7]{16,128}$/)
  .parse(process.env.CONTROL_TOTP_SECRET);
const store = controlStore();
store.transaction(() => {
  const user = store.byEmail(email) ?? store.createUser(email);
  store.db
    .prepare("UPDATE users SET roles=?,totp=?,totp_step=-1,active=1 WHERE id=?")
    .run(JSON.stringify(assigned), seal(secret), user.id);
  store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
  store.audit("server-operator", "account.provisioned", user.id, null, {
    roles: assigned,
  });
});
store.close();
console.log(
  "Staff account provisioned. Sign in with an email code and the enrolled authenticator."
);
