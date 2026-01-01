
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

const db = new Database(":memory:");

try {
    console.log("Initializing auth...");
    const auth = betterAuth({
        database: db as any,
        emailAndPassword: { enabled: true }
    });
    console.log("Auth initialized successfully");
} catch (e: any) {
    console.error("Initialization failed:", e.message);
}
