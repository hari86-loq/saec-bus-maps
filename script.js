const D=window.SAEC_DATA;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state={view:"home",dataset:"general",bus:"3",session:"morning"};

// Reliable dark/light mode switch: dark = black + green, light = white + blue.
(function initThemeToggle(){
  const btn=document.getElementById("themeToggle");
  if(!btn)return;
  const icon=document.getElementById("themeSwitchIcon");
  const meta=document.querySelector('meta[name="theme-color"]');
  let saved="dark";
  try{saved=localStorage.getItem("saec-theme")||"dark";}catch(e){}
  function applyTheme(theme){
    const light=theme==="light";
    document.body.classList.toggle("light",light);
    btn.classList.toggle("is-light",light);
    btn.setAttribute("aria-pressed",String(light));
    btn.setAttribute("aria-label",light?"Switch to dark mode":"Switch to light mode");
    btn.title=light?"Switch to dark mode":"Switch to light mode";
    if(icon)icon.textContent=light?"☀":"☾";
    if(meta)meta.setAttribute("content",light?"#f7fbff":"#070b10");
    try{localStorage.setItem("saec-theme",light?"light":"dark");}catch(e){}
  }
  btn.addEventListener("click",()=>applyTheme(document.body.classList.contains("light")?"dark":"light"));
  applyTheme(saved==="light"?"light":"dark");
})();

const traffic={Monday:{p:90,m:1.30,type:"Peak"},Tuesday:{p:45,m:1.10,type:"Average"},Wednesday:{p:50,m:1.10,type:"Average"},Thursday:{p:45,m:1.10,type:"Average"},Friday:{p:95,m:1.30,type:"Peak"},Saturday:{p:35,m:1.00,type:"Lower"}};

