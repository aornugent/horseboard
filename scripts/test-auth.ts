
import { auth } from "../src/server/lib/auth-instance";
import Database from "better-sqlite3";
import { runMigrations } from "../src/server/db/migrate";
import { join } from "path";

const db = new Database("./data/horseboard.db");
const MIGRATIONS_DIR = join(process.cwd(), "src/server/db/migrations");

console.log("Running migrations...");
runMigrations(db, MIGRATIONS_DIR);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
const tableNames = tables.map(t => t.name);

console.log("Tables found:", tableNames);

const required = ['users', 'sessions', 'accounts', 'verifications', 'controller_tokens'];
const missing = required.filter(t => !tableNames.includes(t));

if (missing.length > 0) {
    console.error("Missing tables:", missing);
    process.exit(1);
}

console.log("All auth tables present.");

// Test signup
async function testSignup() {
    console.log("Testing signup...");
    try {
        const user = await auth.api.signUpEmail({
            body: {
                email: "test@example.com",
                password: "password123",
                name: "Test User"
            }
        });
        console.log("Signup successful:", user);
    } catch (e: any) {
        if (e.message.includes("User already exists")) {
            console.log("User already exists, skipping signup.");
        } else {
            console.error("Signup failed:", e);
            process.exit(1);
        }
    }
}

testSignup();
