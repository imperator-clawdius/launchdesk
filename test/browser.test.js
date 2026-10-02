import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createApp } from "../src/server.js";
import { JsonStore } from "../src/store.js";

async function openWorkspace(t) {
  const dir = await mkdtemp(join(tmpdir(), "launchdesk-browser-"));
  const server = createApp({ store: new JsonStore(join(dir, "workspace.json")) }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
    assert.deepEqual(errors, [], "forms must complete without browser errors");
  });
  // Exercise only the local app; icons do not require a third-party request.
  await page.route("https://unpkg.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  await page.goto(baseUrl);
  await page.waitForFunction(() => document.querySelectorAll(".offer-card").length === 2);
  return { page, baseUrl };
}

test("default prices allow creating an offer and a lead through the browser", async (t) => {
  const { page, baseUrl } = await openWorkspace(t);
  await page.locator('#offerForm [name="offerName"]').fill("Browser test offer");
  assert.equal(await page.locator("#offerForm").evaluate((form) => form.checkValidity()), true);
  const offerResponse = page.waitForResponse((response) => response.url().endsWith("/api/offers")
    && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create offer", exact: true }).click();
  assert.equal((await offerResponse).status(), 201);
  await page.waitForFunction(() => document.querySelectorAll(".offer-card").length === 3);

  await page.getByRole("button", { name: "Leads", exact: true }).click();
  await page.locator('#leadForm [name="company"]').fill("Browser test company");
  assert.equal(await page.locator("#leadForm").evaluate((form) => form.checkValidity()), true);
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("#leadRows tr").length === 3);
  assert.equal(await page.locator('#leadForm [name="company"]').inputValue(), "");

  const exported = await (await fetch(`${baseUrl}/api/export`)).json();
  assert.equal(exported.offers[0].offerName, "Browser test offer");
  assert.equal(exported.offers[0].setupFee, 997);
  assert.equal(exported.leads[0].company, "Browser test company");
  assert.equal(exported.leads[0].value, 497);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("#leadRows tr").length === 3);
  assert.equal(await page.locator(".offer-card h3").first().textContent(), "Browser test offer");
  assert.equal(await page.locator("#leadRows tr td").first().textContent(), "Browser test company");
});

test("a saved lead clears the form and refreshes the pipeline without another submit", async (t) => {
  const { page, baseUrl } = await openWorkspace(t);
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  await page.locator('#leadForm [name="company"]').fill("Single submission company");
  await page.locator('#leadForm [name="value"]').fill("500");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("#leadRows tr").length === 3, null, { timeout: 5000 });
  assert.equal(await page.locator('#leadForm [name="company"]').inputValue(), "");
  assert.equal(await page.locator("#pipelineValue").textContent(), "$1,294");
  const leads = await (await fetch(`${baseUrl}/api/leads`)).json();
  assert.equal(leads.filter((lead) => lead.company === "Single submission company").length, 1);
});