function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function busesFor(ds=state.dataset){return Object.entries(D.buses).filter(([id,b])=>b[ds]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true}))}
function route(id,ds=state.dataset){return D.buses[String(id)]?.[ds]||[]}
function minutes(t){let [h,m]=t.split(":").map(Number);return h*60+m}
function fmt24(m){m=(m+1440)%1440;let h=Math.floor(m/60),mm=String(m%60).padStart(2,"0"),ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${mm} ${ap}`}
function indiaNowMinutes(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:D.timezone,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const get=k=>Number(parts.find(x=>x.type===k)?.value||0);
  return get("hour")*60+get("minute")+get("second")/60;
}
function nowMinutes(){return indiaNowMinutes()}
function eveningRouteFor(id,ds=state.dataset){
  const morning=route(id,ds);
  if(!morning.length)return [];
  // Evening runs in the reverse direction, starting at college at 4:00 PM.
  // Preserve each adjacent stop-to-stop duration from the morning timetable.
  const collegeIndex=morning.map(x=>/college/i.test(x.stop)).lastIndexOf(true);
  const base=collegeIndex>=0
    ? morning.slice(0,collegeIndex+1)
    : [...morning,{stop:"COLLEGE",time:morning.at(-1)?.time||"08:00"}];
  const stops=base.slice(0,-1).reverse();
  const eveningStops=[{stop:"COLLEGE",time:"16:00"},...stops];
  const times=[16*60];
  let elapsed=16*60;
  for(let i=base.length-2;i>=0;i--){
    const gap=Math.max(1,Math.abs(minutes(base[i+1].time)-minutes(base[i].time)));
    elapsed+=gap;
    times.push(elapsed);
  }
  return eveningStops.map((x,i)=>({stop:x.stop,time:fmtTimeRaw(times[i]??(16*60))}));
}
function sessionRoute(id){
  if(state.session==="morning")return route(id);
  return eveningRouteFor(id,state.dataset);
}
function getDemoEveningRoute(id,ds=state.dataset){return eveningRouteFor(id,ds)}
function fmtTimeRaw(m){m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function activeRoute(id){return sessionRoute(id)}

function position(id){
  const r=activeRoute(id); if(!r.length)return {status:"No data",idx:0,progress:0,pos:0};
  const t=nowMinutes(), parsed=r.map(x=>minutes(x.time));
  if(t<parsed[0])return {status:"Scheduled",idx:0,progress:0,pos:0};
  if(t>=parsed[parsed.length-1])return {status:"Reached College / Completed",idx:parsed.length-1,progress:100,pos:100};
  for(let i=0;i<parsed.length-1;i++){
    let a=parsed[i],b=parsed[i+1];
    if(t===a)return {status:"Arrived (scheduled)",idx:i,progress:i/(r.length-1)*100,pos:i/(r.length-1)*100};
    if(t>a && t<b){
      let q=(t-a)/(b-a);
      return {status:"En route (simulated)",idx:i,progress:(i+q)/(r.length-1)*100,pos:(i+q)/(r.length-1)*100,next:r[i+1]};
    }
    if(b<=a && t>=a){return {status:"Source timing anomaly",idx:i+1,progress:(i+1)/(r.length-1)*100,pos:(i+1)/(r.length-1)*100,next:r[i+2]}}
  }
  return {status:"Scheduled",idx:0,progress:0,pos:0};
}

function renderClock(){
  const d=new Date(), opts={timeZone:D.timezone,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true};
  const t=new Intl.DateTimeFormat("en-IN",opts).format(d);
  $("#liveClock").textContent=t; $("#heroClock").textContent=t.slice(0,5);
  $("#heroDate").textContent=new Intl.DateTimeFormat("en-IN",{timeZone:D.timezone,weekday:"long",day:"2-digit",month:"short"}).format(d);
  if(state.view==="tracking")renderTracking(false);
  if(state.view==="time-tracking")renderTimeTracking(false);
  // Dashboard content is static between user actions; rebuilding it every
  // second was unnecessary work and could cause visible mobile jank.
  renderTimeTrackingClock();
}
setInterval(renderClock,1000); renderClock();

function updateBottomNav(v=state.view){
  $$("#bottomMainMenu [data-view]").forEach(btn=>{
    const active=btn.dataset.view===v;
    btn.classList.toggle("menu-highlight",active);
    btn.setAttribute("aria-current",active?"page":"false");
  });
}
function showView(v){
  state.view=v; $$(".view").forEach(x=>x.classList.remove("active")); $("#view-"+v)?.classList.add("active");
  updateBottomNav(v);
  $("#drawer").classList.remove("open");$("#scrim").classList.remove("show");
  if(v==="dashboard")renderDashboard(); if(v==="tracking")renderTracking(true); if(v==="time-tracking")renderTimeTracking(true); if(v==="buses")renderBuses(); if(v==="routes")renderRoutes(); if(v==="schedules")renderSchedule(); if(v==="traffic")renderTraffic(); if(v==="search")renderSearch("");
  window.scrollTo({top:0,behavior:"smooth"});
}
document.addEventListener("click",e=>{const v=e.target.closest("[data-view]");if(v){e.preventDefault();showView(v.dataset.view)}});
$("#menuBtn").onclick=()=>{$("#drawer").classList.add("open");$("#scrim").classList.add("show")};
$("#closeMenu").onclick=()=>{$("#drawer").classList.remove("open");$("#scrim").classList.remove("show")};
$("#scrim").onclick=()=>{$("#drawer").classList.remove("open");$("#scrim").classList.remove("show")};

function fillBusSelects(){
  const arr=busesFor(state.dataset);
  const opts=arr.map(([id])=>`<option value="${id}">Bus ${id}</option>`).join("");
  ["#busSelect","#scheduleBus"].forEach(s=>{const el=$(s);el.innerHTML=opts;el.value=state.bus;});
}
$("#datasetSelect").onchange=e=>{state.dataset=e.target.value;fillBusSelects();renderTracking(true);};
$("#busSelect").onchange=e=>{state.bus=e.target.value;renderTracking(true)};
$$("[data-session]").forEach(b=>b.onclick=()=>{state.session=b.dataset.session;$$("[data-session]").forEach(x=>x.classList.toggle("active",x.dataset.session===state.session));renderTracking(true);renderRoutes();});

function renderDashboard(){
  const arr=busesFor("general"), allStops=new Set(arr.flatMap(([_,b])=>b.general.map(x=>x.stop)));
  const arrivals=arr.map(([id,b])=>({id,t:b.general.at(-1)?.time,route:b.general[0]?.stop})).filter(x=>x.t).sort((a,b)=>minutes(a.t)-minutes(b.t));
  const reached=arrivals.filter(x=>minutes(x.t)<=nowMinutes()).length;
  $("#metrics").innerHTML=[
    ["BUS FLEET",arr.length,"timetable entries"],
    ["UNIQUE STOPS",allStops.size,"across college timetable"],
    ["FIRST DEPARTURE",arrivals[0]?.t||"—","earliest listed"],
    ["REACHED",`${reached}/${arrivals.length}`,"scheduled by clock"]
  ].map(x=>`<div class="metric"><small>${x[0]}</small><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join("");
  $("#upcoming").innerHTML=arrivals.slice(0,7).map(x=>`<div class="arrival"><div><b>Bus ${x.id}</b><small>${x.route}</small></div><b>${fmt24(minutes(x.t))}</b></div>`).join("");
  $("#weekBars").innerHTML=Object.entries(traffic).map(([d,x])=>`<div class="week-bar" title="${x.type} traffic"><i style="--h:${Math.max(28,x.p*1.35)}px"></i><b>${d.slice(0,3)}</b><small>${x.p}%</small></div>`).join("");
}

