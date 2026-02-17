let DATA = null;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });

  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (!c) return;
    if (typeof c === "string") {
      node.appendChild(document.createTextNode(c));
    } else if (c instanceof Node) {
      node.appendChild(c);
    }
  });

  return node;
}

function setScreen(content) {
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(content);
}

function showLoading() {
  const card = el("div", { class: "card" }, [
    el("div", { class: "h1" }, "Loading…"),
    el("div", { class: "p" }, "Fetching dataset. First load can take a moment.")
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
    el("button", {
      class: "primary",
      onclick: "startGuidance()"
    }, "Start fault guidance"),
    el("button", {
      class: "secondary",
      onclick: "searchTables()"
    }, "Search tables")
  ]);

  setScreen(card);
}

function startGuidance() {
  const options = [...new Set(DATA.map(x => x.traction))];

  const buttons = options.map(t =>
    el("button", {
      class: "primary",
      onclick: `selectTraction("${t}")`
    }, t)
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
    el("button", {
      class: "primary",
      onclick: `selectSystem("${traction}","${s}")`
    }, s)
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
    el("button", {
      class: "primary",
      onclick: `viewTable(${t.table})`
    }, `Table ${t.table}`)
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
    el("div", { class: "h1" }, `Table ${table.table}`),
    ...sections,
    el("button", {
      class: "secondary",
      onclick: "home()"
    }, "Home")
  ]);

  setScreen(card);
}

function searchTables() {
  const input = el("input", {
    placeholder: "Search table text...",
    oninput: "performSearch(this.value)"
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
  const results = DATA.filter(x =>
    JSON.stringify(x).toLowerCase().includes(term.toLowerCase())
  );

  const container = document.getElementById("searchResults");
  container.innerHTML = "";

  results.slice(0, 20).forEach(r => {
    container.appendChild(
      el("button", {
        class: "secondary",
        onclick: `viewTable(${r.table})`
      }, `Table ${r.table}`)
    );
  });
}

async function boot() {
  showLoading();

  try {
    const resp = await fetch("data.json?v=2");
    if (!resp.ok) throw new Error("Failed to load dataset.");

    DATA = await resp.json();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js");
    }

    home();
  } catch (e) {
    showError(e.message);
  }
}

boot();
