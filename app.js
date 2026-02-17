let DATA = null;
let FLOWS = []; // normalized flows array

const WIZ = {
  tractionTokens: null, // array of tokens or null for All
  tractionLabel: null,
  system: null,
  stage: null,
  keywords: "",
};

/* ============================= */
/* DOM helpers                    */
/* ============================= */
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

/* ============================= */
/* Wizard configuration           */
/* ============================= */
const STAGES = ["Entering Service", "In Service", "Removing From Service", "Reporting / Notes"];

// These are the ONLY traction buttons shown (clean and short).
// Matching is fuzzy against your messy free-text traction strings.
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

// Try to read "system" even if field name differs.
// (This makes the app robust if your dataset changes slightly.)
function getSystemLabel(flow) {
  return (flow.system || flow.system_label || flow.system_name || flow.category || "").toString().trim();
}

// Same idea for title
function getTitle(flow) {
  return (flow.title || flow.fault || flow.name || "").toString().trim();
}

function getUniqueSystemsFor(tokens) {
  const set = new Set();

  // systems for this traction
  FLOWS.forEach(f => {
    if (flowTractionMatches(f, tokens)) {
      const sys = getSystemLabel(f);
      if (sys) set.add(sys);
    }
  });

  // fallback: all systems if none found
  if (set.size === 0) {
    FLOWS.forEach(f => {
      const sys = getSystemLabel(f);
      if (sys) set.add(sys);
    });
  }

  return [...set].sort((a, b) => a.localeCompare(b));
}

function scoreFlow(flow, stage, keywords) {
  let score = 0;

  const sec = flow.sections?.[stage];
  if (sec && String(sec).trim().length > 0) score += 5;

  const kw = norm(keywords);
  if (!kw) return score;

  const hay = norm([
    getTitle(flow),
    flow.source,
    flow.traction,
    getSystemLabel(flow),
    flow.sections?.["Entering Service"],
    flow.sections?.["In Service"],
    flow.sections?.["Removing From Service"],
    flow.sections?.["Reporting / Notes"],
  ].join(" | "));

  kw.split(/\s+/).filter(Boolean).forEach(p => {
    if (hay.includes(p)) score += 2;
  });

  return score;
}

function resetWizard() {
  WIZ.tractionTokens = null;
  WIZ.tractionLabel = null;
  WIZ.system = null;
  WIZ.stage = null;
  WIZ.keywords = "";
}

/* ============================= */
/* Screens                        */
/* ============================= */
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
      el("button", { class: "secondary", onClick: () => searchScreen() }, "Search tables"),
    ])
  );
}

/* 1) Traction (CLEAN LIST ONLY) */
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
      el("div", { class: "p" }, "Pick a simple option (we match it to the full dataset automatically)."),
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
      onClick: () => {
        WIZ.system = s;
        WIZ.stage = null;
        wizardStage();
      }
    }, s)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What system is affected?"),
      el("div", { class: "p" }, `Traction: ${WIZ.tractionLabel || "All traction"}`),
      ...btns,
      el("button", { class: "secondary", onClick: () => wizardTraction() }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* 3) Stage */
