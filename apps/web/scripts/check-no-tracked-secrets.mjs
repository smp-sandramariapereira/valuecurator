import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const forbiddenPath = /(^|\/)(?:target\/deploy(?:\/|$)|\.env(?:\.|$))|(?:-keypair\.json|\.(?:pem|key))$/i;
const allowedExamples = new Set([
  ".env.example",
  "agent/.env.example",
  ".env.lab.example",
  "apps/web/.env.lab.example",
]);

export function trackedPathViolation(path) {
  if (forbiddenPath.test(path) && !allowedExamples.has(path)) {
    return `${path}: forbidden secret-bearing path`;
  }
  return null;
}

export function trackedContentViolations(path, source) {
  const violations = [];
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)) {
    violations.push(`${path}: private-key PEM marker`);
  }

  if (extname(path).toLowerCase() === ".json") {
    try {
      const value = JSON.parse(source);
      if (
        Array.isArray(value) &&
        value.length === 64 &&
        value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
      ) {
        violations.push(`${path}: probable Solana secret keypair`);
      }
    } catch {
      // Non-JSON content in a .json file is handled by the project's normal checks.
    }
  }
  return violations;
}

function inspectTrackedFiles() {
  const listed = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed: ${listed.stderr.trim()}`);
  }

  const tracked = listed.stdout.split("\0").filter(Boolean);
  const violations = [];

  for (const path of tracked) {
    const pathViolation = trackedPathViolation(path);
    if (pathViolation) {
      violations.push(pathViolation);
      continue;
    }

    let source;
    try {
      source = readFileSync(path, "utf8");
    } catch {
      continue;
    }

    violations.push(...trackedContentViolations(path, source));
  }

  return { tracked, violations };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const { tracked, violations } = inspectTrackedFiles();
  if (violations.length > 0) {
    console.error("Tracked secret check failed:");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(`Tracked secret check passed (${tracked.length} files inspected).`);
  }
}
