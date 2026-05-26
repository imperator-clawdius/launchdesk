import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateLaunchAssets, scoreOffer } from "./scoring.js";

const defaultData = {
  offers: [
    {
      id: "offer_hvac_recovery",
      businessName: "LaunchDesk",
      offerName: "HVAC missed-call recovery",
      niche: "hvac",
      targetCustomer: "independent HVAC owners",
      outcome: "turn missed emergency calls into booked jobs and review requests",
      monthlyPrice: 497,
      setupFee: 997,
      grossMargin: 78,
      proofLevel: 3,
      fulfillmentHours: 2,
      leadSourceStrength: 4,
      promiseClarity: 5,
      channels: ["sms", "voice", "reviews"],
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T00:00:00.000Z",
    },
    {
      id: "offer_auto_frontdesk",
      businessName: "LaunchDesk",
      offerName: "Auto shop front-desk follow-up",
      niche: "auto",
      targetCustomer: "independent auto repair shops",
      outcome: "follow up on missed estimates, status calls, and review requests",
      monthlyPrice: 297,
      setupFee: 499,
      grossMargin: 74,
      proofLevel: 2,
      fulfillmentHours: 3,
      leadSourceStrength: 3,
      promiseClarity: 4,
      channels: ["sms", "email", "reviews"],
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T00:00:00.000Z",
    },
  ],
  leads: [
    {
      id: "lead_1",
      company: "North Ridge HVAC",
      contact: "Owner",
      niche: "hvac",
      stage: "outreach",
      value: 497,
      source: "seed list",
      nextAction: "Send missed-call audit email",
      notes: "Good fit: emergency service, small team, visible reviews.",
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T00:00:00.000Z",
    },
    {
      id: "lead_2",
      company: "Harbor Auto Care",
      contact: "Service manager",
      niche: "auto",
      stage: "qualified",
      value: 297,
      source: "manual prospecting",
      nextAction: "Book pilot walkthrough",
      notes: "Mentioned front desk misses calls during lunch rush.",
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-26T00:00:00.000Z",
    },
  ],
  activity: [
    {
      id: "activity_seed",
      type: "system",
      text: "LaunchDesk seed workspace created.",
      createdAt: "2026-05-26T00:00:00.000Z",
    },
  ],
};

export class JsonStore {
  constructor(filePath) {
    this.filePath = resolve(filePath || process.env.DATA_FILE || "./data/launchdesk.json");
    this.loaded = false;
    this.data = structuredClone(defaultData);
  }

