/** Create or report a password-based staff account. Does not print the password. */
import "dotenv/config";
import { z } from "zod";
import { controlStore } from "../server/control/store";
import { createStaffAccount } from "../server/control/auth";

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_-]{2,31}$/)
  .parse(process.argv[2]);
const role = z.enum(["editor", "approval", "super"]).parse(process.argv[3]);
const password = z.string().min(12).max(200).parse(process.argv[4]);
const name = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .parse(process.argv[5] || username);

const store = controlStore();
const existing = store.db
  .prepare("SELECT username FROM staff_credentials WHERE username=?")
  .get(username);
if (existing) {
  store.close();
  console.error(`Staff username already exists: ${username}`);
  process.exit(1);
}
createStaffAccount(store, null, { username, name, password, role });
store.close();
console.log(`Created ${role} account "${username}". Sign in at /admin with the staff password.`);
