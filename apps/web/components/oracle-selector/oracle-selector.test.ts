import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { oracleChoiceCopy, oracleDataFlow } from "./oracle-selector-model.js";

describe("oracle selector copy", () => {
  it("shows the disabled reason instead of a price", () => {
    const copy = oracleChoiceCopy({
      id: "chainlink",
      enabled: false,
      credentialRequired: true,
      costLabel: "hidden",
      licenseLabel: "Disabled until a real feed, terms, and provenance are confirmed.",
    }, null);
    assert.match(copy, /Disabled/);
  });

  it("shows a block reason from the server", () => {
    const copy = oracleChoiceCopy({
      id: "pyth-pro",
      enabled: true,
      credentialRequired: true,
      costLabel: "terms",
      licenseLabel: "license",
    }, "provider is outside the server plan");
    assert.match(copy, /outside the server plan/);
  });
});

describe("oracle data flow", () => {
  it("says the oracles only supply a price to the calculation engine", () => {
    assert.equal(oracleDataFlow.arrow, "data only");
    assert.equal(oracleDataFlow.engine, "Calculation engine");
    assert.match(oracleDataFlow.boundary, /No signature/);
    assert.deepEqual([...oracleDataFlow.checks], ["Age", "Confidence", "Deviation"]);
  });
});