  async load() {
    if (this.loaded) return this.data;
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = normalizeData(JSON.parse(raw));
    } catch {
      this.data = normalizeData(structuredClone(defaultData));
      await this.save();
    }
    this.loaded = true;
    return this.data;
  }

  async save() {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempFile = `${this.filePath}.tmp`;
    await writeFile(tempFile, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
    await rename(tempFile, this.filePath);
  }

  async getSummary() {
    const data = await this.load();
    const offers = data.offers.map(withComputedOffer);
    const leads = data.leads;
    const projectedMrr = offers.reduce((sum, offer) => sum + offer.scorecard.economics.netMrr, 0);
    const pipelineValue = leads.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const readyOffers = offers.filter((offer) => offer.scorecard.status === "ready").length;
    const avgScore = offers.length
      ? Math.round(offers.reduce((sum, offer) => sum + offer.scorecard.score, 0) / offers.length)
      : 0;

    return {
      projectedMrr,
      pipelineValue,
      readyOffers,
      avgScore,
      leadCount: leads.length,
      offerCount: offers.length,
      stages: countBy(leads, "stage"),
      recentActivity: data.activity.slice(0, 8),
    };
  }

  async listOffers() {
    const data = await this.load();
    return data.offers.map(withComputedOffer);
  }

  async getOffer(id) {
    const data = await this.load();
    const offer = data.offers.find((item) => item.id === id);
    return offer ? withComputedOffer(offer) : null;
  }

  async createOffer(input) {
    const data = await this.load();
    const now = new Date().toISOString();
    const offer = {
      id: createId("offer"),
      businessName: clean(input.businessName, "LaunchDesk"),
      offerName: clean(input.offerName, "New monthly offer"),
      niche: clean(input.niche, "hvac"),
      targetCustomer: clean(input.targetCustomer, "local service business owners"),
      outcome: clean(input.outcome, "capture missed leads and follow up automatically"),
      monthlyPrice: number(input.monthlyPrice, 297),
      setupFee: number(input.setupFee, 499),
      grossMargin: number(input.grossMargin, 70),
      proofLevel: number(input.proofLevel, 2),
      fulfillmentHours: number(input.fulfillmentHours, 2),
      leadSourceStrength: number(input.leadSourceStrength, 3),
      promiseClarity: number(input.promiseClarity, 3),
      channels: Array.isArray(input.channels) ? input.channels : ["sms", "reviews"],
      createdAt: now,
      updatedAt: now,
    };
    data.offers.unshift(offer);
    data.activity.unshift({
      id: createId("activity"),
      type: "offer",
      text: `Created offer: ${offer.offerName}`,
      createdAt: now,
    });
    await this.save();
    return withComputedOffer(offer);
  }

  async updateOffer(id, input) {
    const data = await this.load();
    const index = data.offers.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const now = new Date().toISOString();
    data.offers[index] = {
      ...data.offers[index],
      ...input,
      monthlyPrice: number(input.monthlyPrice, data.offers[index].monthlyPrice),
      setupFee: number(input.setupFee, data.offers[index].setupFee),
      grossMargin: number(input.grossMargin, data.offers[index].grossMargin),
      proofLevel: number(input.proofLevel, data.offers[index].proofLevel),
      fulfillmentHours: number(input.fulfillmentHours, data.offers[index].fulfillmentHours),
      leadSourceStrength: number(input.leadSourceStrength, data.offers[index].leadSourceStrength),
      promiseClarity: number(input.promiseClarity, data.offers[index].promiseClarity),
      updatedAt: now,
    };
    data.activity.unshift({
      id: createId("activity"),
      type: "offer",
      text: `Updated offer: ${data.offers[index].offerName}`,
      createdAt: now,
    });
    await this.save();
    return withComputedOffer(data.offers[index]);
  }

  async deleteOffer(id) {
    const data = await this.load();
    const before = data.offers.length;
    data.offers = data.offers.filter((item) => item.id !== id);
    if (data.offers.length === before) return false;
    data.activity.unshift({
      id: createId("activity"),
      type: "offer",
      text: `Deleted offer ${id}`,
      createdAt: new Date().toISOString(),
    });
    await this.save();
    return true;
  }

  async listLeads() {
    const data = await this.load();
    return data.leads;
  }

  async createLead(input) {
    const data = await this.load();
    const now = new Date().toISOString();
    const lead = {
      id: createId("lead"),
      company: clean(input.company, "Unnamed company"),
      contact: clean(input.contact, ""),
      niche: clean(input.niche, "hvac"),
      stage: clean(input.stage, "new"),
      value: number(input.value, 297),
      source: clean(input.source, "manual"),
      nextAction: clean(input.nextAction, "Qualify fit"),
      notes: clean(input.notes, ""),
      createdAt: now,
      updatedAt: now,
    };
    data.leads.unshift(lead);
    data.activity.unshift({
      id: createId("activity"),
      type: "lead",
      text: `Added lead: ${lead.company}`,
      createdAt: now,
    });
    await this.save();
    return lead;
  }

  async updateLead(id, input) {
    const data = await this.load();
    const index = data.leads.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const now = new Date().toISOString();
    data.leads[index] = {
      ...data.leads[index],
      ...input,
      value: number(input.value, data.leads[index].value),
      updatedAt: now,
    };
    data.activity.unshift({
      id: createId("activity"),
      type: "lead",
      text: `Updated lead: ${data.leads[index].company}`,
      createdAt: now,
    });
    await this.save();
    return data.leads[index];
  }

  async deleteLead(id) {
    const data = await this.load();
    const before = data.leads.length;
    data.leads = data.leads.filter((item) => item.id !== id);
    if (data.leads.length === before) return false;
    data.activity.unshift({
      id: createId("activity"),
      type: "lead",
      text: `Deleted lead ${id}`,
      createdAt: new Date().toISOString(),
    });
    await this.save();
    return true;
  }
}

export function withComputedOffer(offer) {
  return {
    ...offer,
    scorecard: scoreOffer(offer),
    assets: generateLaunchAssets(offer),
  };
}

function normalizeData(data) {
  return {
    offers: Array.isArray(data.offers) ? data.offers : [],
    leads: Array.isArray(data.leads) ? data.leads : [],
    activity: Array.isArray(data.activity) ? data.activity : [],
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
