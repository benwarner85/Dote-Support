let DATA = null;   // full object: { meta, taxonomy, flows }
let FLOWS = [];    // DATA.flows array
let state = { traction: null, query: "" };

/* ============================= */
/* Safe DOM Builder (Safari OK)  */
/* ============================= */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([k, v]) => {
    // Events
    if ((k === "onClick" || k === "onclick") && typeof v === "function") {
      node.addEventListener("click", v);
      return;
    }
    if (k === "onInput" && typeof v === "function") {
      node.addEventListener("input", v);
      return;
    }

    if (k === "html") node.innerHTML = v;
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
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/* ============================= */
/* Screens                        */
/* ============================= */
function showLoading() {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Loading…"),
      el("div", { class: "p" }, "Fetching dataset (first load can take a moment).")
    ])
  );
}

function showError(message) {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Could not load app"),
      el("div", { class: "p", html: esc(message) }),
      el("div", { class: "p" }, "Tip: try a Private tab if Safari is caching.")
    ])
  );
}

function home() {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "DOTE Decision Support (V1)"),
      el("div", { class: "p" }, "Choose guidance or search tables."),
      el("button", { class: "primary", onClick: () => tractionScreen() }, "Start fault guidance"),
      el("button", { class: "secondary", onClick: () => searchScreen() }, "Search tables"),
    ])
  );
}

function tractionScreen() {
  const tractions = [...new Set(FLOWS.map(f => (f.traction || "").trim()).filter(Boolean))].sort();

  const list = tractions.map(t =>
    el("button", { class: "primary", onClick: () => tableListScreen(t) }, t)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What traction are you driving?"),
      ...list,
      el("button", { class: "secondary", onClick: () => tableListScreen(null) }, "All traction"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

function tableListScreen(traction) {
  state.traction = traction;

  const matches = FLOWS
    .filter(f => !traction || f.traction === traction)
    .sort((a, b) => (a.table_no ?? 0) - (b.table_no ?? 0));

  const buttons = matches.slice(0, 80).map(f => {
    const title = `Table ${f.table_no} — ${f.title || ""}`;
    return el("button", { class: "primary", onClick: () => viewFlow(f) }, title);
  });

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, traction ? `Tables — ${traction}` : "Tables — All traction"),
      el("div", { class: "p" }, "Tap a table to view the guidance sections."),
      ...buttons,
      matches.length > 80 ? el("div", { class: "p" }, "Showing first 80. Use Search to find specific items.") : null,
      el("button", { class: "secondary", onClick: () => tractionScreen() }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

function viewFlow(f) {
  const sections = f.sections || {};

  const dnp = !!f.do_not_proceed;

  const sectionBlock = (label, klass, content) =>
    el("div", { class: `section ${klass}` }, [
      el("div", { class: "section-title" }, label),
      el("div", { class: "p", html: esc(content || "—") })
    ]);

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, `Table ${f.table_no} — ${f.title || ""}`),
      dnp ? el("div", { class: "banner" }, "DO NOT PROCEED") : null,

      sectionBlock("Entering Service", "blue", sections["Entering Service"]),
      sectionBlock("In Service", "red", sections["In Service"]),
      sectionBlock("Removing From Service", "orange", sections["Removing From Service"]),
      sectionBlock("Reporting / Notes", "green", sections["Reporting / Notes"]),

      el("div", { class: "p", html: `<strong>Source:</strong> ${esc(f.source || ("Table " + f.table_no))} • Dataset: V1` }),

      el("button", { class: "secondary", onClick: () => (state.traction ? tableListScreen(state.traction) : tableListScreen(null)) }, "Back"),
      el("button", { class: "secondary", onClick: () => home() }, "Home"),
    ])
  );
}

function searchScreen() {
  const input = el("input", {
    class: "searchbox",
    placeholder: "Search (e.g. AWS, brakes, Table 9, 16x)…",
    value: state.query || "",
    onInput: (e) => {
      state.query = e.target.value;
      renderSearchResults(e.target.value);
    }
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

  renderSearchResults(state.query || "");
}

function renderSearchResults(q) {
  const container = document.getElementById("searchResults");
  if (!container) return;
  container.innerHTML = "";

  const term = String(q || "").trim().toLowerCase();
  if (!term) {
    container.appendChild(el("div", { class: "p" }, "Type to search…"));
    return;
  }

  const hits = FLOWS.filter(f => {
    const hay = [
      f.id, f.table_no, f.title, f.traction, f.source,
      f.sections?.["Entering Service"],
      f.sections?.["In Service"],
      f.sections?.["Removing From Service"],
      f.sections?.["Reporting / Notes"]
    ].join(" | ").toLowerCase();

    // allow table number exact hit
    if (/^\d+$/.test(term) && String(f.table_no) === term) return true;

    return hay.includes(term);
  }).slice(0, 40);

  if (!hits.length) {
    container.appendChild(el("div", { class: "p" }, "No matches found."));
    return;
  }

  hits.forEach(f => {
    container.appendChild(
      el("button", { class: "primary", onClick: () => viewFlow(f) },
        `Table ${f.table_no} — ${f.title || ""}`
      )
    );
  });

  container.appendChild(el("div", { class: "p" }, "Showing up to 40 results."));
}

/* ============================= */
/* Boot                           */
/* ============================= */
async function boot() {
  showLoading();
  try {
    const resp = await fetch("data.json?v=5");
    if (!resp.ok) throw new Error("Failed to load data.json (" + resp.status + ")");

    DATA = await resp.json();
    FLOWS = Array.isArray(DATA.flows) ? DATA.flows : [];

    if (!FLOWS.length) throw new Error("Dataset loaded, but DATA.flows is empty.");

    // Service worker disabled for now (we’ll re-enable once stable)

    home();
  } catch (e) {
    showError(e.message || String(e));
  }
}

boot();
