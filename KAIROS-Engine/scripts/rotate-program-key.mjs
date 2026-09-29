import { Keypair } from "@solana/web3.js";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const keyPath = resolve("target/deploy/kairos_engine-keypair.json");
if (existsSync(keyPath)) {
  throw new Error(
    `Refusing to overwrite existing deploy key at ${keyPath}. Back it up and remove it explicitly before rotating again.`,
  );
}

const ignored = spawnSync("git", ["check-ignore", "-q", keyPath], {
  stdio: "ignore",
});
if (ignored.status !== 0) {
  throw new Error(
    `Refusing to create ${keyPath}: the deploy key is not covered by .gitignore.`,
  );
}

const programSourcePath = "programs/kairos-engine/src/lib.rs";
const programSource = readFileSync(programSourcePath, "utf8");
const match = programSource.match(/declare_id!\("([1-9A-HJ-NP-Za-km-z]+)"\)/);
if (!match) {
  throw new Error(`Could not read the current Program ID from ${programSourcePath}`);
}
const currentId = match[1];

const files = [
  programSourcePath,
  "Anchor.toml",
  ".env.example",
  "agent/.env.example",
  "agent/src/config.ts",
  "lib/kairos.ts",
  "idl/kairos_engine.json",
  "README.md",
];

const sources = new Map();
for (const path of files) {
  const source = readFileSync(path, "utf8");
  if (!source.includes(currentId)) {
    throw new Error(
      `Rotation aborted before creating a key: ${path} does not contain current Program ID ${currentId}`,
    );
  }
  sources.set(path, source);
}

const keypair = Keypair.generate();
const nextId = keypair.publicKey.toBase58();
mkdirSync(dirname(keyPath), { recursive: true });
writeFileSync(keyPath, JSON.stringify(Array.from(keypair.secretKey)) + "\n", {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});
chmodSync(keyPath, 0o600);

for (const [path, source] of sources) {
  writeFileSync(path, source.split(currentId).join(nextId), "utf8");
}

const remaining = files.filter((path) =>
  readFileSync(path, "utf8").includes(currentId),
);
if (remaining.length > 0) {
  throw new Error(
    `Program ID replacement incomplete in: ${remaining.join(", ")}`,
  );
}

console.log(`Rotated KAIROS Program ID: ${currentId} -> ${nextId}`);
console.log(`Private deploy key created locally at ${keyPath} with mode 0600.`);
console.log("Back up the key in an approved secret manager. Never commit or print it.");
console.log("Next: pnpm anchor:build && pnpm test:e2e");
