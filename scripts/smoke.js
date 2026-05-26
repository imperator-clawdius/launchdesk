import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 4188);
const env = {
  ...process.env,
  PORT: String(port),
  DATA_FILE: process.env.DATA_FILE || "./data/smoke.json",
  NODE_ENV: "production",
};

const child = spawn(process.execPath, ["src/server.js"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHealth(port);
  const offer = await postJson(`http://127.0.0.1:${port}/api/offers`, {
    businessName: "LaunchDesk",
    offerName: "Plumbing missed-call recovery",
    niche: "plumbing",
    monthlyPrice: 497,
    setupFee: 997,
    grossMargin: 80,
    proofLevel: 3,
    fulfillmentHours: 2,
    leadSourceStrength: 4,
    promiseClarity: 5,
    targetCustomer: "plumbing company owners",
    outcome: "recover after-hours leak calls",
    channels: ["sms", "voice", "reviews"],
  });
  if (!offer.assets?.outboundEmail?.body) throw new Error("offer assets missing");
  const lead = await postJson(`http://127.0.0.1:${port}/api/leads`, {
    company: "Smoke Test Plumbing",
    niche: "plumbing",
    stage: "qualified",
    value: 497,
    nextAction: "Call owner",
  });
  if (!lead.id) throw new Error("lead create failed");
  const summary = await fetchJson(`http://127.0.0.1:${port}/api/summary`);
  if (summary.offerCount < 1 || summary.leadCount < 1) throw new Error("summary counts missing");
  console.log("Smoke passed", JSON.stringify({ offer: offer.id, lead: lead.id, summary }));
} finally {
  child.kill();
}

async function waitForHealth(portValue) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const health = await fetchJson(`http://127.0.0.1:${portValue}/api/health`);
      if (health.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`server did not start. Output: ${output}`);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}