function renderTracking(force=true){
  fillBusSelects();
  const id=state.bus, r=activeRoute(id), p=position(id), title=`Bus ${id} · ${state.session==="morning"?"Morning":"Evening"}`;
  $("#routeLabel").textContent=state.session==="morning"?"MORNING ROUTE":"EVENING · DEMO RETURN";
  $("#trackingTitle").textContent=title;
  $("#statusPill").textContent=p.status.toUpperCase();
  $("#positionTime").textContent=fmt24(Math.floor(nowMinutes()));
  const cur=r[p.idx]?.stop||"—", next=p.next?.stop||(r[p.idx+1]?.stop||"—");
  $("#currentStop").textContent=cur;$("#nextStop").textContent=next;$("#collegeTime").textContent=fmt24(minutes(r.at(-1).time));
  $("#positionText").textContent=state.session==="evening"?"Calculated evening demo: starts from college at 4:00 PM and follows the morning stop-to-stop minute gaps in reverse order. This is a suggested schedule, not an official timetable.":`Scheduled position for Bus ${id}. The marker interpolates between consecutive timetable times and lands on the stop at its scheduled minute.`;
  $("#progressBar").style.width=p.progress+"%";
  const n=r.length;
  const mapEl=$("#routeMap");
  const mapWidth=Math.max(mapEl.clientWidth||320, n*118+36);
  const trackWidth=Math.max(280,mapWidth-28);
  const step=n>1?(trackWidth-56)/(n-1):0;
  mapEl.innerHTML=`<div class="route-map-track" style="width:${trackWidth}px"><div class="route-line"></div>`+r.map((x,i)=>{let left=28+step*i;let college=/college/i.test(x.stop);return `<button class="stop-node ${college?"college":""}" style="left:${left}px" title="${x.stop} · ${fmt24(minutes(x.time))}"><div class="dot">${college?"▦":i+1}</div><b>${x.stop}</b><small>${fmt24(minutes(x.time))}</small></button>`}).join("")+`<div class="bus-marker" id="busMarker" style="left:${28+step*(n>1?p.pos/100*(n-1):0)}px">🚌</div></div>`;
  $("#stopMiniList").innerHTML=r.map((x,i)=>`<div class="mini-stop"><span>${i+1}. ${x.stop}</span><b>${fmt24(minutes(x.time))}</b></div>`).join("");
  $$("#routeMap .stop-node").forEach((el,i)=>el.onclick=()=>toast(`${r[i].stop} · ${fmt24(minutes(r[i].time))}`));
}


