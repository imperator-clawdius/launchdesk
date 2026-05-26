const state = {
  meta: null,
  summary: null,
  offers: [],
  leads: [],
  selectedOfferId: null,
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const api = {
  async get(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`GET ${path} failed`);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed`);
    return res.json();
  },
};

async function loadAll() {
  const [meta, summary, offers, leads] = await Promise.all([
    api.get("/api/meta"),
    api.get("/api/summary"),
    api.get("/api/offers"),
    api.get("/api/leads"),
  ]);
  state.meta = meta;
  state.summary = summary;
  state.offers = offers;
  state.leads = leads;
  if (!state.selectedOfferId && offers[0]) state.selectedOfferId = offers[0].id;
  renderAll();
}

function renderAll() {
  renderMeta();
  renderSummary();
  renderOffers();
  renderLeads();
  renderAssets();
  if (window.lucide) window.lucide.createIcons();
}

function renderMeta() {
  if (!state.meta) return;
  const nicheOptions = Object.entries(state.meta.niches)
    .map(([key, niche]) => `<option value="${key}">${niche.label}</option>`)
    .join("");
  document.querySelector("#nicheSelect").innerHTML = nicheOptions;
  document.querySelector("#leadNicheSelect").innerHTML = nicheOptions;

  const channels = Object.entries(state.meta.channels)
    .map(
      ([key, channel]) => `
        <label>
          <input type="checkbox" name="channels" value="${key}" ${["sms", "voice", "reviews"].includes(key) ? "checked" : ""} />
          ${channel.label}
        </label>
      `,
    )
    .join("");
  document.querySelector("#channelRow").innerHTML = channels;
}

function renderSummary() {
  const summary = state.summary;
  document.querySelector("#projectedMrr").textContent = money.format(summary?.projectedMrr || 0);
  document.querySelector("#pipelineValue").textContent = money.format(summary?.pipelineValue || 0);
  document.querySelector("#readyOffers").textContent = String(summary?.readyOffers || 0);
  document.querySelector("#avgScore").textContent = `${summary?.avgScore || 0}%`;
}

function renderOffers() {
  const container = document.querySelector("#offerCards");
  if (!state.offers.length) {
    container.innerHTML = `<article class="offer-card"><h3>No offers</h3><p>Create one offer to start.</p></article>`;
    return;
  }

  container.innerHTML = state.offers
    .map(
      (offer) => `
        <article class="offer-card">
          <div>
            <h3>${escapeHtml(offer.offerName)}</h3>
            <p>${escapeHtml(offer.assets.oneLiner)}</p>
          </div>
          <div class="card-meta">
            <span class="chip green">${offer.scorecard.score}% ${offer.scorecard.status}</span>
            <span class="chip">${money.format(offer.monthlyPrice)}/mo</span>
            <span class="chip">${money.format(offer.scorecard.economics.netMrr)} net</span>
          </div>
          <button class="primary select-offer" type="button" data-id="${offer.id}">
            <i data-lucide="file-text"></i>
            View assets
          </button>
        </article>
      `,
    )
    .join("");
}

function renderLeads() {
  const rows = document.querySelector("#leadRows");
  rows.innerHTML = state.leads
    .map(
      (lead) => `
        <tr>
          <td>${escapeHtml(lead.company)}</td>
          <td>${escapeHtml(state.meta?.niches?.[lead.niche]?.label || lead.niche)}</td>
          <td><span class="chip">${escapeHtml(lead.stage)}</span></td>
          <td>${money.format(lead.value || 0)}</td>
          <td>${escapeHtml(lead.nextAction || "")}</td>
        </tr>
      `,
    )
    .join("");
}

function renderAssets() {
  const offer = state.offers.find((item) => item.id === state.selectedOfferId) || state.offers[0];
  const stack = document.querySelector("#assetStack");
  if (!offer) {
    document.querySelector("#assetHeadline").textContent = "Select or create an offer";
    document.querySelector("#assetScore").textContent = "0%";
    stack.innerHTML = "";
    return;
  }

  document.querySelector("#assetHeadline").textContent = offer.assets.landingPage.headline;
  document.querySelector("#assetScore").textContent = `${offer.scorecard.score}%`;
  stack.innerHTML = `
    <section class="asset">
      <span class="asset-label">One-liner</span>
      <p>${escapeHtml(offer.assets.oneLiner)}</p>
    </section>
    <section class="asset">
      <span class="asset-label">Landing page</span>
      <p><strong>${escapeHtml(offer.assets.landingPage.subhead)}</strong></p>
      <ul>${offer.assets.landingPage.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <p>${escapeHtml(offer.assets.landingPage.cta)}</p>
    </section>
    <section class="asset">
      <span class="asset-label">Outbound email</span>
      <p><strong>${escapeHtml(offer.assets.outboundEmail.subject)}</strong></p>
      <p>${escapeHtml(offer.assets.outboundEmail.body).replaceAll("\n", "<br />")}</p>
    </section>
    <section class="asset">
      <span class="asset-label">SMS opener</span>
      <p>${escapeHtml(offer.assets.smsScript)}</p>
    </section>
    <section class="asset">
      <span class="asset-label">Risks</span>
      <ul>${offer.scorecard.risks.map((risk) => `<li>${escapeHtml(risk.level)}: ${escapeHtml(risk.text)}</li>`).join("")}</ul>
    </section>
  `;
}

function formToOffer(form) {
  const formData = new FormData(form);
  const channels = [...form.querySelectorAll('input[name="channels"]:checked')].map((input) => input.value);
  return {
    businessName: formData.get("businessName"),
    offerName: formData.get("offerName"),
    niche: formData.get("niche"),
    targetCustomer: formData.get("targetCustomer"),
    outcome: formData.get("outcome"),
    monthlyPrice: Number(formData.get("monthlyPrice")),
    setupFee: Number(formData.get("setupFee")),
    grossMargin: Number(formData.get("grossMargin")),
    proofLevel: Number(formData.get("proofLevel")),
    fulfillmentHours: Number(formData.get("fulfillmentHours")),
    leadSourceStrength: Number(formData.get("leadSourceStrength")),
    promiseClarity: Number(formData.get("promiseClarity")),
    channels,
  };
}

function formToLead(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

document.querySelector("#offerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const offer = await api.post("/api/offers", formToOffer(event.currentTarget));
  state.selectedOfferId = offer.id;
  await loadAll();
});

document.querySelector("#leadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api.post("/api/leads", formToLead(event.currentTarget));
  event.currentTarget.reset();
  await loadAll();
});

document.querySelector("#offerCards").addEventListener("click", (event) => {
  const button = event.target.closest(".select-offer");
  if (!button) return;
  state.selectedOfferId = button.dataset.id;
  renderAssets();
});

document.querySelector("#refreshBtn").addEventListener("click", loadAll);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.view}View`).classList.add("active");
  });
});

loadAll().catch((error) => {
  console.error(error);
  document.querySelector("#assetStack").innerHTML = `<section class="asset"><p>LaunchDesk failed to load. Check the server logs.</p></section>`;
});
