import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEVNET_RPC, LOCAL_RPC, rpcEndpoint, rpcRequest, surfpoolArgs } from "./surfpool-profiles.mjs";

describe("Surfpool explicit test profiles", () => {
  it("starts offline without automatic deployment", () => {
    const args = surfpoolArgs("local");
    assert.deepEqual(args.slice(0, 2), ["start", "--host"]);
    assert.ok(args.includes("--offline"));
    assert.ok(args.includes("--no-deploy"));
    assert.ok(!args.includes("--network"));
    assert.equal(rpcEndpoint("local"), LOCAL_RPC);
  });
  it("forks Devnet without submitting transactions to the remote RPC", () => {
    const args = surfpoolArgs("devnet-fork");
    assert.deepEqual(args.slice(-2), ["--network", "devnet"]);
    assert.ok(args.includes("--no-deploy"));
    assert.ok(!args.includes("--offline"));
    assert.equal(rpcEndpoint("devnet-fork"), LOCAL_RPC);
    assert.equal(rpcEndpoint("devnet"), DEVNET_RPC);
  });
  it("rejects unknown profile names", () => {
    assert.throws(() => surfpoolArgs("mainnet"), /Unknown simulator profile/);
    assert.throws(() => rpcEndpoint("mainnet"), /Unknown RPC profile/);
  });
  it("exposes only read-only RPC requests", () => {
    assert.deepEqual(rpcRequest("getVersion"), { jsonrpc: "2.0", id: 1, method: "getVersion" });
    assert.throws(() => rpcRequest("sendTransaction"), /Read-only RPC method/);
  });
});
