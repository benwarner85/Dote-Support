let DATA = null;
let FLOWS = [];

const WIZ = {
  tractionTokens: null,
  tractionLabel: null,
  system: null,
  stage: null,
  keywords: "",
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([k, v]) => {
    if ((k === "onClick" || k === "onclick") && typeof v === "function") {
      node.addEventListener("click", v);
      return;
    }
    if ((k === "onInput" || k === "oninput") && typeof v === "function") {
      node.addEventListener("input", v);
      return;
    }
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });

  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (!c) return;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else if (c instanceof Node) node.appendChild(c);
  });

  return node;
}

function setScreen(content) {
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(content);
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Wizard config */
const STAGES = ["Entering Service", "In Service", "Removing From Service", "Reporting / Notes"];

const COMMON_TRACTION = [
  { label: "Class 16x", tokens: ["16x", "165", "166", "167"] },
  { label: "Class 150 / 158", tokens: ["150", "150/2", "158"] },
  { label: "Class 387 (incl Air Fleet)", tokens: ["387", "air fleet"] },
  { label: "Class 80x", tokens: ["80x", "800", "802", "803"] },
  { label: "All traction", tokens: null },
];

function flowTractionMatches(flow, tokens) {
  if (!tokens) return true;
  const tr = norm(flow.traction);
  const list = tokens.map(norm).filter(Boolean);
  return list.some(t => tr.includes(t));
}

/* Robust getters (we'll validate with Debug) */
function getSystemLabel(flow) {
  return (
    flow.system ||
    flow.system_label ||
    flow.system_name ||
    flow.category ||
    flow.group ||
    flow.area ||
    (flow.labels && (flow.labels.system || flow.labels.category)) ||
    ""
  ).toString().trim();
}

function getTitle(flow) {
  return (flow.title || flow.fault || flow.name || "").toString().trim();
}

function getUniqueSystemsFor(tokens) {
  const set = new Set();

  FLOWS.forEach(f => {
    if (flowTractionMatches(f, tokens)) {
      const sys = getSystemLabel(f);
      if (sys) set.add(sys);
    }
  });

  if (set.size === 0) {
    FLOWS.forEach(f => {
      const sys = getSystemLabel(f);
      if (sys) set.add(sys);
    });
  }

  return [...set].sort((a, b) => a.localeCompare(b));
}

function resetWizard() {
  WIZ.tractionTokens = null;
  WIZ.tractionLabel = null;
  WIZ.system = null;
  WIZ.stage = null;
  WIZ.keywords = "";
}

/* Screens */
function showLoading() {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Loading…"),
      el("div", { class: "p" }, "Fetching dataset.")
    ])
  );
}

function showError(message) {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Could not load app"),
      el("div", { class: "p", html: esc(message) }),
      el("div", { class: "p" }, "Try Private tab (Safari cache).")
    ])
  );
}

function home() {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "DOTE Decision Support (V1)"),
      el("button", { class: "primary", onClick: () => { resetWizard(); wizardTraction(); } }, "Start fault guidance"),
      el("button", { class: "secondary", onClick: () => datasetDebug() }, "Dataset debug"),
    ])
  );
}

/* DEBUG SCREEN */
function datasetDebug() {
  const first = FLOWS && FLOWS.length ? FLOWS[0] : null;
  const keys = first ? Object.keys(first).sort() : [];

  const sampleSystem = first ? {
    system: first.system,
    system_label: first.system_label,
    system_name: first.system_name,
    category: first.category,
    group: first.group,
    area: first.area,
    labels: first.labels
  } : null;

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Dataset debug"),
      el("div", { class: "p" }, `Flows loaded: ${FLOWS.length}`),
      el("div", { class: "p" }, `First flow keys (${keys.length}):`),
      el("div", { class: "p", html: `<code>${esc(keys.join(", "))}</code>` }),

      el("div", { class: "p" }, "Likely system fields (first flow):"),
      el("div", { class: "p", html: `<code>${esc(JSON.stringify(sampleSystem, null, 2))}</code>` }),

      el("div", { class: "p" }, "First flow traction + title:"),
      el("div", { class: "p", html: `<code>${esc(JSON.stringify({
        traction: first?.traction,
        title: getTitle(first),
        system_guess: getSystemLabel(first)
      }, null, 2))}</code>` }),

      el("button", { class: "secondary", onClick: () => home() }, "Home")
    ])
  );
}

/* 1) Traction */
function wizardTraction() {
  const btns = COMMON_TRACTION.map(t =>
    el("button", {
      class: "primary",
      onClick: () => {
        WIZ.tractionTokens = t.tokens;
        WIZ.tractionLabel = t.label;
        WIZ.system = null;
        WIZ.stage = null;
        WIZ.keywords = "";
        wizardSystem();
      }
    }, t.label)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What traction are you driving?"),
      ...btns,
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* 2) System */
function wizardSystem() {
  const systems = getUniqueSystemsFor(WIZ.tractionTokens);

  const btns = systems.map(s =>
    el("button", {
      class: "primary",
      onClick: () => alert("System tapped: " + s) // temporary - proves buttons render
    }, s)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What system is affected?"),
      el("div", { class: "p" }, `Traction: ${WIZ.tractionLabel || "All traction"}`),

      systems.length
        ? el("div", {}, btns)
        : el("div", { class: "p" }, "No systems found. Tap Home → Dataset debug and send me that screen."),

      el("button", { class: "secondary", onClick: () => wizardTraction() }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* Boot */
async function boot() {
  showLoading();
  try {
    const resp = await fetch("data.json?v=10");
    if (!resp.ok) throw new Error("Failed to load data.json (" + resp.status + ")");
    DATA = await resp.json();

    FLOWS = Array.isArray(DATA) ? DATA : (Array.isArray(DATA.flows) ? DATA.flows : []);
    if (!FLOWS.length) throw new Error("Dataset loaded but no flows found.");

    home();
  } catch (e) {
    showError(e.message || String(e));
  }
}

boot();
