let DATA = null;
let FLOWS = [];

const WIZ = {
  tractionTokens: null,
  tractionLabel: null,
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

/* ============= */
/* Traction setup */
/* ============= */

const COMMON_TRACTION = [
  { label: "Class 16x", tokens: ["16x", "165", "166", "167"] },
  { label: "Class 150 / 158", tokens: ["150", "150/2", "158"] },
  { label: "Class 387 (incl Air Fleet)", tokens: ["387", "air fleet"] },
  { label: "Class 80x", tokens: ["80x", "800", "802", "803"] },
  { label: "All traction", tokens: null },
];

/**
 * FIXED MATCHING:
 * If the user selects a specific class, we include:
 *  - tables matching that class tokens
 *  - PLUS "universal" tables (All traction / All fitted traction / etc.)
 */
function flowTractionMatches(flow, tokens) {
  const tr = norm(flow.traction);

  // User selected "All traction"
  if (!tokens) return true;

  // Universal / applies-to-all tables should appear under any traction selection
  const UNIVERSAL = [
    "all traction",
    "all fitted traction",
    "all tractions",
    "all units",
    "all trains",
    "all stock",
    "all traction excluding",
    "all traction - excluding"
  ];

  if (UNIVERSAL.some(u => tr.includes(u))) return true;

  // Otherwise match the specific class tokens
  const list = tokens.map(norm).filter(Boolean);
  return list.some(t => tr.includes(t));
}

function resetWizard() {
  WIZ.tractionTokens = null;
  WIZ.tractionLabel = null;
}

/* ============= */
/* Screens        */
/* ============= */

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
      el("div", { class: "p" }, "Tip: open in a Private tab if Safari is caching old files.")
    ])
  );
}

function home() {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "DOTE Decision Support (V1)"),
      el("button", { class: "primary", onClick: () => { resetWizard(); tractionScreen(); } }, "Start fault guidance"),
      el("button", { class: "secondary", onClick: () => searchAllScreen() }, "Search all tables")
    ])
  );
}

/* 1) Traction screen (clean list) */
function tractionScreen() {
  const btns = COMMON_TRACTION.map(t =>
    el("button", {
      class: "primary",
      onClick: () => {
        WIZ.tractionTokens = t.tokens;
        WIZ.tractionLabel = t.label;
        tableListScreen();
      }
    }, t.label)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What traction are you driving?"),
      el("div", { class: "p" }, "Pick a simple option — we match it to the full dataset automatically."),
      ...btns,
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* 2) Table list screen (filtered by traction) */
function tableListScreen() {
  const matches = FLOWS
    .filter(f => flowTractionMatches(f, WIZ.tractionTokens))
    .slice()
    .sort((a, b) => (a.table_no ?? 0) - (b.table_no ?? 0));

  let currentFilter = "";
  const resultsBox = el("div", { id: "tableResults" });

  const input = el("input", {
    class: "searchbox",
    placeholder: "Filter table titles (optional)…",
    onInput: (e) => {
      currentFilter = norm(e.target.value);
      renderTableButtons(matches, resultsBox, currentFilter);
    }
  });

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Select a table"),
      el("div", { class: "p" }, `Traction: ${WIZ.tractionLabel || "All traction"}`),
      input,
      resultsBox,
      el("button", { class: "secondary", onClick: () => tractionScreen() }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );

  renderTableButtons(matches, resultsBox, currentFilter);
}

function renderTableButtons(matches, container, filterTerm) {
  container.innerHTML = "";

  const filtered = !filterTerm
    ? matches
    : matches.filter(f =>
        norm(f.title).includes(filterTerm) ||
        String(f.table_no || "").includes(filterTerm)
      );

  if (!filtered.length) {
    container.appendChild(el("div", { class: "p" }, "No tables match that filter."));
    return;
  }

  const show = filtered.slice(0, 60);

  show.forEach(f => {
    const label = `Table ${f.table_no} — ${f.title || "(no title)"}`;
    container.appendChild(
      el("button", { class: "primary", onClick: () => tableDetailScreen(f) }, label)
    );
  });

  if (filtered.length > 60) {
    container.appendChild(
      el("div", { class: "p" }, `Showing 60 of ${filtered.length}. Type in the filter box to narrow it down.`)
    );
  }
}

/* 3) Table detail screen (sections) */
function tableDetailScreen(flow) {
  const sections = flow.sections || {};
  const dnp = !!flow.do_not_proceed;

  const block = (label, content) =>
    el("div", { class: "section" }, [
      el("div", { class: "section-title" }, label),
      el("div", { class: "p", html: esc(content || "—") })
    ]);

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, `Table ${flow.table_no} — ${flow.title || ""}`),
      dnp ? el("div", { class: "banner" }, "DO NOT PROCEED") : null,

      block("Entering Service", sections["Entering Service"]),
      block("In Service", sections["In Service"]),
      block("Removing From Service", sections["Removing From Service"]),
      block("Reporting / Notes", sections["Reporting / Notes"]),

      el("div", { class: "p", html: `<strong>Traction:</strong> ${esc(flow.traction || "—")}<br><strong>Source:</strong> ${esc(flow.source || "—")}` }),

      el("button", { class: "secondary", onClick: () => tableListScreen() }, "Back to table list"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

/* Search all tables (no traction filter) */
function searchAllScreen() {
  const results = el("div", { id: "searchResults" });

  const input = el("input", {
    class: "searchbox",
    placeholder: "Search anything (e.g. AWS, brakes, Table 9, deer)…",
    onInput: (e) => renderSearchAllResults(e.target.value, results)
  });

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Search all tables"),
      input,
      results,
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );

  renderSearchAllResults("", results);
}

function renderSearchAllResults(q, container) {
  container.innerHTML = "";
  const term = norm(q);

  if (!term) {
    container.appendChild(el("div", { class: "p" }, "Type to search…"));
    return;
  }

  const hits = FLOWS.filter(f => {
    const hay = norm([
      f.table_no,
      f.title,
      f.traction,
      f.source,
      f.search,
      f.sections?.["Entering Service"],
      f.sections?.["In Service"],
      f.sections?.["Removing From Service"],
      f.sections?.["Reporting / Notes"]
    ].join(" | "));

    if (/^\d+$/.test(term) && String(f.table_no) === term) return true;
    return hay.includes(term);
  }).slice(0, 50);

  if (!hits.length) {
    container.appendChild(el("div", { class: "p" }, "No matches found."));
    return;
  }

  hits.forEach(f => {
    container.appendChild(
      el("button", { class: "primary", onClick: () => tableDetailScreen(f) },
        `Table ${f.table_no} — ${f.title || "(no title)"}`
      )
    );
  });

  container.appendChild(el("div", { class: "p" }, "Showing up to 50 matches."));
}

/* Boot */
async function boot() {
  showLoading();
  try {
    const resp = await fetch("data.json?v=12");
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