/* Time Tracking — timetable-first simulation */
let ttState={session:"morning",dataset:"general",bus:"3"};
function ttSourceRoute(){return route(ttState.bus,ttState.dataset)}
function ttEveningRouteFor(id=ttState.bus,ds=ttState.dataset){
  return eveningRouteFor(id,ds);
}
function ttEveningRoute(){return ttEveningRouteFor(ttState.bus,ttState.dataset)}
function ttRoute(){return ttState.session==="morning"?ttSourceRoute():ttEveningRoute()}
function ttNowMinutes(){return indiaNowMinutes()}
function ttPosition(r){
  if(!r.length)return {status:"No schedule data",idx:0,pos:0,current:"—",next:"—"};
  const now=ttNowMinutes(), times=r.map(x=>minutes(x.time));
  if(now<times[0])return {status:"Scheduled · waiting to depart",idx:0,pos:0,current:r[0].stop,next:r[1]?.stop||"—"};
  if(now>=times.at(-1))return {status:ttState.session==="morning"?"Reached College · scheduled":"Reached Home · scheduled",idx:r.length-1,pos:100,current:r.at(-1).stop,next:"—"};
  for(let i=0;i<times.length-1;i++){
    const a=times[i],b=times[i+1];
    if(now===a)return {status:"Arrived · scheduled",idx:i,pos:i/(r.length-1)*100,current:r[i].stop,next:r[i+1]?.stop||"—"};
    if(now>a && now<b){
      const q=(now-a)/(b-a), x=((i+q)/(r.length-1))*100;
      return {status:"En route · simulated",idx:i,pos:x,current:r[i].stop,next:r[i+1]?.stop||"—"};
    }
  }
  return {status:"Scheduled",idx:0,pos:0,current:r[0].stop,next:r[1]?.stop||"—"};
}
function ttBusOptions(){
  const arr=busesFor(ttState.dataset); return arr.map(([id])=>`<option value="${id}">Bus ${id}</option>`).join("");
}
function renderTimeTrackingClock(){
  const c=document.getElementById("ttClock"),d=document.getElementById("ttClockDate"); if(!c)return;
  const now=new Date();
  c.textContent=new Intl.DateTimeFormat("en-IN",{timeZone:D.timezone,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}).format(now);
  d.textContent=new Intl.DateTimeFormat("en-IN",{timeZone:D.timezone,weekday:"long",day:"2-digit",month:"short",year:"numeric"}).format(now);
}
function renderTimeTracking(force=true){
  const busSel=document.getElementById("ttBusSelect"), dsSel=document.getElementById("ttDatasetSelect");
  if(!busSel)return;
  const arr=busesFor(ttState.dataset); if(!arr.some(([id])=>id===String(ttState.bus))) ttState.bus=arr[0]?.[0]||"";
  // Rebuild controls only after a user changes the route; doing this every second
  // can steal focus and make mobile scrolling feel jumpy.
  if(force || !busSel.options.length){busSel.innerHTML=ttBusOptions();}
  busSel.value=ttState.bus; dsSel.value=ttState.dataset;
  const r=ttRoute(), p=ttPosition(r), title=`Bus ${ttState.bus}`;
  document.getElementById("ttRouteLabel").textContent=ttState.session==="morning"?"MORNING · HOME → COLLEGE":"EVENING · COLLEGE → HOME";
  document.getElementById("ttBusTitle").textContent=title;
  document.getElementById("ttStatus").textContent=p.status;
  document.getElementById("ttCurrent").textContent=p.current;
  document.getElementById("ttNext").textContent=p.next;
  document.getElementById("ttDestination").textContent=r.at(-1)?.stop||"—";
  document.getElementById("ttArrival").textContent=r.at(-1)?fmt24(minutes(r.at(-1).time)):"—";
  document.getElementById("ttProgress").style.width=p.pos+"%";
  document.getElementById("ttTimelineTitle").textContent=`Bus ${ttState.bus} · ${ttState.session==="morning"?"Morning":"Evening return"}`;
  document.getElementById("ttSourceLabel").textContent=ttState.session==="morning"?`Source: ${ttState.dataset==="general"?"college timetable":"first-year timetable"}`:"Evening return schedule · all times in PM";
  document.getElementById("ttExplain").textContent=ttState.session==="morning"?"The marker is calculated from the listed arrival times. At the exact scheduled minute it lands on that stop; between stops it moves proportionally through the scheduled interval.":"Evening buses depart college at 4:00 PM. Stops run in reverse order, keeping the same minute gaps as the morning timetable; evening times are shown in PM.";

  // One-second refreshes update only live values. Keep route DOM intact so the
  // horizontal scroll position never jumps back to the first stop.
  if(!force){
    const canvasNow=document.getElementById("ttRouteCanvas");
    const markerNow=canvasNow?.querySelector(".tt-bus-marker");
    const trackNow=canvasNow?.querySelector(".tt-route-track");
    if(markerNow && trackNow){
      const w=trackNow.clientWidth;
      markerNow.style.left=(r.length?16+(p.pos/100)*(w-32):16)+"px";
    }
    document.querySelectorAll("#ttTimeline .tt-timeline-item").forEach((item,i)=>item.classList.toggle("active",i===p.idx));
    renderTimeTrackingClock();
    return;
  }

  const canvas=document.getElementById("ttRouteCanvas"); canvas.innerHTML="";
  // Give each stop its own horizontal space; narrow screens can scroll without labels colliding.
  const trackWidth=Math.max(canvas.clientWidth||320,r.length*132+32);
  const track=document.createElement("div");track.className="tt-route-track";track.style.width=trackWidth+"px";canvas.appendChild(track);
  const line=document.createElement("div");line.className="tt-route-line";track.appendChild(line);
  r.forEach((x,i)=>{
    const isCollege=ttState.session==="morning"?i===r.length-1:i===0;
    const left=r.length<=1?trackWidth/2:16+(i/(r.length-1))*(trackWidth-32);
    const stop=document.createElement("button"); stop.type="button"; stop.className="tt-route-stop"+(isCollege?" college":""); stop.style.left=left+"px";
    stop.innerHTML=`<span class="tt-stop-icon">${isCollege?"⌂":"🚏"}</span><b>${x.stop}</b><small>${fmt24(minutes(x.time))}</small>`;
    stop.onclick=()=>toast(`${x.stop} · ${fmt24(minutes(x.time))} · ${ttState.session==="morning"?"Morning":"Evening"}`); track.appendChild(stop);
  });
  const marker=document.createElement("div");marker.className="tt-bus-marker";marker.style.left=(r.length?16+(p.pos/100)*(trackWidth-32):16)+"px";marker.textContent="🚌";track.appendChild(marker);
  document.getElementById("ttTimeline").innerHTML=r.map((x,i)=>`<div class="tt-timeline-item ${i===p.idx?"active":""}"><span class="tt-step">${i+1}</span><div><b>${x.stop}</b><small>${i===0?(ttState.session==="morning"?"Starting stop":"College departure"):i===r.length-1?(ttState.session==="morning"?"College":"Home"):(ttState.session==="morning"?"Intermediate stop":"Return stop")}</small></div><strong>${fmt24(minutes(x.time))}</strong></div>`).join("");
  document.querySelectorAll("[data-tt-session]").forEach(b=>b.classList.toggle("active",b.dataset.ttSession===ttState.session));
  const fleet=document.getElementById("ttFleet");
  if(fleet){
    fleet.innerHTML=busesFor(ttState.dataset).map(([id])=>{
      const fr=ttState.session==="morning"?route(id,ttState.dataset):ttEveningRouteFor(id,ttState.dataset);
      const fp=ttPosition(fr);
      return `<button type="button" class="tt-fleet-row" data-fleet-bus="${id}"><span class="tt-fleet-bus">Bus ${id}</span><span>${fp.current}</span><span class="tt-fleet-status">${fp.status}</span><strong>${fr.at(-1)?fmt24(minutes(fr.at(-1).time)):"—"}</strong></button>`;
    }).join("");
    fleet.querySelectorAll("[data-fleet-bus]").forEach(b=>b.onclick=()=>{ttState.bus=b.dataset.fleetBus;renderTimeTracking(true);});
  }
  renderTimeTrackingClock();
}
function initTimeTracking(){
  const bus=document.getElementById("ttBusSelect");if(!bus)return;
  bus.onchange=e=>{ttState.bus=e.target.value;renderTimeTracking(true)};
  document.getElementById("ttDatasetSelect").onchange=e=>{ttState.dataset=e.target.value;ttState.bus=busesFor(ttState.dataset)[0]?.[0]||"";renderTimeTracking(true)};
  document.querySelectorAll("[data-tt-session]").forEach(b=>b.onclick=()=>{ttState.session=b.dataset.ttSession;renderTimeTracking(true)});
  renderTimeTracking(true);
}
initTimeTracking();

