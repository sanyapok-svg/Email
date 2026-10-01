import { randomBytes } from "crypto";

const auth = randomBytes(32).toString("hex");
const cron = randomBytes(24).toString("hex");
const encryption = randomBytes(32).toString("base64");
const password = randomBytes(12).toString("base64url");

console.log(`AUTH_SECRET="${auth}"`);
console.log(`ENCRYPTION_KEY="${encryption}"`);
console.log(`CRON_SECRET="${cron}"`);
console.log(`ADMIN_PASSWORD="${password}"`);
