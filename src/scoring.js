const nicheProfiles = {
  hvac: {
    label: "HVAC",
    urgency: 92,
    margin: 82,
    pain: "missed calls, emergency jobs, quote follow-up, reviews",
    bestHook: "Recover missed emergency calls before the next contractor wins.",
  },
  plumbing: {
    label: "Plumbing",
    urgency: 95,
    margin: 78,
    pain: "after-hours leaks, quote follow-up, review requests",
    bestHook: "Turn missed leak calls into booked jobs and review requests.",
  },
  auto: {
    label: "Auto repair",
    urgency: 74,
    margin: 72,
    pain: "status calls, missed estimates, review generation",
    bestHook: "Stop losing repair jobs when the front desk is busy.",
  },
  dental: {
    label: "Dental",
    urgency: 62,
    margin: 86,
    pain: "missed new-patient calls, confirmations, reactivation",
    bestHook: "Capture new-patient calls and fill empty chair time.",
  },
  legal: {
    label: "Local law firm",
    urgency: 88,
    margin: 90,
    pain: "intake speed, lead qualification, follow-up",
    bestHook: "Respond to intake leads before they call the next firm.",
  },
  medspa: {
    label: "Med spa",
    urgency: 58,
    margin: 88,
    pain: "consult follow-up, reactivation, package upsells",
    bestHook: "Convert consult requests into booked appointments and repeat visits.",
  },
};

const channelProfiles = {
  sms: { label: "SMS", fit: 88, speed: 95 },
  voice: { label: "Voice AI", fit: 86, speed: 80 },
  email: { label: "Email", fit: 68, speed: 72 },
  reviews: { label: "Review automation", fit: 82, speed: 76 },
  ads: { label: "Paid ads", fit: 58, speed: 60 },
  outbound: { label: "Outbound", fit: 76, speed: 84 },
};

export function getNicheProfiles() {
  return nicheProfiles;
}

export function getChannelProfiles() {
  return channelProfiles;
}

export function scoreOffer(input) {
  const niche = nicheProfiles[input.niche] ?? nicheProfiles.hvac;
  const channels = normalizeChannels(input.channels);
  const monthlyPrice = toNumber(input.monthlyPrice, 297);
  const setupFee = toNumber(input.setupFee, 499);
  const grossMargin = toNumber(input.grossMargin, 70);
  const proofLevel = toNumber(input.proofLevel, 2);
  const fulfillmentHours = toNumber(input.fulfillmentHours, 2);
  const leadSourceStrength = toNumber(input.leadSourceStrength, 3);
  const promiseClarity = toNumber(input.promiseClarity, 3);

  const channelFit = average(channels.map((channel) => channelProfiles[channel]?.fit ?? 60));
  const speed = average(channels.map((channel) => channelProfiles[channel]?.speed ?? 60));
  const pricingScore = clamp(monthlyPrice / 7, 20, 100);
  const marginScore = clamp(grossMargin, 20, 100);
  const fulfillmentScore = clamp(100 - fulfillmentHours * 9, 15, 100);
  const proofScore = clamp(proofLevel * 17, 10, 100);
  const leadScore = clamp(leadSourceStrength * 17, 10, 100);
  const clarityScore = clamp(promiseClarity * 18, 10, 100);

  const score = Math.round(
    niche.urgency * 0.18 +
      niche.margin * 0.12 +
      channelFit * 0.14 +
      speed * 0.08 +
      pricingScore * 0.13 +
      marginScore * 0.11 +
      fulfillmentScore * 0.08 +
      proofScore * 0.08 +
      leadScore * 0.04 +
      clarityScore * 0.04,
  );

  const monthlyGross = monthlyPrice;
  const monthlyFulfillmentCost = Math.round((fulfillmentHours * 35 + monthlyPrice * (100 - grossMargin) * 0.01) / 5) * 5;
  const netMrr = Math.max(0, monthlyGross - monthlyFulfillmentCost);
  const paybackCustomers = Math.max(1, Math.ceil(2500 / Math.max(150, setupFee + netMrr)));
  const status = score >= 80 ? "ready" : score >= 68 ? "pilot" : "needs work";

  return {
    score,
    status,
    niche,
    channels,
    economics: {
      monthlyGross,
      setupFee,
      monthlyFulfillmentCost,
      netMrr,
      paybackCustomers,
    },
    risks: buildRisks({ score, monthlyPrice, proofLevel, fulfillmentHours, leadSourceStrength, promiseClarity, channels }),
  };
}

