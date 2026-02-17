let DATA = null;

/* ============================= */
/* Safe DOM Builder (Safari OK)  */
/* ============================= */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([k, v]) => {

    // Real click handlers
    if ((k === "onClick" || k === "onclick") && typeof v === "function") {
      node.addEventListener("click", v);
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

/* ============================= */
/* Screens                        */
/* ============================= */

function showLoading() {
  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "Loading…"),
    el("div", { class: "p" }, "Fetching dataset.")
  ]);
  setScreen(card);
}

function showError(message) {
  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "Could not load app"),
    el("div", { class: "p" }, message)
  ]);
  setScreen(card);
}

function home() {
  const card = el("div", { class: "card" }, [
    el("button",
      { class: "primary", onClick: () => startGuidance() },
      "Start fault guidance"
    ),
    el("button",
      { class: "secondary", onClick: () => searchTables() },
      "Search tables"
    )
  ]);

  setScreen(card);
}

function startGuidance() {
  const options = [...new Set(DATA.map(x => x.traction))];

  const buttons = options.map(t =>
    el("button",
      { class: "primary", onClick: () => selectTraction(t) },
      t
    )
  );

  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "What traction are you driving?"),
    ...buttons
  ]);

  setScreen(card);
}

function selectTraction(traction) {
  const systems = [...new Set(
    DATA.filter(x => x.traction === traction)
        .map(x => x.system)
  )];

  const buttons = systems.map(s =>
    el("button",
      { class: "primary", onClick: () => selectSystem(traction, s) },
      s
    )
  );

  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "What system is affected?"),
    ...buttons
  ]);

  setScreen(card);
}

function selectSystem(traction, system) {
  const tables = DATA.filter(
    x => x.traction === traction && x.system === system
  );

  const buttons = tables.map(t =>
    el("button",
      { class: "primary", onClick: () => viewTable(t.table) },
      "Table " + t.table
    )
  );

  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "Select table"),
    ...buttons
  ]);

  setScreen(card);
}

function viewTable(tableNumber) {
  const table = DATA.find(x => x.table === tableNumber);

  if (!table) {
    showError("Table not found.");
    return;
  }

  const sections = Object.entries(table.sections).map(([k, v]) =>
    el("div", { class: "section" }, [
      el("div", { class: "section-title" }, k),
      el("div", { class: "p" }, v)
    ])
  );

  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "Table " + table.table),
    ...sections,
    el("button",
      { class: "secondary", onClick: () => home() },
      "Home"
    )
  ]);

  setScreen(card);
}

function searchTables() {
  const input = el("input", {
    placeholder: "Search table text...",
    onInput: (e) => performSearch(e.target.value)
  });

  const container = el("div", { id: "searchResults" });

  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "Search"),
    input,
    container
  ]);

  setScreen(card);
}

function performSearch(term) {
  const container = document.getElementById("searchResults");
  container.innerHTML = "";

  const results = DATA.filter(x =>
    JSON.stringify(x).toLowerCase().includes(term.toLowerCase())
  );

  results.slice(0, 20).forEach(r => {
    container.appendChild(
      el("button",
        { class: "secondary", onClick: () => viewTable(r.table) },
        "Table " + r.table
      )
    );
  });
}

/* ============================= */
/* Boot                           */
/* ============================= */

async function boot() {
  showLoading();

  try {
    const resp = await fetch("data.json?v=4");
    if (!resp.ok) throw new Error("Failed to load dataset.");

    DATA = await resp.json();

    // Service worker disabled for now

    home();
  } catch (e) {
    showError(e.message);
  }
}

boot();
