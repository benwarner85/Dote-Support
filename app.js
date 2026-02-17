let DATA = null;
let FLOWS = [];
let state = {
  traction: null,
  system: null
};

function el(tag, props = {}, children = []) {
  const element = document.createElement(tag);

  Object.entries(props).forEach(([key, value]) => {
    if (key === "class") element.className = value;
    else if (key === "onclick") element.onclick = value;
    else element.setAttribute(key, value);
  });

  if (!Array.isArray(children)) children = [children];

  children.forEach(child => {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });

  return element;
}

function setScreen(content) {
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.appendChild(content);
}

function home() {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "DOTE Decision Support"),
      el("button", { class: "primary", onclick: tractionScreen }, "Start fault guidance"),
      el("button", { class: "secondary" }, "Search tables")
    ])
  );
}

function tractionScreen() {
  const tractions = [...new Set(FLOWS.map(f => f.traction).filter(Boolean))].sort();

  const buttons = tractions.map(t =>
    el("button", {
      class: "primary",
      onclick: () => systemScreen(t)
    }, t)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What traction are you driving?"),
      ...buttons,
      el("button", { class: "secondary", onclick: home }, "Back")
    ])
  );
}

function systemScreen(traction) {
  state.traction = traction;

  const systems = [...new Set(
    FLOWS
      .filter(f => f.traction === traction)
      .map(f => f.system)
      .filter(Boolean)
  )].sort();

  const buttons = systems.map(s =>
    el("button", {
      class: "primary",
      onclick: () => tableScreen(traction, s)
    }, s)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "What system is affected?"),
      el("div", { class: "p" }, `Traction: ${traction}`),
      ...buttons,
      el("button", { class: "secondary", onclick: tractionScreen }, "Back"),
      el("button", { class: "secondary", onclick: home }, "Home")
    ])
  );
}

function tableScreen(traction, system) {
  const matches = FLOWS
    .filter(f => f.traction === traction && f.system === system)
    .sort((a, b) => (a.table_no ?? 0) - (b.table_no ?? 0));

  const buttons = matches.map(f =>
    el("button", { class: "primary" }, `Table ${f.table_no}`)
  );

  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, system),
      el("div", { class: "p" }, `Traction: ${traction}`),
      ...buttons,
      el("button", { class: "secondary", onclick: () => systemScreen(traction) }, "Back"),
      el("button", { class: "secondary", onclick: home }, "Home")
    ])
  );
}

function showError(message) {
  setScreen(
    el("div", { class: "card" }, [
      el("div", { class: "h1" }, "Could not load app"),
      el("div", { class: "p" }, message),
      el("button", { class: "secondary", onclick: home }, "Retry")
    ])
  );
}

async function boot() {
  try {
    const resp = await fetch("data.json");
    if (!resp.ok) throw new Error("Failed to load dataset");

    DATA = await resp.json();
    FLOWS = DATA.flows || [];

    home();

  } catch (e) {
    showError(e.message);
  }
}

boot();
