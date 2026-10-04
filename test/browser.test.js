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
  return { page, baseUrl, dataFile: join(dir, "workspace.json") };
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

test("an existing lead can advance stage and retain its next action across reloads", async (t) => {
  const { page, baseUrl, dataFile } = await openWorkspace(t);
  const before = (await (await fetch(`${baseUrl}/api/leads`)).json())[0];
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  const edit = page.getByRole("button", { name: `Edit ${before.company}`, exact: true });
  assert.equal(await edit.count(), 1, "existing leads need an editable pipeline action");
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Update lead", exact: true });
  assert.equal(await dialog.getByRole("combobox", { name: "Stage", exact: true }).inputValue(), before.stage);
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("pilot");
  await dialog.getByLabel("Value", { exact: true }).fill("750");
  await dialog.getByLabel("Next action", { exact: true }).fill("Schedule a fictional pilot review");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.querySelector("#pipelineValue").textContent === "$1,047");
  const stored = (await new JsonStore(dataFile).listLeads()).find((lead) => lead.id === before.id);
  assert.equal(stored.stage, "pilot");
  assert.equal(stored.value, 750);
  assert.equal(stored.nextAction, "Schedule a fictional pilot review");
  for (const field of ["id", "company", "contact", "niche", "notes", "source", "createdAt"]) {
    assert.equal(stored[field], before[field], `${field} must survive a pipeline edit`);
  }
  await page.reload();
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  await edit.click();
  assert.equal(await dialog.getByRole("combobox", { name: "Stage", exact: true }).inputValue(), "pilot");
  assert.equal(await dialog.getByLabel("Next action", { exact: true }).inputValue(), stored.nextAction);
  await dialog.getByLabel("Next action", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await new JsonStore(dataFile).listLeads()).find((lead) => lead.id === before.id).nextAction, "");
});

test("lead cancellation sends nothing and a failed save retains edits for one retry", async (t) => {
  const { page, baseUrl } = await openWorkspace(t);
  let puts = 0;
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  t.after(() => release());
  await page.route("**/api/leads/lead_1", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    puts += 1;
    if (puts === 1) {
      await held;
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"fictional_unavailable"}' });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  const edit = page.getByRole("button", { name: "Edit North Ridge HVAC", exact: true });
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Update lead", exact: true });
  await dialog.getByLabel("Next action", { exact: true }).fill("Discard this fictional edit");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(puts, 0);
  await edit.click();
  assert.equal(await dialog.getByLabel("Next action", { exact: true }).inputValue(), "Send missed-call audit email");
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("qualified");
  await dialog.getByLabel("Next action", { exact: true }).fill("Keep this fictional draft after failure");
  const request = page.waitForRequest((req) => req.method() === "PUT");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await request;
  assert.equal(await dialog.getByRole("button", { name: "Saving…", exact: true }).isDisabled(), true);
  assert.equal(await dialog.getByRole("button", { name: "Cancel", exact: true }).isDisabled(), true);
  assert.equal(await dialog.getByRole("combobox", { name: "Stage", exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true);
  release();
  await dialog.getByRole("alert").filter({ hasText: "Could not save" }).waitFor();
  assert.equal(await dialog.getByRole("combobox", { name: "Stage", exact: true }).inputValue(), "qualified");
  assert.equal(await dialog.getByLabel("Next action", { exact: true }).inputValue(), "Keep this fictional draft after failure");
  assert.equal(puts, 1);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(puts, 2);
  const saved = (await (await fetch(`${baseUrl}/api/leads`)).json()).find((lead) => lead.id === "lead_1");
  assert.equal(saved.stage, "qualified");
  assert.equal(saved.nextAction, "Keep this fictional draft after failure");
});

test("an older refresh and unavailable totals cannot undo a confirmed lead save", async (t) => {
  const { page, baseUrl } = await openWorkspace(t);
  const olderLeads = await (await fetch(`${baseUrl}/api/leads`)).json();
  let release;
  let captured;
  const held = new Promise((resolve) => { release = resolve; });
  const requested = new Promise((resolve) => { captured = resolve; });
  t.after(() => release());
  await page.route("**/api/leads", async (route) => {
    captured();
    await held;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(olderLeads) });
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await requested;
  await page.route("**/api/summary", (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await page.getByRole("button", { name: "Leads", exact: true }).click();
  const edit = page.getByRole("button", { name: "Edit North Ridge HVAC", exact: true });
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Update lead", exact: true });
  await dialog.getByLabel("Value", { exact: true }).fill("900");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("status").filter({ hasText: "Lead updated. Totals could not refresh" }).waitFor();
  const staleResponse = page.waitForResponse((response) => response.url().endsWith("/api/leads"));
  release();
  await (await staleResponse).finished();
  await edit.click();
  assert.equal(await dialog.getByLabel("Value", { exact: true }).inputValue(), "900");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.unroute("**/api/leads");
  await page.unroute("**/api/summary");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#pipelineValue").textContent === "$1,197");
  assert.equal((await (await fetch(`${baseUrl}/api/leads`)).json()).find((lead) => lead.id === "lead_1").value, 900);
});
