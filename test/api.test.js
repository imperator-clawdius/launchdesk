import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server.js";
import { JsonStore } from "../src/store.js";

test("API creates offers, leads, and summary", async () => {
  const dir = await mkdtemp(join(tmpdir(), "launchdesk-"));
  const server = createApp({ store: new JsonStore(join(dir, "test.json")) }).listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await get(`${baseUrl}/api/health`);
    assert.equal(health.ok, true);

    const offer = await post(`${baseUrl}/api/offers`, {
      businessName: "LaunchDesk",
      offerName: "Dental reactivation",
      niche: "dental",
      monthlyPrice: 397,
      setupFee: 799,
      grossMargin: 76,
      proofLevel: 2,
      fulfillmentHours: 2,
      leadSourceStrength: 3,
      promiseClarity: 4,
      targetCustomer: "dental office owners",
      outcome: "fill empty chair time",
      channels: ["sms", "email"],
    });
    assert.ok(offer.id);
    assert.ok(offer.assets.oneLiner);

    const lead = await post(`${baseUrl}/api/leads`, {
      company: "Bright Dental",
      niche: "dental",
      stage: "outreach",
      value: 397,
      nextAction: "Send reactivation script",
    });
    assert.ok(lead.id);

    const summary = await get(`${baseUrl}/api/summary`);
    assert.ok(summary.offerCount >= 1);
    assert.ok(summary.leadCount >= 1);
    assert.ok(summary.projectedMrr > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

async function get(url) {
  const res = await fetch(url);
  assert.equal(res.ok, true);
  return res.json();
}

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(res.ok, true);
  return res.json();
}
