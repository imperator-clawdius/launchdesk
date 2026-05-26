import test from "node:test";
import assert from "node:assert/strict";
import { generateLaunchAssets, scoreOffer } from "../src/scoring.js";

test("scores a focused service offer as ready or pilot", () => {
  const scorecard = scoreOffer({
    niche: "hvac",
    monthlyPrice: 497,
    setupFee: 997,
    grossMargin: 80,
    proofLevel: 3,
    fulfillmentHours: 2,
    leadSourceStrength: 4,
    promiseClarity: 5,
    channels: ["sms", "voice", "reviews"],
  });

  assert.ok(scorecard.score >= 75);
  assert.ok(scorecard.economics.netMrr > 300);
  assert.equal(scorecard.economics.monthlyGross, 497);
});

test("generates usable launch assets", () => {
  const assets = generateLaunchAssets({
    businessName: "LaunchDesk",
    offerName: "Plumbing missed-call recovery",
    niche: "plumbing",
    targetCustomer: "plumbing owners",
    outcome: "recover after-hours leak calls",
    monthlyPrice: 497,
    setupFee: 997,
    grossMargin: 80,
    proofLevel: 3,
    fulfillmentHours: 2,
    leadSourceStrength: 4,
    promiseClarity: 5,
    channels: ["sms", "voice", "reviews"],
  });

  assert.match(assets.oneLiner, /plumbing/i);
  assert.ok(assets.landingPage.bullets.length >= 3);
  assert.match(assets.outboundEmail.body, /missed/i);
  assert.ok(assets.scorecard.score > 0);
});
