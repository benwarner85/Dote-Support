let DATA=null;
const state={ traction:null, query:"", selected:null };

function el(tag, attrs={}, children=[]){
  const e=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k==="class") e.className=v;
    else if(k==="html") e.innerHTML=v;
    else if(k.startsWith("on") && typeof v==="function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k,v);
  });
  children.forEach(c=>e.appendChild(c));
  return e;
}
function setScreen(node){ const root=document.getElementById("app"); root.innerHTML=""; root.appendChild(node); }

function home(){
  const card=el("div",{class:"card"},[
    el("div",{class:"h1",html:"DOTE Decision Support (V1)"}),
    el("div",{class:"p",html:"Read-only pilot using the full dataset (Tables 1–154 + placeholders 155–250). Works offline once opened once."}),
    el("button",{class:"btn",onClick:()=>tractionScreen()},["Start fault guidance"]),
    el("button",{class:"btn secondary",onClick:()=>searchScreen()},["Search tables"]),
    el("div",{class:"kicker",html:"Tip: open once online, then switch to Airplane Mode to test offline."})
  ]);
  setScreen(card);
}

function tractionScreen(){
  const tractions=[...new Set((DATA.flows||[]).map(f=>f.traction).filter(t=>t))].sort();
  const card=el("div",{class:"card"},[ el("div",{class:"h1",html:"Filter by traction (optional)"}),
    el("div",{class:"p",html:"Choose a traction to narrow search results, or skip to search everything."})
  ]);

  card.appendChild(el("button",{class:"listbtn primary",onClick:()=>{state.traction=null; searchScreen();}},["All traction", el("span",{html:"›"})]));
  tractions.slice(0,50).forEach(t=>{
    card.appendChild(el("button",{class:"listbtn",onClick:()=>{state.traction=t; searchScreen();}},[document.createTextNode(t), el("span",{html:"›"})]));
  });

  card.appendChild(el("div",{class:"row"},[
    el("button",{class:"btn secondary",onClick:()=>home()},["Home"])
  ]));
  setScreen(card);
}

function searchScreen(){
  const card=el("div",{class:"card"},[
    el("div",{class:"h1",html:"Search tables"}),
    el("div",{class:"p",html:"Search by keywords, traction, or table number (e.g. <strong>9</strong>, <strong>AWS</strong>, <strong>brake</strong>, <strong>80x</strong>)."})
  ]);

  if(state.traction){
    card.appendChild(el("div",{class:"small",html:`Filter: <strong>${escapeHtml(state.traction)}</strong> <span class="badge2">tap ‘All traction’ to clear</span>`}));
  }

  const input=el("input",{class:"searchbox",type:"search",placeholder:"Search…",value:state.query||""});
  const results=el("div",{style:"margin-top:10px;"});

  function norm(s){ return String(s||"").toLowerCase(); }

  function matchFlow(f,q){
    if(state.traction && f.traction !== state.traction) return false;
    if(!q) return true;
    const tableHit = String(f.table_no) === q.trim();
    if(tableHit) return true;
    const hay=(f.search||"") + " | " + norm(f.sections["Entering Service"]) + " | " + norm(f.sections["In Service"]) + " | " + norm(f.sections["Removing From Service"]) + " | " + norm(f.sections["Reporting / Notes"]);
    return hay.includes(q.trim());
  }

  function render(){
    results.innerHTML="";
    const q=norm(input.value);
    state.query=input.value;
    const matches=(DATA.flows||[]).filter(f=>matchFlow(f,q)).slice(0,40);

    if(!matches.length){
      results.appendChild(el("div",{class:"kicker",html:"No matches found."}));
      return;
    }

    matches.forEach(f=>{
      const title = `Table ${f.table_no} — ${f.title}`;
      const btn=el("button",{class:"listbtn primary",onClick:()=>resultScreen(f)},[document.createTextNode(title), el("span",{html:"›"})]);
      results.appendChild(btn);
      results.appendChild(el("div",{class:"kicker",html:`${escapeHtml(f.traction||"")} • ${escapeHtml(f.source||"")}${f.placeholder ? " • (placeholder)" : ""}`}));
    });

    results.appendChild(el("div",{class:"kicker",html:"Showing up to 40 results. Refine your search to narrow further."}));
  }

  input.addEventListener("input",render);
  card.appendChild(input);
  card.appendChild(results);

  // First paint
  render();

  card.appendChild(el("div",{class:"row"},[
    el("button",{class:"btn secondary",onClick:()=>home()},["Home"]),
    el("button",{class:"btn secondary",onClick:()=>tractionScreen()},["Traction"])
  ]));

  setScreen(card);
}

function section(title,color,content){
  const s=el("div",{class:`section ${color}`},[
    el("div",{class:"head",html:title}),
    el("div",{class:"body"})
  ]);
  s.querySelector(".body").appendChild(el("pre",{html:escapeHtml(content || "—")}));
  return s;
}

function resultScreen(f){
  const card=el("div",{class:"card"},[
    el("div",{class:"h1",html:`Table ${f.table_no} — ${escapeHtml(f.title)}`})
  ]);

  if(f.do_not_proceed && !f.placeholder){
    card.appendChild(el("div",{class:"banner",html:"DO NOT PROCEED"}));
  }

  card.appendChild(section("ENTERING SERVICE","blue", f.sections["Entering Service"]));
  card.appendChild(section("IN SERVICE","red", f.sections["In Service"]));
  card.appendChild(section("REMOVING FROM SERVICE","orange", f.sections["Removing From Service"]));
  card.appendChild(section("REPORTING / NOTES","green", f.sections["Reporting / Notes"]));

  card.appendChild(el("div",{class:"kicker",html:`<strong>Source:</strong> ${escapeHtml(f.source || ("Table "+f.table_no))} • Dataset: V1`}));

  card.appendChild(el("div",{class:"row"},[
    el("button",{class:"btn secondary",onClick:()=>searchScreen()},["Back"]),
    el("button",{class:"btn secondary",onClick:()=>home()},["Home"])
  ]));

  setScreen(card);
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function showLoading(){
  const card = el("div",{class:"card"},[
    el("div",{class:"h1",html:"Loading…"}),
    el("div",{class:"p",html:"Fetching dataset. First load can take a moment."})
  ]);
  setScreen(card);
}

async function boot(){
  showLoading();

  try{
    // cache-bust to avoid stale cached copies
    const resp = await fetch("data.json?v=1");
    if(!resp.ok) throw new Error("data.json failed: " + resp.status);

    DATA = await resp.json();

    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("sw.js");
    }

    home();
  }catch(e){
    const card = el("div",{class:"card"},[
      el("div",{class:"h1",html:"Could not load app"}),
      el("div",{class:"p",html:"This usually means a JavaScript error or a cached old file."}),
      el("div",{class:"p",html:"Try reloading in a Private tab, or clear Website Data for github.io."}),
      el("div",{class:"kicker",html:String(e)})
    ]);
    setScreen(card);
  }
}
boot();
