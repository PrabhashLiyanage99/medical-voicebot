import { readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const env = readFileSync(".env", "utf8");
if (/^\s*ADMIN_PASSWORD\s*=/m.test(env)) {
  console.log("ADMIN_PASSWORD already exists; preserved its value.");
} else {
  appendFileSync(".env", `\n# Local admin dashboard password\nADMIN_PASSWORD="${randomBytes(24).toString("base64url")}"\n`);
  console.log("Generated ADMIN_PASSWORD in .env. Read it locally to sign in; restart Next.js.");
}