function renderBuses(){
  const ds=$("#busDataset").value||"general", arr=busesFor(ds), q=($("#busFilter").value||"").toLowerCase();
  const filtered=arr.filter(([id,b])=>{let r=b[ds];return !q||String(id).toLowerCase().includes(q)||r.some(x=>x.stop.toLowerCase().includes(q))});
  $("#busCount").textContent=`${filtered.length} buses`;
  $("#busGrid").innerHTML=filtered.map(([id,b])=>{let r=b[ds];return `<article class="bus-card"><div class="bus-number">${id}</div><small>${r[0]?.stop||"—"} → ${r.at(-1)?.stop||"—"}</small><footer><span>${r.length} stops</span><span>${r.at(-1)?.time||"—"}</span></footer><button onclick="openBus('${id}','${ds}')">View route →</button></article>`}).join("");
}
window.openBus=(id,ds)=>{state.dataset=ds;state.bus=id;showView("tracking");$("#datasetSelect").value=ds};
$("#busDataset").onchange=renderBuses;$("#busFilter").oninput=renderBuses;

function renderRoutes(){
  const ds=$("#busDataset").value||state.dataset, arr=busesFor(ds);
  $("#routesList").innerHTML=arr.map(([id,b])=>{const r=state.session==="morning"?b[ds]:getDemoEveningRoute(id,ds);return `<article class="route-row"><div class="route-row-head"><div><span class="eyebrow">BUS ${id}</span><h3>${r[0]?.stop||"—"} → ${r.at(-1)?.stop||"—"}</h3></div><span>${r.length} stops</span></div><div class="route-stops">${r.map((x,i)=>`<span><b><i>${i+1}</i>${x.stop}</b><small>${fmt24(minutes(x.time))}</small></span>`).join("")}</div></article>`}).join("");
}