export function generateLaunchAssets(offer) {
  const scored = scoreOffer(offer);
  const niche = scored.niche;
  const businessName = offer.businessName || "LaunchDesk";
  const offerName = offer.offerName || `${niche.label} missed-call recovery`;
  const target = offer.targetCustomer || `${niche.label.toLowerCase()} owners`;
  const outcome = offer.outcome || `recover missed leads and request reviews automatically`;
  const monthlyPrice = toNumber(offer.monthlyPrice, 297);
  const setupFee = toNumber(offer.setupFee, 499);

  return {
    oneLiner: `${businessName} helps ${target} ${outcome} for ${money(monthlyPrice)}/mo after a ${money(setupFee)} setup.`,
    landingPage: {
      headline: `${offerName} for ${target}`,
      subhead: `${niche.bestHook} We install the workflow, monitor replies, and show the owner what converted each week.`,
      bullets: [
        `Capture and route the painful moments: ${niche.pain}.`,
        "Install SMS/voice/email follow-up around the existing phone and calendar flow.",
        "Send a weekly owner report with leads recovered, appointments booked, and review requests sent.",
      ],
      cta: "Start with one location this week",
    },
    outboundEmail: {
      subject: `${niche.label} missed-call recovery`,
      body: [
        `Quick question for {{owner_first_name}}: when your shop misses a call, does anyone follow up in under 2 minutes?`,
        `We set up a small recovery system for ${niche.label.toLowerCase()} teams: missed-call textback, quote follow-up, and review requests.`,
        `It is ${money(monthlyPrice)}/mo after setup, and the first report shows exactly what came back.`,
        "Worth testing on one location?",
      ].join("\n\n"),
    },
    smsScript: `Hi {{first_name}}, this is {{rep_name}} with ${businessName}. We help ${niche.label.toLowerCase()} teams recover missed calls and reviews. Want me to show the 1-location pilot?`,
    onboardingChecklist: [
      "Confirm niche, offer, service area, and target owner profile.",
      "Connect phone/SMS provider or define manual missed-call intake.",
      "Connect calendar or define booking handoff.",
      "Add review request link and follow-up timing.",
      "Import first 50 target leads.",
      "Launch outreach and owner report cadence.",
    ],
    weeklyReportTemplate: [
      "New leads captured",
      "Missed calls recovered",
      "Appointments booked",
      "Reviews requested",
      "Replies needing owner action",
      "Next experiment",
    ],
    scorecard: scored,
  };
}

function buildRisks({ monthlyPrice, proofLevel, fulfillmentHours, leadSourceStrength, promiseClarity, channels }) {
  const risks = [];
  if (monthlyPrice < 197) risks.push({ level: "high", text: "Price is too low for a durable service margin." });
  if (proofLevel < 3) risks.push({ level: "medium", text: "Proof is thin. Start with a pilot and weekly reporting." });
  if (fulfillmentHours > 5) risks.push({ level: "high", text: "Fulfillment is too heavy. Automate or narrow the promise." });
  if (leadSourceStrength < 3) risks.push({ level: "medium", text: "Lead source is weak. Build one repeatable outbound list first." });
  if (promiseClarity < 3) risks.push({ level: "medium", text: "Promise is fuzzy. Tie it to calls, bookings, reviews, or dollars." });
  if (channels.includes("ads")) risks.push({ level: "medium", text: "Paid ads raise cash burn. Use after conversion is proven." });
  if (risks.length === 0) risks.push({ level: "low", text: "This is shaped well enough for a 1-location pilot." });
  return risks;
}

function normalizeChannels(channels) {
  if (!channels) return ["sms", "reviews"];
  if (Array.isArray(channels)) return channels.length ? channels : ["sms", "reviews"];
  if (typeof channels === "string") {
    return channels
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return ["sms", "reviews"];
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
