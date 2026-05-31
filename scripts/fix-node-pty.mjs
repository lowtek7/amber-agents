/**
 * pnpm extracts node-pty's prebuilt `spawn-helper` without the executable bit,
 * so the unix PTY path fails at runtime with `posix_spawnp failed`. Restore +x
 * on every install. No-op on Windows (uses conpty.dll, not spawn-helper).
 */
import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

if (process.platform === "win32") process.exit(0);

const roots = ["node_modules/.pnpm", "node_modules"];
let fixed = 0;

/** Find every file named `spawn-helper` under a dir tree and chmod 0o755. */
function walk(dir, depth = 0) {
  if (depth > 8 || !existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, depth + 1);
    } else if (e.name === "spawn-helper") {
      try {
        chmodSync(p, 0o755);
        fixed++;
      } catch {
        /* ignore */
      }
    }
  }
}

for (const r of roots) walk(r);
if (fixed > 0) console.log(`fix-node-pty: chmod +x on ${fixed} spawn-helper binary(ies)`);
