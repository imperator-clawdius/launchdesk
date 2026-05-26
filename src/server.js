import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { getChannelProfiles, getNicheProfiles } from "./scoring.js";
import { JsonStore } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

export function createApp({ store = new JsonStore(process.env.DATA_FILE), logger = false } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  if (logger) app.use(morgan("tiny"));
  app.use(express.json({ limit: "256kb" }));
  app.use(express.static(publicDir, { extensions: ["html"] }));

  app.get("/api/health", async (_req, res, next) => {
    try {
      await store.load();
      res.json({ ok: true, service: "launchdesk", time: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/meta", (_req, res) => {
    res.json({
      niches: getNicheProfiles(),
      channels: getChannelProfiles(),
      stages: ["new", "outreach", "qualified", "pilot", "won", "lost"],
    });
  });

  app.get("/api/summary", async (_req, res, next) => {
    try {
      res.json(await store.getSummary());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/offers", async (_req, res, next) => {
    try {
      res.json(await store.listOffers());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/offers", async (req, res, next) => {
    try {
      res.status(201).json(await store.createOffer(req.body));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/offers/:id", async (req, res, next) => {
    try {
      const offer = await store.getOffer(req.params.id);
      if (!offer) return res.status(404).json({ error: "offer_not_found" });
      return res.json(offer);
    } catch (error) {
      return next(error);
    }
  });

  app.put("/api/offers/:id", async (req, res, next) => {
    try {
      const offer = await store.updateOffer(req.params.id, req.body);
      if (!offer) return res.status(404).json({ error: "offer_not_found" });
      return res.json(offer);
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/offers/:id", async (req, res, next) => {
    try {
      const deleted = await store.deleteOffer(req.params.id);
      if (!deleted) return res.status(404).json({ error: "offer_not_found" });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/leads", async (_req, res, next) => {
    try {
      res.json(await store.listLeads());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/leads", async (req, res, next) => {
    try {
      res.status(201).json(await store.createLead(req.body));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/leads/:id", async (req, res, next) => {
    try {
      const lead = await store.updateLead(req.params.id, req.body);
      if (!lead) return res.status(404).json({ error: "lead_not_found" });
      return res.json(lead);
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/leads/:id", async (req, res, next) => {
    try {
      const deleted = await store.deleteLead(req.params.id);
      if (!deleted) return res.status(404).json({ error: "lead_not_found" });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/export", async (_req, res, next) => {
    try {
      const [summary, offers, leads] = await Promise.all([store.getSummary(), store.listOffers(), store.listLeads()]);
      res.json({ exportedAt: new Date().toISOString(), summary, offers, leads });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not_found" });
    return next();
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const port = Number(process.env.PORT || 4177);
  const app = createApp({ logger: process.env.NODE_ENV !== "test" });
  app.listen(port, () => {
    console.log(`LaunchDesk listening on http://localhost:${port}`);
  });
}
