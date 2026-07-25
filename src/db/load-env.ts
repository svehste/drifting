/**
 * Minimal .env loader for standalone scripts (migrate/seed/check) run via tsx.
 * Next.js loads env itself for the app; this only fills gaps for CLI scripts.
 * Zero dependencies (tech_stack: few dependencies). Loads .env.local then .env,
 * without overwriting variables already present in process.env.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseAndApply(file: string) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const keyPart = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(keyPart in process.env)) {
      process.env[keyPart] = value;
    }
  }
}

// Later files do not override earlier ones; process.env always wins.
parseAndApply(resolve(process.cwd(), ".env.local"));
parseAndApply(resolve(process.cwd(), ".env"));