function renderSchedule(){
  const ds=$("#scheduleDataset").value, id=$("#scheduleBus").value||state.bus, r=route(id,ds);
  $("#scheduleCard").innerHTML=`<div class="panel-head"><div><span class="eyebrow">BUS ${id}</span><h3>${ds==="general"?"College timetable":"First-year timetable"}</h3></div><span class="muted">${r.length} listed stops</span></div><table><thead><tr><th>#</th><th>STOP</th><th>SCHEDULED</th></tr></thead><tbody>${r.map((x,i)=>`<tr><td>${i+1}</td><td>${x.stop}</td><td>${fmt24(minutes(x.time))}</td></tr>`).join("")}</tbody></table>`;
}
$("#scheduleDataset").onchange=()=>{fillBusSelects();renderSchedule()};$("#scheduleBus").onchange=e=>{state.bus=e.target.value;renderSchedule()};

function renderTraffic(){
  $("#trafficGrid").innerHTML=Object.entries(traffic).map(([d,x])=>`<article class="traffic-card ${x.type==="Peak"?"peak":""}"><small>${d}</small><b>${x.p}%</b><span>${x.type} · ${x.m.toFixed(2)}×</span></article>`).join("");
}
function renderSearch(q){
  const query=(q||"").trim().toLowerCase();
  if(!query){$("#searchResults").innerHTML=`<div class="panel"><h3>Search the transport network</h3><p class="muted">Try “Bus 3”, “Pudumadam”, “Valantharavai”, “College”, or a route stop.</p></div>`;return}
  const results=[];
  for(const [id,b] of Object.entries(D.buses))for(const ds of ["general","firstYear"])if(b[ds]){
    const hits=b[ds].filter(x=>x.stop.toLowerCase().includes(query));
    if(String(id).toLowerCase().includes(query)||hits.length)results.push({id,ds,hits,first:b[ds][0].stop,last:b[ds].at(-1).stop});
  }
  $("#searchResults").innerHTML=results.slice(0,30).map(x=>`<button class="result" onclick="openBus('${x.id}','${x.ds}')"><b>Bus ${x.id}</b> · ${x.ds==="general"?"College":"First-year"}<small>${x.hits.length?x.hits.map(h=>`${h.stop} · ${fmt24(minutes(h.time))}`).join(" · "):x.first+" → "+x.last}</small></button>`).join("")||`<div class="panel"><p>No matching bus or stop.</p></div>`;
}
$("#globalSearch").oninput=e=>renderSearch(e.target.value);

fillBusSelects();renderDashboard();renderBuses();renderRoutes();renderSchedule();renderTraffic();updateBottomNav(state.view);


/* SAEC Bus Map v2 — exact timetable interpolation helper.
   For stops A(tA) and B(tB), at tB the marker is exactly at B. */
window.SAECSchedule = {
  clamp01: function(v) { return Math.max(0, Math.min(1, v)); },
  minutes: function(hhmm) {
    const p = String(hhmm).trim().split(":").map(Number);
    return p[0] * 60 + p[1];
  },
  interpolate: function(a, b, nowMinutes) {
    const ta = this.minutes(a.time), tb = this.minutes(b.time);
    if (nowMinutes <= ta) return { progress: 0, from: a, to: b };
    if (nowMinutes >= tb) return { progress: 1, from: a, to: b };
    const progress = this.clamp01((nowMinutes - ta) / (tb - ta));
    return { progress: progress, from: a, to: b };
  }
};



