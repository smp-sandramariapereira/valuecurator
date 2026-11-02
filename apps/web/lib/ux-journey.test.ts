import assert from "node:assert/strict";
import test from "node:test";
import { presentAsset } from "./asset-verification-view";
import { parsePortfolioDraft, reviewAllocation, simulateRebalance } from "./portfolio-draft";
import { activeNavigationItem, breadcrumbsFor, isProductPath, PRODUCT_NAVIGATION } from "./product-navigation";

test("product navigation keeps existing destinations and marks the longest match", () => {
  const hrefs = PRODUCT_NAVIGATION.flatMap((group) => group.items.map((item) => item.href));
  assert.ok(hrefs.includes("/app"));
  assert.ok(hrefs.includes("/assets"));
  assert.ok(hrefs.includes("/lab"));
  assert.equal(activeNavigationItem("/assets/verify")?.id, "assets-verify");
  assert.equal(activeNavigationItem("/assets/equity:US:AAPL")?.id, "assets-verify");
  assert.equal(activeNavigationItem("/app")?.href, "/app");
  assert.equal(activeNavigationItem("/")?.id, "overview");
  assert.equal(isProductPath("/"), true);
  assert.equal(isProductPath("/about"), false);
  assert.equal(isProductPath("/lab"), true);
  assert.deepEqual(breadcrumbsFor("/portfolio/build").map((crumb) => crumb.label), ["Portfólio", "Construir Portfólio"]);
});

test("allocation accepts only a 100 percent planned composition", () => {
  const ids = ["equity:US:AAPL", "equity:US:MSFT"];
  const valid = reviewAllocation(ids, { "equity:US:AAPL": 60, "equity:US:MSFT": 40 });
  assert.equal(valid.valid, true);
  assert.equal(valid.warnings.length, 1);
  const invalid = reviewAllocation(ids, { "equity:US:AAPL": 70, "equity:US:MSFT": 20 });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /100%/);
  const negative = reviewAllocation(ids, { "equity:US:AAPL": -5, "equity:US:MSFT": 105 });
  assert.equal(negative.valid, false);
});

test("rebalance stays a planned simulation and never an authorization", () => {
  const ids = ["equity:US:AAPL", "equity:US:MSFT"];
  const planned = { "equity:US:AAPL": 50, "equity:US:MSFT": 50 };
  const desired = { "equity:US:AAPL": 30, "equity:US:MSFT": 70 };
  const simulation = simulateRebalance(ids, planned, desired);
  assert.equal(simulation.state, "SIMULATED");
  assert.equal(simulation.basis, "PLANEJADO");
  assert.equal(simulation.rows[0].relation, "acima");
  assert.equal(simulation.rows[1].relation, "abaixo");
  assert.equal(simulateRebalance(ids, planned, { "equity:US:AAPL": 10, "equity:US:MSFT": 10 }).state, "REQUIRES_REVIEW");
  assert.equal("AUTHORIZED" in simulation, false);
});

test("local draft parser rejects anything that is not an experimental draft", () => {
  assert.equal(parsePortfolioDraft({ kind: "on-chain", currency: "USD" }), null);
  const parsed = parsePortfolioDraft({
    kind: "experimental-local-draft",
    name: "Estudo",
    objective: "Aprender",
    horizon: "médio",
    riskProfile: "moderado",
    currency: "USD",
    assetIds: ["equity:US:AAPL"],
    weights: { "equity:US:AAPL": 100 },
    updatedAt: "2026-11-02T00:00:00.000Z",
  });
  assert.equal(parsed?.kind, "experimental-local-draft");
});

test("asset verification does not invent a price or an execution permission", () => {
  const apple = presentAsset({
    assetId: "equity:US:AAPL",
    ticker: "AAPL",
    displayName: "Apple Inc.",
    assetClass: "EQUITY",
    status: "REFERENCE_DOCUMENTED",
    referenceSymbol: "AAPLx",
    network: "mainnet-beta",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    source: "fixture",
    devnetMint: null,
  });
  assert.equal(apple.identityLabel, "Verificação disponível");
  assert.equal(apple.marketDataLabel, "Fonte não consultada nesta sessão");
  assert.equal(apple.executionLabel, "Não habilitada");
  assert.equal(apple.mint, "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp");
  const candidate = presentAsset({
    assetId: "equity:US:NVDA",
    ticker: "NVDA",
    displayName: "NVIDIA Corporation",
    assetClass: "EQUITY",
    status: "CANDIDATE",
    referenceSymbol: null,
    network: null,
    mint: null,
    source: "fixture",
    devnetMint: null,
  });
  assert.equal(candidate.identityLabel, "Identidade não confirmada");
  assert.equal(candidate.mint, "Não disponível");
});