function wizardStage() {
  const btns = STAGES.map(st =>
    el("button", {
      class: "primary",
      onClick: () => {
        WIZ.stage = st;
        wizardKeywords();
      }
    }, st)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What stage are you at?"),
      el("div", { class: "p" }, `Traction: ${WIZ.tractionLabel || "All traction"} • System: ${WIZ.system}`),
      ...btns,
      el("button", { class: "secondary", onClick: () => wizardSystem() }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* 4) Keywords + results */
function wizardKeywords() {
  const input = el("input", {
    class: "searchbox",
    placeholder: "Optional keywords (e.g. deer, brakes applied, low air)…",
    value: WIZ.keywords || "",
    onInput: (e) => { WIZ.keywords = e.target.value; renderWizardResults(); }
  });

  const results = el("div", { id: "wizResults" });

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Any extra details?"),
      el("div", { class: "p" }, `Traction: ${WIZ.tractionLabel || "All traction"} • System: ${WIZ.system} • Stage: ${WIZ.stage}`),
      input,
      results,
      el("button", { class: "secondary", onClick: () => wizardStage() }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );

  renderWizardResults();
}

function renderWizardResults() {
  const container = document.getElementById("wizResults");
  if (!container) return;
  container.innerHTML = "";

  const matches = FLOWS
    .filter(f => flowTractionMatches(f, WIZ.tractionTokens))
    .filter(f => getSystemLabel(f) === String(WIZ.system || "").trim());

  const scored = matches
    .map(f => ({ f, score: scoreFlow(f, WIZ.stage, WIZ.keywords) }))
    .sort((a, b) => b.score - a.score || (a.f.table_no ?? 0) - (b.f.table_no ?? 0));

  if (!scored.length) {
    container.appendChild(el("div", { class: "p" }, "No matches found. Try a keyword, or pick a different system."));
    return;
  }

  const top = scored.slice(0, 25);
  container.appendChild(el("div", { class: "p" }, `Top matches (${top.length}). Tap one:`));

  top.forEach(({ f }) => {
    container.appendChild(
      el("button", { class: "primary", onClick: () => viewOutcome(f) },
        `Table ${f.table_no} — ${getTitle(f) || "(no title)"}`
      )
    );
  });

  if (scored.length > 25) {
    container.appendChild(el("div", { class: "p" }, "More matches exist — add a keyword to narrow it down."));
  }
}

function viewOutcome(flow) {
  const stageText = flow.sections?.[WIZ.stage] || "—";
  const dnp = !!flow.do_not_proceed;

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, `Outcome — Table ${flow.table_no}`),
      el("div", { class: "p" }, getTitle(flow) || ""),
      dnp ? el("div", { class: "banner" }, "DO NOT PROCEED") : null,
      el("div", { class: "section" }, [
        el("div", { class: "section-title" }, WIZ.stage),
        el("div", { class: "p", html: esc(stageText) })
      ]),
      el("div", { class: "p", html: `<strong>Source:</strong> ${esc(flow.source || ("Table " + flow.table_no))} • Dataset: V1` }),
      el("button", { class: "secondary", onClick: () => wizardKeywords() }, "Back to results"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* ============================= */
/* Search (fallback)              */
/* ============================= */
function searchScreen() {
  const input = el("input", {
    class: "searchbox",
    placeholder: "Search anything (e.g. AWS, brakes, Table 9, 16x)…",
    onInput: (e) => renderSearchResults(e.target.value)
  });

  const results = el("div", { id: "searchResults" });

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Search tables"),
      input,
      results,
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

function renderSearchResults(q) {
  const container = document.getElementById("searchResults");
  if (!container) return;
  container.innerHTML = "";

  const term = norm(q);
  if (!term) {
    container.appendChild(el("div", { class: "p" }, "Type to search…"));
    return;
  }

  const hits = FLOWS.filter(f => {
    const hay = norm([
      f.table_no, getTitle(f), f.traction, getSystemLabel(f), f.source,
      f.sections?.["Entering Service"],
      f.sections?.["In Service"],
      f.sections?.["Removing From Service"],
      f.sections?.["Reporting / Notes"]
    ].join(" | "));

    if (/^\d+$/.test(term) && String(f.table_no) === term) return true;
    return hay.includes(term);
  }).slice(0, 40);

  if (!hits.length) {
    container.appendChild(el("div", { class: "p" }, "No matches found."));
    return;
  }

  hits.forEach(f => {
    container.appendChild(
      el("button", { class: "primary", onClick: () => viewOutcomeFromSearch(f) },
        `Table ${f.table_no} — ${getTitle(f) || "(no title)"}`
      )
    );
  });

  container.appendChild(el("div", { class: "p" }, "Showing up to 40 results."));
}

function viewOutcomeFromSearch(flow) {
  const sections = flow.sections || {};
  const dnp = !!flow.do_not_proceed;

  const block = (label, content) =>
    el("div", { class: "section" }, [
      el("div", { class: "section-title" }, label),
      el("div", { class: "p", html: esc(content || "—") })
    ]);

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, `Table ${flow.table_no} — ${getTitle(flow) || ""}`),
      dnp ? el("div", { class: "banner" }, "DO NOT PROCEED") : null,
      block("Entering Service", sections["Entering Service"]),
      block("In Service", sections["In Service"]),
      block("Removing From Service", sections["Removing From Service"]),
      block("Reporting / Notes", sections["Reporting / Notes"]),
      el("button", { class: "secondary", onClick: () => searchScreen() }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* ============================= */
/* Boot                           */
/* ============================= */
async function boot() {
  showLoading();
  try {
    const resp = await fetch("data.json?v=9");
    if (!resp.ok) throw new Error("Failed to load data.json (" + resp.status + ")");

    DATA = await resp.json();

    // Support both shapes: {flows:[...]} OR [...]
    FLOWS = Array.isArray(DATA) ? DATA : (Array.isArray(DATA.flows) ? DATA.flows : []);

    if (!FLOWS.length) throw new Error("Dataset loaded but no flows found.");

    home();
  } catch (e) {
    showError(e.message || String(e));
  }
}

boot();
