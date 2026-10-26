/* Virtual Diesel Trainer: panels, practice mode, guided jobs and the 3D model. */
import {SYS,PARTS,SERVICES,CAUSES,SYMPTOMS} from "./data/engine.js";
import {CDET,LAMPS,EMERG,REFV} from "./data/faults.js";
import {SCEN} from "./data/scenarios.js";
import {POSE0,PROCS} from "./data/jobs.js";
import {audioUpdate} from "./audio.js";
import * as store from "./store.js";
import "./shell.js";

/* three.js loads from the CDN (cached by the service worker). If it fails, the text tabs still work. */
var THREE=null;
try{
  var mods=await Promise.all([import("three"),import("three/examples/jsm/controls/OrbitControls.js")]);
  THREE=Object.assign({},mods[0],{OrbitControls:mods[1].OrbitControls});
}catch(e){console.warn("3D unavailable",e)}

(function(){
"use strict";
var $=function(id){return document.getElementById(id)};


/* ---------- panels ---------- */
var selected=null, sysFilter=null, api={select:function(){},refresh:function(){}};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function partBtn(label,id,right){
  return '<li><button data-part="'+(id||"")+'"'+(id?'':' disabled')+'><span>'+esc(label)+'</span>'+(right?'<small>'+esc(right)+'</small>':'')+'</button></li>';
}
function renderPart(){
  var el=$("pPart");syncHash();
  if(!selected){
    el.innerHTML='<h2>Pick a part</h2><p>Click any component on the model to see what it does, when it is serviced and which faults point to it.</p>'+
      '<p class="muted">Drag to rotate. Scroll or pinch to zoom. Use the system buttons under the model to isolate fuel, cooling, oil, air, electrical or the drive.</p>'+
      '<div><h3>All parts</h3><ul class="list">'+Object.keys(PARTS).map(function(k){return partBtn(PARTS[k].n,k,SYS[PARTS[k].s].name)}).join("")+'</ul></div>'+
      '<p class="note">Training concept only. Intervals follow the D2-60F service protocol you supplied. Always work from the manufacturer\'s manual for your exact engine, with the engine stopped and the battery isolated.</p>';
    return;
  }
  var p=PARTS[selected], sv=[], fl=[];
  SERVICES.forEach(function(s){s.t.forEach(function(t){if(t[1]===selected)sv.push([t[0],"Service "+s.c])})});
  SYMPTOMS.forEach(function(s){s[1].forEach(function(c){if(CAUSES[c][1]===selected)fl.push([s[0],CAUSES[c][0]])})});
  el.innerHTML='<div><span class="tag"><span class="dot" style="background:'+SYS[p.s].color+'"></span>'+SYS[p.s].name+'</span>'+(p.m?' <span class="tag">Manual item '+p.m+'</span>':'')+'</div>'+
    '<h2>'+esc(p.n)+'</h2><p>'+esc(p.d)+'</p>'+
    '<div><h3>Scheduled service</h3>'+(sv.length?'<ul class="list">'+sv.map(function(x){return '<li><button disabled><span>'+esc(x[0])+'</span><small>'+x[1]+'</small></button></li>'}).join("")+'</ul>':'<p class="muted">No scheduled task. Inspect during general checks.</p>')+'</div>'+
    '<div><h3>Faults that point here</h3>'+(fl.length?'<ul class="list">'+fl.map(function(x){return '<li><button disabled><span>'+esc(x[0])+'</span><small>'+esc(x[1])+'</small></button></li>'}).join("")+'</ul>':'<p class="muted">Not listed as a cause in the fault table.</p>')+'</div>'+
    (selected==="rawpump"?'<div><button class="primary" data-job="impeller">Walk through: change the impeller</button></div>':'')+
    (selected==="fuelfilter"?'<div><button class="primary" data-job="fuelfilter">Walk through: change the fuel filter and bleed</button></div>':'')+
    (selected==="belt"?'<div><button class="primary" data-job="beltchange">Walk through: check and replace the belt</button></div>':'')+
    (selected==="oilfilter"?'<div><button class="primary" data-job="oilchange">Walk through: change the oil and filter</button></div>':'')+
    '<div><button id="bClear">Back to all parts</button></div>';
  $("bClear").onclick=function(){api.select(null)};
}
var JOBMAP={"Replace engine oil and oil filter":["oilchange","Oil and filter change"],"Replace fuel fine filter":["fuelfilter","Fuel filter and bleeding"],"Replace fuel pre-filter insert":["fuelfilter","Fuel filter and bleeding"],"Replace raw water impeller":["impeller","Impeller change"],"Inspect raw water impeller":["impeller","Impeller change"],"Replace drive belts":["beltchange","Drive belt"],"Inspect drive belts":["beltchange","Drive belt"]};
var svcSel=null;
function svcState(s,hs,ms){
  if(s.c==="S")return hs!==null&&hs>=50?"once":"none";
  var ds=(s.h&&hs!==null&&hs>=s.h)||(s.m&&ms!==null&&ms>=s.m);
  if(ds)return "due";
  var soon=(s.h&&hs!==null&&hs>=s.h*0.9)||(s.m&&ms!==null&&ms>=s.m-1);
  return soon?"soon":"ok";
}
function svcBlock(s,hs,ms){
  var st=svcState(s,hs,ms),badge="";
  if(hs!==null||ms!==null){
    if(st==="due")badge='<span class="badge due">Due</span>';
    else if(st==="soon")badge='<span class="badge soon">Coming up</span>';
    else if(st==="once")badge='<span class="badge ok">One-off</span>';
    else if(st==="ok")badge='<span class="badge ok">Not yet</span>';
  }
  return '<section class="svc"><header><span><span class="code">'+s.c+'</span> <span class="int">'+s.int+'</span></span>'+badge+'</header><ul class="list">'+
    s.t.map(function(t){var j=JOBMAP[t[0]];
      return partBtn(t[0],t[1],PARTS[t[1]].n)+(j?'<li><button class="primary" data-job="'+j[0]+'"'+(typeof sim!=="undefined"&&sim&&sim.on?' disabled':'')+'><span>Guided job: '+esc(j[1])+'</span></button></li>':'')}).join("")+'</ul></section>';
}
function renderSvc(){
  if(!$("hrs")){
    $("pSvc").innerHTML='<h2>Service schedule</h2><p>How many hours are on the engine since the last full service? Enter it and the schedule shows which service is due.</p><div class="row">'+
      '<label for="hrs">Engine hours since last full service<input id="hrs" type="number" min="0" inputmode="numeric" placeholder="e.g. 340"></label>'+
      '<label for="mon">Months since last full service (optional)<input id="mon" type="number" min="0" inputmode="numeric" placeholder="e.g. 14"></label></div><div id="svcOut"></div>';
    $("hrs").value=store.get("hrs","");$("mon").value=store.get("mon","");
    $("hrs").oninput=$("mon").oninput=function(){store.set("hrs",$("hrs").value);store.set("mon",$("mon").value);renderSvc()};
  }
  var hv=$("hrs").value,mv=$("mon").value;
  var hs=hv===""||isNaN(parseFloat(hv))?null:Math.max(0,parseFloat(hv)),ms=mv===""||isNaN(parseFloat(mv))?null:Math.max(0,parseFloat(mv));
  var html="",known=hs!==null||ms!==null;
  if(!known){
    html+='<p class="muted">Enter your hours to see what to do next. The full schedule is below.</p>';
  }else{
    var due=SERVICES.filter(function(s){return s.c!=="S"&&svcState(s,hs,ms)==="due"}),soon=SERVICES.filter(function(s){return s.c!=="S"&&svcState(s,hs,ms)==="soon"});
    html+='<section class="card"><h3>'+(due.length?'Do now: Service '+due.map(function(s){return s.c}).join(" + "):'Nothing due yet')+'</h3>';
    if(due.length){
      html+='<p>'+(hs!==null?esc(String(hs))+' hours':'')+(hs!==null&&ms!==null?' and ':'')+(ms!==null?esc(String(ms))+' months':'')+' since the last full service. These are due:</p>';
      due.forEach(function(s){html+=svcBlock(s,hs,ms)});
    }else{
      html+='<p>At this point nothing is due. '+(soon.length?'Coming up: Service '+soon.map(function(s){return s.c}).join(", ")+'.':'Check again at the next 200 hours.')+'</p>';
      soon.forEach(function(s){html+=svcBlock(s,hs,ms)});
    }
    html+='</section>';
    if(hs!==null&&hs>=50)html+='<p class="muted">Service S is a one-off at 50 hours (drive oil and filter). Skip it if already done.</p>';
    html+='<h3>Full schedule</h3>';
  }
  SERVICES.forEach(function(s){html+=svcBlock(s,hs,ms)});
  html+='<p class="note">Simplified check: it assumes every service type was last done at the same time. Whichever limit comes first applies. Always confirm against the service protocol for your engine.</p>';
  $("svcOut").innerHTML=html;
}
var openSym=-1;
function renderFault(){
  var html='<h2>Fault finder</h2><p class="muted">Based on the Operator\'s Manual fault table, with checks from the Service and Workshop manuals. Read the safety notes in the manuals first. Contact a Volvo Penta workshop for anything you cannot solve.</p>';
  /* 1: alarms */
  html+='<h3>Alarm lamps</h3><p class="muted">If a fault arises, an alarm sounds and a symbol flashes in the tachometer window. Press the multi-function button to silence the alarm. The symbol stays on until the fault is fixed.</p>';
  LAMPS.forEach(function(l,i){
    html+='<details class="fcard"'+(i===openLamp?' open':'')+' data-lamp="'+i+'"><summary>'+esc(l.n)+'</summary><p>'+esc(l.d)+'</p>'+
      (l.imp?'<p class="callout">'+esc(l.imp)+'</p>':'')+
      (l.a.length?'<ul class="list">'+l.a.map(function(x){return partBtn(x[0],x[1],PARTS[x[1]].n)}).join("")+'</ul>':'')+
      (l.end?'<p>'+esc(l.end)+'</p>':'')+
      (l.job?'<p><button class="primary" data-job="'+l.job[0]+'">Guided job: '+esc(l.job[1])+'</button></p>':'')+'</details>';
  });
  /* 2: symptoms */
  html+='<h3>Symptoms</h3><p class="muted">Choose a symptom. Work through the causes from the top: the easy checks come first.</p><ul class="list">';
  SYMPTOMS.forEach(function(s,i){
    html+='<li><button data-sym="'+i+'" aria-pressed="'+(i===openSym)+'"><span>'+esc(s[0])+'</span><small>'+s[1].length+' causes</small></button>';
    if(i===openSym)html+='<div class="fcauses">'+s[1].map(function(c){var k=CAUSES[c],d=CDET[c]||{};
      return '<div class="fcause"><h4><span class="fnum">'+c+'</span> '+esc(k[0])+'</h4><p>'+esc(d.t||"")+'</p>'+
        '<div class="fbtns">'+(k[1]?'<button data-part="'+k[1]+'">Show on model: '+esc(PARTS[k[1]].n)+'</button>':'')+
        (d.job?'<button class="primary" data-job="'+d.job[0]+'">Guided job: '+esc(d.job[1])+'</button>':'')+'</div>'+
        (d.s?'<p class="muted fsrc">'+esc(d.s)+'</p>':'')+'</div>'}).join("")+'</div>';
    html+='</li>';
  });
  html+='</ul>';
  /* 3: values */
  html+='<h3>Values to check against</h3><ul class="list">'+REFV.map(function(r){return '<li><button disabled><span>'+esc(r[0])+'</span><small>'+esc(r[1])+'</small></button></li>'}).join("")+'</ul>';
  /* 4: emergency */
  html+='<h3>Emergency: start from an auxiliary battery</h3><p class="callout">Explosion hazard. Batteries give off explosive gas. Never confuse the poles, and do not touch the connections during a start attempt. The black cable must never touch the positive connection on the starter motor.</p><ol class="stepsl">'+EMERG.map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ol>';
  html+='<p class="note">Causes are numbered as in the Operator\'s Manual fault table. Test values come from the Workshop Manual D2-75 and the Operator\'s Manual. Work from the manual for your exact engine.</p>';
  $("pFault").innerHTML=html;
}
var openLamp=-1;

document.querySelector("aside").addEventListener("click",function(e){
  var b=e.target.closest("button"); if(!b)return;
  if(b.dataset.sym!==undefined){openSym=(openSym===+b.dataset.sym)?-1:+b.dataset.sym;renderFault();return}
  if(b.dataset.job&&typeof startJob==="function"){startJob(b.dataset.job);return}
  if(b.dataset.part){api.select(b.dataset.part,true)}
});
var tabs=[["tPart","pPart"],["tSvc","pSvc"],["tFault","pFault"],["tPrac","pPrac"],["tJob","pJob"]];
/* ---------- app shell: deep links and progress saved on this device ---------- */
var curTab="tPart",hashReady=false,TABHASH={tPart:"part",tSvc:"service",tFault:"faults",tPrac:"practice",tJob:"jobs"};
function syncHash(){
  if(!hashReady)return;
  var h=TABHASH[curTab]||"part";
  if(curTab==="tPart"&&selected)h+="/"+selected;else if(curTab==="tJob"&&job.on)h+="/"+job.id;
  if(location.hash!=="#"+h)history.replaceState(null,"","#"+h);
}
function applyHash(){
  var p=location.hash.replace(/^#\/?/,"").split("/"),tab=null,k;
  for(k in TABHASH)if(TABHASH[k]===p[0])tab=k;
  if(tab==="tPart"&&p[1]&&PARTS[p[1]])api.select(p[1],true);
  if(tab==="tJob"&&p[1]&&!sim.on&&!(job.on&&job.id===p[1]))for(k=0;k<PROCS.length;k++)if(PROCS[k].id===p[1]){startJob(p[1]);break}
  if(tab)showTab(tab);
  hashReady=true;syncHash();
}
window.addEventListener("hashchange",function(){hashReady=false;applyHash()});
function recordPrac(firstTry){
  var p=store.get("prac",{solved:0,first:0,shown:0});
  if(firstTry===null)p.shown++;else{p.solved++;if(firstTry)p.first++}
  store.set("prac",p);
}
function pracStats(){
  var p=store.get("prac",null);if(!p||!(p.solved+p.shown))return "";
  return '<p class="muted">Your record on this device: '+p.solved+' solved ('+p.first+' first time), '+p.shown+' answers shown.</p>';
}
function recordJob(pr){
  var first=0;job.tries.forEach(function(t){if(t===1)first++});
  var all=store.get("jobs",{}),r=all[pr.id]||{runs:0,best:0};
  r.runs++;r.best=Math.max(r.best,first);r.last=new Date().toISOString().slice(0,10);all[pr.id]=r;store.set("jobs",all);
}
function jobBest(p){var r=store.get("jobs",{})[p.id];return r?"Best "+r.best+"/"+p.steps.length+" · done "+r.runs+"×":p.steps.length+" steps"}

function showTab(id){curTab=id;tabs.forEach(function(t){$(t[0]).setAttribute("aria-selected",t[0]===id);$(t[1]).hidden=t[0]!==id});syncHash()}
tabs.forEach(function(t){$(t[0]).onclick=function(){showTab(t[0])}});
Object.keys(SYS).forEach(function(k){
  var b=document.createElement("button");b.dataset.sys=k;b.setAttribute("aria-pressed","false");
  b.innerHTML='<span class="dot" style="background:'+SYS[k].color+'"></span>'+SYS[k].name;
  b.onclick=function(){sysFilter=(sysFilter===k)?null:k;[].forEach.call($("sys").children,function(c){c.setAttribute("aria-pressed",c.dataset.sys===sysFilter)});api.refresh()};
  $("sys").appendChild(b);
});
renderPart();renderSvc();renderFault();

/* ---------- practice mode: hidden fault, live gauges, inspection, diagnosis ---------- */
/* Gauge figures are illustrative training values, not manufacturer limits. */
var FX0={noCrank:false,clickOnly:false,crankV:10.4,noFire:false,hard:0,stallAfter:0,rpmMax:1,tempSS:82,tempRate:0.08,oilK:1,chargeK:1,smoke:"none",vib:0,rough:0,steam:false,beltSag:0,tilt:0,exhWater:true,volts0:12.6};
function fxOf(o){var r={},k;for(k in FX0)r[k]=FX0[k];for(k in (o||{}))r[k]=o[k];return r}
SCEN.forEach(function(s){if(SYMPTOMS[s.sym][1].indexOf(s.c)<0&&window.console)console.warn("scenario outside fault table",s.c)});
var DF={
  battery:function(){return sim.volts.toFixed(1)+" V ("+(sim.state==="off"?"engine off":sim.state==="crank"?"cranking":"engine running")+"). Terminals clean."},
  heatex:"Coolant is at the mark (checked cold).",
  seacock:"The strainer is clean. Water passes freely.",
  exhaust:"Cooling water leaves the exhaust in a steady stream.",
  rawpump:"Impeller vanes are intact.",
  belt:"Tension correct, no glazing.",
  thermostat:"The housing warms up as the engine reaches working temperature.",
  dipstick:"The level is between MIN and MAX.",
  oilfilter:"Clean housing, no leaks, within its interval.",
  fuelfilter:"The bowl is clear. No water and no air at the bleed screw.",
  fuelpump:"The primer gives firm resistance and fuel reaches the filter.",
  airfilter:"The element is clean.",
  injpump:"The stop control is in the run position.",
  prop:"Clean, and the blades fold freely.",
  mounts:"The rubber is intact.",
  starter:"Cables tight and clean.",
  alternator:"Wiring tight, no damage."
};
var sim={on:false,sc:null,fx:fxOf(),state:"off",rpm:0,rpmShown:0,temp:25,oilP:0,volts:12.6,t:0,tc:0,tr:0,throttle:0.3,msg:"",wrong:0,seen:{},nSeen:0,log:[],fb:"",done:false,revealed:false,alarms:[],smoke:"none",smokeI:0,vib:0,steam:false,last:-1};
function simStep(dt){
  var s=sim,f=s.fx,lerp=function(a,b,k){return a+(b-a)*Math.min(1,k)};
  s.t+=dt;
  if(s.state==="crank"){
    s.tc+=dt;
    if(f.noCrank||f.clickOnly){s.rpm=0;s.volts=lerp(s.volts,f.clickOnly?12.3:f.crankV,dt*8)}
    else{
      s.rpm=lerp(s.rpm,280,dt*6);s.volts=lerp(s.volts,10.4,dt*8);
      if(!f.noFire&&s.tc>1.1+f.hard){s.state="run";s.tr=0;s.msg="Engine started."}
      else if(f.noFire&&s.tc>3&&s.msg.indexOf("catch")<0)s.msg="Cranking normally but it does not catch."
      if(s.tc>9){s.state="off";s.msg="Starter stopped after 9 seconds of cranking. Let it cool before trying again."}
    }
  }else if(s.state==="run"){
    s.tr+=dt;
    var maxR=3300*f.rpmMax,target=s.throttle>0.92?maxR:800+s.throttle*(maxR-800);
    s.rpm=lerp(s.rpm,target,dt*1.5);
    if(f.stallAfter&&s.tr>f.stallAfter){s.state="off";s.msg="Engine stopped."}
  }else{s.rpm=lerp(s.rpm,0,dt*3);if(s.rpm<5)s.rpm=0;s.volts=lerp(s.volts,f.volts0,dt*3)}
  s.rpmShown=s.rpm+(s.state==="run"&&f.rough?Math.sin(s.t*23)*f.rough*70:0);
  var run=s.state==="run";
  var tss=run?f.tempSS+(s.rpm-800)/2200*6:25;
  s.temp+=(tss-s.temp)*(run?f.tempRate:0.008)*dt;
  s.oilP=lerp(s.oilP,run?f.oilK*(1.2+2.6*s.rpm/3300):(s.state==="crank"&&!f.noCrank&&!f.clickOnly?0.3:0),dt*4);
  if(run)s.volts=lerp(s.volts,f.chargeK>=0.9?13.9:(f.chargeK<=0?12.0:12.9),dt*1.2);
  s.smoke=run?f.smoke:"none";s.smokeI=run?0.35+0.65*s.throttle:0;
  s.vib=run?f.vib*(0.5+0.5*s.rpm/2400):0;
  s.steam=run&&f.steam&&s.temp>100;
  s.alarms=[];
  if(s.temp>100)s.alarms.push(["Coolant temperature high",false]);
  if(run&&s.rpm>500&&s.oilP<1.0)s.alarms.push(["Oil pressure low",false]);
  if(run&&s.volts<12.8)s.alarms.push(["Not charging",true]);
}
var GAUGES=[
 ["temp","Coolant temp","°C",20,120,function(){return sim.temp},0,function(v){return v>100}],
 ["oil","Oil pressure","bar",0,5,function(){return sim.oilP},1,function(v){return sim.state==="run"&&sim.rpm>500&&v<1.0}],
 ["volt","Battery","V",8,15,function(){return sim.volts},1,function(v){return sim.state==="run"?v<12.8:v<11.8&&sim.state==="off"}],
 ["rpm","Engine speed","rpm",0,3500,function(){return sim.rpmShown},-1,function(){return false}]
];
var SMOKEN={none:"Clear",black:"Black",white:"White",blue:"Blue-white"};
function updateGauges(){
  if(!sim.on||!$("gf_temp"))return;
  GAUGES.forEach(function(g){
    var v=g[5](),pct=Math.max(0,Math.min(100,(v-g[3])/(g[4]-g[3])*100)),bad=g[7](v);
    $("gf_"+g[0]).style.width=pct+"%";
    $("gv_"+g[0]).textContent=(g[6]<0?Math.round(v/10)*10:v.toFixed(g[6]))+" "+g[2];
    $("gr_"+g[0]).classList.toggle("bad",!!bad);
  });
  $("cState").textContent="Engine: "+(sim.state==="run"?"running":sim.state==="crank"?"cranking":"stopped");
  $("cSmoke").textContent="Exhaust: "+(sim.state==="run"?SMOKEN[sim.smoke]:"—");
  $("cVib").textContent="Vibration: "+(sim.state==="run"?(sim.vib>0.45?"heavy":"normal"):"—");
  var al=$("alarm");
  if(sim.alarms.length){al.hidden=false;al.textContent="Alarm: "+sim.alarms.map(function(a){return a[0]}).join(", ");al.className="alarm"+(sim.alarms.every(function(a){return a[1]})?" warn":"")}
  else al.hidden=true;
  if($("simMsg").textContent!==sim.msg)$("simMsg").textContent=sim.msg;
}
function findingFor(id){
  var o=sim.sc.find&&sim.sc.find[id];
  if(o===undefined)o=DF[id];
  if(typeof o==="function")o=o();
  return o||"Nothing wrong here.";
}
function renderSel(){
  var el=$("selRow");if(!el)return;
  el.innerHTML=selected?'<p>Selected: <b>'+esc(PARTS[selected].n)+'</b></p><div><button data-act="inspect">Inspect this part</button></div>':'<p class="muted">Click a part on the model, then inspect it.</p>';
}
function renderLog(){
  var el=$("logList");if(!el)return;
  el.innerHTML=sim.log.map(function(l){return '<li><b>'+esc(PARTS[l.id].n)+'</b><span>'+esc(l.txt)+'</span></li>'}).join("");
}
function serviceFor(part){var r=[];SERVICES.forEach(function(s){s.t.forEach(function(t){if(t[1]===part)r.push("Service "+s.c+": "+t[0])})});return r}
function renderPrac(){
  var el=$("pPrac"),s=sim,h;
  if($("bRun"))$("bRun").disabled=s.on;
  if(!s.on){
    h='<h2>Fault finding practice</h2><p>The engine has a hidden fault. Read the customer report, start the engine, watch the gauges and exhaust, inspect parts on the model, then name the cause.</p>'+
      '<p class="muted">Gauge figures are illustrative training values, not manufacturer limits. Faults come from the operator\'s fault table, so you can check your answer against it.</p>'+
      '<div><button class="primary" data-act="new">Start a fault</button></div>'+pracStats();
  }else{
    var sc=s.sc,sv=serviceFor(sc.part);
    h='<h2>Fault finding practice</h2><div><h3>Customer report</h3><p>'+esc(SYMPTOMS[sc.sym][0])+'</p></div>';
    if(s.done){
      h+='<section class="res'+(s.revealed?' rev':'')+'"><h3>'+(s.revealed?'The answer':'Correct')+'</h3><p><b>'+esc(CAUSES[sc.c][0])+'</b></p><p>'+esc(sc.why)+'</p>'+
        '<div><h3>Fix</h3><p>'+esc(sc.fix)+'</p></div>'+
        (sv.length?'<div><h3>Prevented by</h3><p>'+sv.map(esc).join("<br>")+'</p></div>':'')+(sc.part==="rawpump"?'<div><button data-job="impeller">Walk through the repair</button></div>':'')+
        '<p class="muted">'+(s.revealed?'Answer shown.':'Wrong answers: '+s.wrong+'. Parts inspected: '+s.nSeen+'.')+' Start the engine to confirm it now runs normally.</p></section>';
    }
    h+='<section class="card"><h3>Engine</h3><div class="row2"><button data-act="start">Start</button><button data-act="stop">Stop</button><button data-act="cool">Let it cool</button></div>'+
      '<label class="thr" for="thr">Throttle <input id="thr" type="range" min="0" max="100" value="'+Math.round(s.throttle*100)+'"></label>'+
      GAUGES.map(function(g){return '<div class="gauge" id="gr_'+g[0]+'"><span class="gl">'+g[1]+'</span><span class="gt"><i id="gf_'+g[0]+'"></i></span><b id="gv_'+g[0]+'"></b></div>'}).join("")+
      '<div class="chips"><span class="tag" id="cState"></span><span class="tag" id="cSmoke"></span><span class="tag" id="cVib"></span></div>'+
      '<div id="alarm" class="alarm" role="status" hidden></div><p id="simMsg" class="msg" aria-live="polite"></p></section>'+
      '<section class="card"><h3>Inspect</h3><div id="selRow"></div><ul class="list log" id="logList"></ul></section>';
    if(!s.done){
      h+='<section class="card"><h3>What is the cause?</h3><ul class="list">'+SYMPTOMS[sc.sym][1].map(function(c){return '<li><button data-act="cause" data-c="'+c+'"><span>'+esc(CAUSES[c][0])+'</span></button></li>'}).join("")+'</ul><p class="msg" id="fb" aria-live="polite">'+esc(s.fb)+'</p></section>';
    }
    h+='<div class="row2">'+(s.done?'<button class="primary" data-act="new">Next fault</button>':'<button data-act="reveal">Show answer</button>')+'<button data-act="end">End practice</button></div>';
  }
  el.innerHTML=h;
  if(s.on){renderSel();renderLog();updateGauges()}
  if(!s.on||s.done||s.nSeen===0)el.scrollTop=0;
}
function newFault(){
  if(job.on)endJob();
  var pool=SCEN.filter(function(x){return x!==sim.last}),sc=pool[Math.floor(Math.random()*pool.length)];
  sim.on=true;sim.sc=sc;sim.last=sc;sim.fx=fxOf(sc.fx);sim.state="off";sim.rpm=0;sim.rpmShown=0;sim.temp=25;sim.oilP=0;sim.volts=sc.fx.volts0||12.6;
  sim.t=0;sim.tc=0;sim.tr=0;sim.msg="Engine is cold and stopped. Press Start.";sim.wrong=0;sim.seen={};sim.nSeen=0;sim.log=[];sim.fb="";sim.done=false;sim.revealed=false;sim.alarms=[];
  selected=null;if(api.refresh)api.refresh();renderPart();renderPrac();showTab("tPrac");
}
function pracAction(a,b){
  var s=sim;
  if(a==="new")newFault();
  else if(a==="end"){s.on=false;s.fx=fxOf();s.state="off";s.rpm=0;renderPrac()}
  else if(a==="start"){
    if(s.state!=="off")return;
    s.state="crank";s.tc=0;s.tr=0;
    s.msg=s.fx.noCrank?"The starter does not turn. You hear rapid clicking.":s.fx.clickOnly?"One click, but the starter does not turn.":"Cranking.";
  }
  else if(a==="stop"){if(s.state!=="off"){s.state="off";s.msg="Engine stopped."}}
  else if(a==="cool"){if(s.state!=="off")s.msg="Stop the engine first.";else{s.temp=Math.min(s.temp,30);s.msg="Thirty minutes later the engine is cold."}}
  else if(a==="inspect"){
    var id=selected;if(!id)return;
    if(id==="heatex"&&s.temp>60){s.msg="The engine is hot. Opening the coolant cap now can scald. Stop the engine and use Let it cool first.";return}
    var txt=findingFor(id);
    s.log=s.log.filter(function(l){return l.id!==id});s.log.unshift({id:id,txt:txt});
    if(!s.seen[id]){s.seen[id]=1;s.nSeen++}
    renderLog();
  }
  else if(a==="cause"){
    if(s.done)return;
    var c=+b.dataset.c;
    if(c===s.sc.c){recordPrac(s.wrong===0);s.done=true;s.fx=fxOf();s.msg="Fault corrected. Start the engine to confirm.";if(api.flash)api.flash(s.sc.part)}
    else{s.wrong++;s.fb=s.wrong>=2?"Not that one. Hint: look at the "+PARTS[s.sc.part].n.toLowerCase()+".":"Not that one. Compare the gauges and exhaust with what the parts show."}
    renderPrac();
  }
  else if(a==="reveal"){recordPrac(null);s.done=true;s.revealed=true;s.fx=fxOf();s.msg="Fault corrected. Start the engine to confirm.";if(api.flash)api.flash(s.sc.part);renderPrac()}
}
$("pPrac").addEventListener("click",function(e){var b=e.target.closest("button");if(b&&b.dataset.act)pracAction(b.dataset.act,b)});
$("pPrac").addEventListener("input",function(e){if(e.target.id==="thr")sim.throttle=e.target.value/100});
renderPrac();

/* ---------- guided jobs: step list, highlight, tool and torque, check per step ---------- */
var job={on:false,id:null,i:0,tries:[],ok:[],fb:""};
function jobProc(){for(var k=0;k<PROCS.length;k++)if(PROCS[k].id===job.id)return PROCS[k]}
function poseFor(pr,n){
  var p=JSON.parse(JSON.stringify(POSE0));
  for(var k=0;k<=n&&k<pr.steps.length;k++){var d=pr.steps[k].pose||{};
    Object.keys(d).forEach(function(key){if(typeof d[key]==="object"){for(var q in d[key])p[key][q]=d[key][q]}else p[key]=d[key]})}
  return p;
}
function jobApply(){
  var pr=jobProc(),st=pr.steps[job.i];
  if(api.pose)api.pose(poseFor(pr,job.i));
  if(api.select)api.select(st.part,true);
  if(api.view&&st.view)api.view(st.look,st.view);
}
function startJob(id){
  if(sim.on){pracAction("end")}
  job.on=true;job.id=id;job.i=0;job.tries=[];job.ok=[];job.fb="";job.done=false;
  renderJob();showTab("tJob");jobApply();
}
function endJob(){
  job.on=false;job.done=false;if(api.pose)api.pose(POSE0);if(api.select)api.select(null);renderJob();
}
function renderJob(){
  var el=$("pJob"),h,k;syncHash();
  if(!job.on){
    h='<h2>Guided jobs</h2><p>Follow a service job step by step on the model. Each step highlights the part, names the tool and torque, and asks you a question before you move on.</p>';
    if(sim.on)h+='<p class="muted">End Practice mode first, then start a job.</p>';
    h+='<ul class="list">'+PROCS.map(function(p){return '<li><button data-job="'+p.id+'"'+(sim.on?' disabled':'')+'><span>'+esc(p.name)+'</span><small>'+jobBest(p)+'</small></button></li>'}).join("")+'</ul>'+
      '<p class="note">Figures come from the manuals in this project. Always work from the manual for your exact engine.</p>';
    el.innerHTML=h;return;
  }
  var pr=jobProc(),n=pr.steps.length;
  if(job.done){
    var first=0;job.tries.forEach(function(t){if(t===1)first++});
    h='<h2>'+esc(pr.name)+'</h2><section class="res"><h3>Job complete</h3><p><b>'+first+' of '+n+'</b> checks right first time.</p>'+
      '<ul class="list">'+pr.steps.map(function(s,i){var t=job.tries[i]||1;return '<li><button disabled><span>'+(i+1)+'. '+esc(s.t)+'</span><small>'+(t===1?'Right first time':t+' tries')+'</small></button></li>'}).join("")+'</ul>'+
      '<p>'+esc(pr.closing)+'</p><p class="muted">Sources: '+esc(pr.src)+'</p></section>'+
      '<div class="row2"><button class="primary" data-jact="again">Do it again</button><button data-jact="close">Close job</button></div>';
    el.innerHTML=h;return;
  }
  var st=pr.steps[job.i],done=job.ok[job.i];
  h='<h2>'+esc(pr.name)+'</h2>';
  if(job.i===0&&!job.seen){h+='<p>'+esc(pr.intro)+'</p><div><h3>You need</h3><ul class="bul">'+pr.need.map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul></div>'}
  h+='<div class="prog" role="progressbar" aria-valuemin="1" aria-valuemax="'+n+'" aria-valuenow="'+(job.i+1)+'"><i style="width:'+((job.i+(done?1:0))/n*100)+'%"></i></div>'+
    '<section class="card"><h3>Step '+(job.i+1)+' of '+n+'</h3><p class="stt">'+esc(st.t)+'</p><p>'+esc(st.d)+'</p><div class="chips">'+
    '<button class="tag lnk" data-part="'+st.part+'">'+esc(PARTS[st.part].n)+'</button>'+
    (st.tool?'<span class="tag">Tool: '+esc(st.tool)+'</span>':'')+(st.torque?'<span class="tag tq">Torque: '+esc(st.torque)+'</span>':'')+'</div>'+
    (st.warn?'<p class="callout">'+esc(st.warn)+'</p>':'')+(st.tip?'<p class="muted">'+esc(st.tip)+'</p>':'')+'</section>'+
    '<section class="card"><h3>Check</h3><p>'+esc(st.q)+'</p><ul class="list">'+st.o.map(function(o,i){
      var cls=done?(i===st.a?' good':''):'';
      return '<li><button data-jopt="'+i+'" class="opt'+cls+'"'+(done?' disabled':'')+'><span>'+esc(o)+'</span></button></li>'}).join("")+'</ul>'+
    '<p class="msg" aria-live="polite">'+(done?'<b class="okc">Correct.</b> '+esc(st.why):esc(job.fb))+'</p></section>'+
    '<div class="row2"><button data-jact="back"'+(job.i===0?' disabled':'')+'>Back</button><button class="primary" data-jact="next"'+(done?'':' disabled')+'>'+(job.i===n-1?'Finish':'Next step')+'</button><button data-jact="close">Stop</button></div>';
  el.innerHTML=h;el.scrollTop=0;
}
function jobAnswer(i){
  var pr=jobProc(),st=pr.steps[job.i];if(job.ok[job.i])return;
  job.tries[job.i]=(job.tries[job.i]||0)+1;
  if(i===st.a){job.ok[job.i]=true;job.fb=""}
  else job.fb="Not quite. "+st.hint;
  renderJob();
}
function jobAct(a){
  var pr=jobProc();
  if(a==="next"){
    if(!job.ok[job.i])return;
    job.seen=true;job.fb="";
    if(job.i===pr.steps.length-1){job.done=true;recordJob(pr);if(api.pose)api.pose(POSE0);renderJob();return}
    job.i++;renderJob();jobApply();
  }else if(a==="back"){if(job.i>0){job.i--;job.fb="";renderJob();jobApply()}}
  else if(a==="close"){job.seen=false;endJob()}
  else if(a==="again"){job.seen=false;startJob(job.id)}
}
$("pJob").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;
  if(b.dataset.job)startJob(b.dataset.job);
  else if(b.dataset.jopt!==undefined)jobAnswer(+b.dataset.jopt);
  else if(b.dataset.jact)jobAct(b.dataset.jact)});
renderJob();

/* ---------- 3D ---------- */
if(!THREE){$("tPrac").hidden=true;$("tJob").hidden=true;$("nogl").hidden=false;api.select=function(id){selected=id;renderPart();showTab("tPart")};applyHash();return}
var T=THREE, stage=$("stage"), renderer;
try{renderer=new T.WebGLRenderer({antialias:true})}catch(e){$("tPrac").hidden=true;$("tJob").hidden=true;$("nogl").hidden=false;api.select=function(id){selected=id;renderPart();showTab("tPart")};applyHash();return}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputEncoding=T.sRGBEncoding;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
var scene=new T.Scene(), cam=new T.PerspectiveCamera(36,1,0.05,20);
var HOME=new T.Vector3(-1.3,0.95,1.7), TGT=new T.Vector3(0.12,0.12,0);
cam.position.copy(HOME);
var ctl=new T.OrbitControls(cam,renderer.domElement);
ctl.target.copy(TGT);ctl.enableDamping=true;ctl.minDistance=0.5;ctl.maxDistance=5;

/* colour helper: palette is written as sRGB hex, materials need linear */
var _lc={};function lin(h){return _lc[h]||(_lc[h]=new T.Color(h).convertSRGBToLinear())}

/* image-based lighting from a small procedural studio, so metal and paint read properly */
(function(){
  var pm=new T.PMREMGenerator(renderer), es=new T.Scene();
  var c=document.createElement("canvas");c.width=4;c.height=256;var x=c.getContext("2d"),gr=x.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,"#e4edf6");gr.addColorStop(0.48,"#a3afb9");gr.addColorStop(0.52,"#6a737b");gr.addColorStop(1,"#30363b");
  x.fillStyle=gr;x.fillRect(0,0,4,256);
  var tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;
  es.add(new T.Mesh(new T.SphereGeometry(12,32,16),new T.MeshBasicMaterial({map:tex,side:T.BackSide})));
  function panel(w,h,p,k){var m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(k,k,k),side:T.DoubleSide}));m.position.set(p[0],p[1],p[2]);m.lookAt(0,0,0);es.add(m)}
  panel(7,3,[-4,6,5],7);panel(4,4,[7,3,-3],3.5);panel(9,1.5,[0,9,0],4);panel(3,3,[-6,1,-4],2);
  scene.environment=pm.fromScene(es,0.035).texture;pm.dispose();
})();
scene.add(new T.HemisphereLight(0xffffff,0x4c5860,0.35));
var sun=new T.DirectionalLight(0xffffff,1.55);sun.position.set(-1.3,2.4,1.9);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
var sc=sun.shadow.camera;sc.left=-1;sc.right=1;sc.top=1;sc.bottom=-1;sc.near=0.5;sc.far=7;
sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.01;scene.add(sun);
var fill=new T.DirectionalLight(0xdfe9f5,0.35);fill.position.set(2,1,-2);scene.add(fill);
function themeBg(){var c=getComputedStyle(document.documentElement).getPropertyValue("--stage").trim()||"#dfe5e9";scene.background=new T.Color(c)}
themeBg();
if(window.matchMedia){var mq=matchMedia("(prefers-color-scheme: dark)");(mq.addEventListener?mq.addEventListener("change",themeBg):mq.addListener(themeBg))}
new MutationObserver(themeBg).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});

/* palette: c = sRGB hex, r = roughness, m = metalness */
var GREEN={c:"#257060",r:0.5,m:0.05}, GREENL={c:"#2e8070",r:0.5,m:0.05};
var STEEL={c:"#aab2b9",r:0.34,m:0.9}, ALU={c:"#bcc2c8",r:0.42,m:0.78}, CAST={c:"#3f464b",r:0.62,m:0.55};
var BLACK={c:"#1b1f23",r:0.6,m:0.15}, RUBBER={c:"#23272b",r:0.86,m:0}, WHITE={c:"#eef1f3",r:0.32,m:0.04};
var BRASS={c:"#c49b3f",r:0.3,m:0.92}, ZINC={c:"#b4bac0",r:0.5,m:0.65}, YEL={c:"#ecc21c",r:0.45,m:0};
var RED={c:"#c2382a",r:0.5,m:0.05}, BLUE={c:"#2a5db0",r:0.45,m:0}, GREY={c:"#7d858b",r:0.5,m:0.3};
var HULL={c:"#eaeef1",r:0.22,m:0}, PALE={c:"#b9d3a8",r:0.5,m:0}, CLEAR={c:"#8fb4c4",r:0.25,m:0};
var rig=new T.Group();scene.add(rig);
var groups={}, shells=["block","head","sump","rocker","flywheel"], decor=[];
function mat(p,o){o=o||{};var m=new T.MeshStandardMaterial({color:lin(p.c).clone(),roughness:p.r,metalness:p.m,transparent:true});
  if(o.ds)m.side=T.DoubleSide;if(o.op!==undefined)m.opacity=o.op;return m}
function part(id,explode){var g=new T.Group();g.userData={id:id,dir:new T.Vector3().fromArray(explode||[0,0,0])};groups[id]=g;rig.add(g);return g}
function add(g,geo,p,pos,rot,o){var m=new T.Mesh(geo,mat(p,o));if(pos)m.position.fromArray(pos);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);
  m.userData.c=p.c;m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
/* geometry helpers */
function rbox(w,h,d,r){r=Math.min(r,w/2-0.0004,h/2-0.0004,d/2-0.0004);var s=new T.Shape(),iw=w-2*r,ih=h-2*r;
  s.moveTo(-iw/2,-ih/2);s.lineTo(iw/2,-ih/2);s.lineTo(iw/2,ih/2);s.lineTo(-iw/2,ih/2);s.closePath();
  var g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:1});
  g.translate(0,0,-(d-2*r)/2);return g}
function cyl(r,h,r2){return new T.CylinderGeometry(r2===undefined?r:r2,r,h,24)}
function hex(r,h){return new T.CylinderGeometry(r,r,h,6)}
function lathe(pts,seg){return new T.LatheGeometry(pts.map(function(p){return new T.Vector2(p[0],p[1])}),seg||36)}
function curve(pts,closed){return new T.CatmullRomCurve3(pts.map(function(p){return new T.Vector3(p[0],p[1],p[2])}),!!closed,"centripetal")}
function tube(pts,r,closed,seg){return new T.TubeGeometry(curve(pts,closed),seg||56,r,10,!!closed)}
function hose(g,pts,r,p){return add(g,tube(pts,r),p||RUBBER)}
function clamp(g,pos,rot,r){return add(g,new T.TorusGeometry(r,0.0032,6,22),STEEL,pos,rot)}
function bolt(g,pos,rot,r,h,p){return add(g,hex(r,h),p||STEEL,pos,rot)}
var AX=[0,0,Math.PI/2], AZ=[Math.PI/2,0,0];
var PX=-0.37;   /* x position of the belt pulleys */
var XS=[-0.21,-0.07,0.07,0.21];
var g,i;
var OJ={};
function osub(name,pos,dir){var s2=new T.Group();s2.position.fromArray(pos);OJ[name]={g:s2,bp:pos.slice(),dir:dir,x:0,s:1,tx:0,ts:1};return s2}
function spin(o){return o}
function shiftG(g,d,names){g.children.forEach(function(c){c.position.x+=d[0];c.position.y+=d[1];c.position.z+=d[2]});(names||[]).forEach(function(n){var o=OJ[n];o.bp[0]+=d[0];o.bp[1]+=d[1];o.bp[2]+=d[2]})}

/* ---- structure ---- */
g=part("block",[0,0,0]);
add(g,rbox(0.60,0.30,0.28,0.012),GREEN,[0,0.30,0]);
add(g,rbox(0.62,0.025,0.30,0.008),GREEN,[0,0.162,0]);
add(g,rbox(0.03,0.27,0.25,0.008),GREEN,[-0.315,0.285,0]);
[-0.2,-0.07,0.07,0.2].forEach(function(x){[1,-1].forEach(function(s){
  add(g,cyl(0.018,0.008),STEEL,[x,0.38,s*0.1405],AZ);add(g,rbox(0.1,0.012,0.006,0.002),GREENL,[x,0.255,s*0.141])})});
[1,-1].forEach(function(s){add(g,rbox(0.5,0.014,0.01,0.004),GREENL,[0,0.43,s*0.143])});

g=part("sump",[0,-0.5,0]);
add(g,rbox(0.58,0.03,0.27,0.008),GREEN,[0,0.14,0]);
add(g,rbox(0.54,0.10,0.23,0.022),GREEN,[0,0.085,0]);
add(g,rbox(0.50,0.03,0.20,0.012),GREEN,[0,0.032,0]);
bolt(g,[-0.2,0.012,0],null,0.014,0.016);
for(i=0;i<12;i++){var bx=-0.26+i*0.0473;[1,-1].forEach(function(s){bolt(g,[bx,0.158,s*0.12],null,0.006,0.006)})}

g=part("head",[0,0.45,0]);
add(g,rbox(0.60,0.10,0.26,0.01),GREEN,[0,0.50,0]);
add(g,rbox(0.42,0.055,0.045,0.012),GREEN,[0.0,0.505,-0.15]);
add(g,rbox(0.05,0.04,0.05,0.01),GREEN,[-0.02,0.505,-0.18]);

g=part("rocker",[0,0.85,0]);
(function(){var sh=new T.Shape(),n=56,pts=[],k,x,zz;
  for(k=0;k<=n;k++){x=-0.28+0.56*k/n;zz=0.099-0.0075*Math.cos((x+0.24)/0.16*Math.PI*2)-(Math.abs(x)>0.25?(Math.abs(x)-0.25)*1.6:0);pts.push([x,zz])}
  sh.moveTo(pts[0][0],-pts[0][1]);for(k=0;k<=n;k++)sh.lineTo(pts[k][0],-pts[k][1]);
  for(k=n;k>=0;k--)sh.lineTo(pts[k][0],pts[k][1]);sh.closePath();
  var gg=new T.ExtrudeGeometry(sh,{depth:0.05,bevelEnabled:true,bevelThickness:0.004,bevelSize:0.004,bevelSegments:2,curveSegments:2});
  gg.rotateX(-Math.PI/2);add(g,gg,GREEN,[0,0.55,0])})();
add(g,rbox(0.46,0.022,0.13,0.008),GREEN,[0,0.61,0]);
add(g,rbox(0.20,0.004,0.06,0.001),BLACK,[-0.08,0.623,0]);
(function(){var c=document.createElement("canvas");c.width=512;c.height=150;var x=c.getContext("2d");
  x.fillStyle="#15191c";x.fillRect(0,0,512,150);x.strokeStyle="#9aa3a9";x.lineWidth=5;x.strokeRect(6,6,500,138);
  x.fillStyle="#f2f4f5";x.font="700 92px Arial, Helvetica, sans-serif";x.textAlign="center";x.textBaseline="middle";x.fillText("D2-60",256,80);
  var tx=new T.CanvasTexture(c);tx.encoding=T.sRGBEncoding;tx.anisotropy=4;
  var bm=new T.Mesh(new T.PlaneGeometry(0.19,0.056),new T.MeshStandardMaterial({map:tx,roughness:0.45,metalness:0.1,transparent:true}));
  bm.rotation.x=-Math.PI/2;bm.position.set(-0.08,0.6255,0);bm.userData.c="#ffffff";g.add(bm)})();
/* stepped cover details: rear hump, front chamfer rail, rib bosses */
add(g,rbox(0.40,0.02,0.05,0.008),GREEN,[0.03,0.628,-0.065]);
add(g,rbox(0.46,0.012,0.03,0.005),GREENL,[0,0.6,0.1]);
[-0.17,0,0.17].forEach(function(x){add(g,rbox(0.02,0.018,0.012,0.004),GREENL,[x,0.592,0.108])});
[-0.24,-0.08,0.08,0.24].forEach(function(x){[1,-1].forEach(function(s){add(g,cyl(0.0085,0.012),GREEN,[x,0.600,s*0.088]);add(g,new T.SphereGeometry(0.0085,12,8),GREEN,[x,0.606,s*0.088])})});
add(g,rbox(0.5,0.012,0.008,0.002),GREEN,[0,0.558,-0.112]);[-0.2,-0.07,0.07,0.2].forEach(function(x){add(g,rbox(0.012,0.04,0.008,0.002),GREEN,[x,0.575,-0.112])});

g=part("oilfill",[0,1.2,0]);
add(g,cyl(0.03,0.006),STEEL,[0.02,0.623,0]);var oc=osub("cap",[0.02,0.623,0],[0,1,0]);g.add(oc);
(function(){var sh=new T.Shape(),n=84,k;
  for(k=0;k<=n;k++){var th=k/n*Math.PI*2,rr=0.0295+0.0045*Math.cos(7*th);if(k===0)sh.moveTo(rr,0);else sh.lineTo(rr*Math.cos(th),rr*Math.sin(th))}
  var gg=new T.ExtrudeGeometry(sh,{depth:0.022,bevelEnabled:true,bevelThickness:0.003,bevelSize:0.0025,bevelSegments:2,curveSegments:1});
  gg.rotateX(-Math.PI/2);add(oc,gg,BLACK,[0,0.002,0]);
  add(oc,cyl(0.0205,0.004),{c:"#4a5258",r:0.45,m:0.3},[0,0.0285,0]);
  add(oc,new T.TorusGeometry(0.0135,0.0018,6,24),{c:"#c9ced2",r:0.4,m:0.6},[0,0.0307,0],[Math.PI/2,0,0]);
  add(oc,cyl(0.004,0.003),{c:"#c9ced2",r:0.4,m:0.6},[0,0.031,0]);
  add(oc,cyl(0.02,0.004),BLACK,[0,0.0035,0])})();

g=part("flywheel",[0.25,0,0]);
add(g,cyl(0.19,0.10),GREEN,[0.35,0.20,0],AX);
add(g,cyl(0.207,0.014),GREEN,[0.303,0.20,0],AX);
add(g,cyl(0.2,0.012),GREEN,[0.33,0.20,0],AX);
for(i=0;i<10;i++){var ra=i/10*Math.PI*2+0.15;add(g,rbox(0.075,0.022,0.012,0.003),GREENL,[0.35,0.20+0.192*Math.cos(ra),0.192*Math.sin(ra)],[ra-Math.PI/2,0,0]);}
for(i=0;i<8;i++){var rb=i/8*Math.PI*2;bolt(g,[0.303,0.20+0.2*Math.cos(rb),0.2*Math.sin(rb)],AX,0.0085,0.009)}
add(g,cyl(0.178,0.012),GREENL,[0.40,0.20,0],AX);
for(i=0;i<12;i++){var a=i/12*Math.PI*2;bolt(g,[0.408,0.20+0.17*Math.cos(a),0.17*Math.sin(a)],AX,0.0075,0.008)}
add(g,rbox(0.10,0.03,0.34,0.01),GREEN,[0.35,0.03,0]);

/* ---- front end: pulleys, pump, belt, alternator ---- */
g=part("crankpulley",[-0.5,0,0]);
add(g,cyl(0.075,0.022),STEEL,[PX,0.20,0],AX);
add(g,cyl(0.083,0.004),STEEL,[PX-0.011,0.20,0],AX);add(g,cyl(0.083,0.004),STEEL,[PX+0.011,0.20,0],AX);
add(g,cyl(0.032,0.018),STEEL,[PX-0.018,0.20,0],AX);bolt(g,[PX-0.03,0.20,0],AX,0.013,0.012);
add(g,cyl(0.05,0.012),CAST,[PX+0.022,0.20,0],AX);

g=part("circpump",[-0.5,0.2,0]);
add(g,cyl(0.06,0.026),GREEN,[-0.343,0.42,0],AX);
for(i=0;i<6;i++){var a2=i/6*Math.PI*2;bolt(g,[-0.358,0.42+0.05*Math.cos(a2),0.05*Math.sin(a2)],AX,0.005,0.006)}
add(g,cyl(0.052,0.014),STEEL,[PX,0.42,0],AX);
add(g,cyl(0.058,0.004),STEEL,[PX-0.009,0.42,0],AX);add(g,cyl(0.058,0.004),STEEL,[PX+0.009,0.42,0],AX);
add(g,cyl(0.02,0.014),STEEL,[PX-0.012,0.42,0],AX);

g=part("alternator",[-0.3,0.1,0.6]);
add(g,cyl(0.066,0.06),ALU,[-0.29,0.36,0.22],AX);add(g,cyl(0.064,0.05),ALU,[-0.23,0.36,0.22],AX);
add(g,cyl(0.05,0.03),BLACK,[-0.19,0.36,0.22],AX);add(g,cyl(0.024,0.012),RED,[-0.172,0.36,0.22],AX);
for(i=0;i<10;i++){var a3=i/10*Math.PI*2+0.15;
  add(g,rbox(0.03,0.016,0.008,0.002),BLACK,[-0.262,0.36+0.0665*Math.cos(a3),0.22+0.0665*Math.sin(a3)],[a3-Math.PI/2,0,0])}
add(g,cyl(0.036,0.02),STEEL,[PX,0.36,0.22],AX);
add(g,cyl(0.041,0.004),STEEL,[PX-0.009,0.36,0.22],AX);add(g,cyl(0.041,0.004),STEEL,[PX+0.009,0.36,0.22],AX);
add(g,cyl(0.014,0.03),STEEL,[-0.335,0.36,0.22],AX);
add(g,rbox(0.10,0.028,0.07,0.006),CAST,[-0.26,0.435,0.185]);
add(g,rbox(0.08,0.03,0.05,0.006),CAST,[-0.26,0.295,0.185]);
add(g,rbox(0.014,0.012,0.15,0.003),CAST,[-0.16,0.445,0.16]);
for(i=0;i<5;i++)add(g,new T.TorusGeometry(0.0655,0.0032,6,40),ALU,[-0.31+i*0.0105,0.36,0.22],[0,Math.PI/2,0]);
add(g,rbox(0.012,0.016,0.2,0.003),STEEL,[-0.27,0.485,0.12],[0.0,0,0]);
add(g,rbox(0.045,0.012,0.012,0.003),STEEL,[-0.27,0.452,0.215]);
var ab=osub("abolt",[0,0,0],[0,1,0]);g.add(ab);
bolt(ab,[-0.26,0.452,0.185],null,0.01,0.012);bolt(ab,[-0.26,0.31,0.185],null,0.01,0.012);bolt(ab,[-0.27,0.495,0.12],null,0.01,0.012);

g=part("belt",[-0.9,0,0]);
(function(){
  var circ=[[0,0.20,0.075],[0,0.42,0.052],[0.22,0.36,0.036]], pts=[];
  circ.forEach(function(c){for(var k=0;k<28;k++){var t=k/28*Math.PI*2;pts.push([c[0]+(c[2]+0.0055)*Math.sin(t),c[1]+(c[2]+0.0055)*Math.cos(t)])}});
  pts.sort(function(a,b){return a[0]-b[0]||a[1]-b[1]});
  function cr(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])}
  var lo=[],up=[],k;
  for(k=0;k<pts.length;k++){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],pts[k])<=0)lo.pop();lo.push(pts[k])}
  for(k=pts.length-1;k>=0;k--){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],pts[k])<=0)up.pop();up.push(pts[k])}
  up.pop();lo.pop();var h=lo.concat(up);
  var path=h.filter(function(p,n){return n%2===0}).map(function(p){return [0,p[1],p[0]]});
  var bgeo=tube(path,0.0045,true,160);
  [["beltOld",{c:"#3b352e",r:0.95,m:0}],["beltNew",RUBBER]].forEach(function(q){var bs=osub(q[0],[0,0,0],[-1,0,0]);g.add(bs);var m=add(bs,bgeo,q[1],[PX,0,0]);m.scale.x=3.2});
  OJ.beltNew.x=0.22;OJ.beltNew.tx=0.22;OJ.beltNew.s=0;OJ.beltNew.ts=0;
})();

/* ---- cooling ---- */
g=part("heatex",[0,0.5,0.6]);
add(g,rbox(0.40,0.115,0.118,0.032),GREEN,[-0.08,0.53,0.19]);
add(g,rbox(0.30,0.02,0.10,0.008),GREENL,[-0.05,0.595,0.19]);
(function(){var c=document.createElement("canvas");c.width=512;c.height=220;var x=c.getContext("2d");
  x.fillStyle="#f2c41a";x.fillRect(0,0,512,220);x.strokeStyle="#111";x.lineWidth=8;x.strokeRect(8,8,496,204);
  x.fillStyle="#111";x.font="700 84px Arial, Helvetica, sans-serif";x.textAlign="center";x.textBaseline="middle";x.fillText("COOLANT",256,92);
  x.font="600 40px Arial, Helvetica, sans-serif";x.fillText("Use correct mix only",256,168);
  var tx=new T.CanvasTexture(c);tx.encoding=T.sRGBEncoding;tx.anisotropy=4;
  var lm=new T.Mesh(new T.PlaneGeometry(0.17,0.073),new T.MeshStandardMaterial({map:tx,roughness:0.5,metalness:0,transparent:true}));
  lm.position.set(-0.08,0.526,0.2495);lm.userData.c="#ffffff";g.add(lm)})();
/* radiator-style pressure cap in a dished ring, as on the real tank */
add(g,cyl(0.044,0.01),GREEN,[-0.15,0.608,0.19]);
add(g,new T.TorusGeometry(0.041,0.0032,8,36),GREENL,[-0.15,0.613,0.19],[Math.PI/2,0,0]);
add(g,lathe([[0,0],[0.036,0],[0.038,0.004],[0.038,0.008],[0.031,0.0125],[0.013,0.0155],[0.011,0.021],[0,0.021]],36),GREEN,[-0.15,0.613,0.19],null,{ds:true});
for(i=0;i<18;i++){var ka=i/18*Math.PI*2;add(g,rbox(0.004,0.007,0.004,0.001),GREENL,[-0.15+0.0385*Math.cos(ka),0.6195,0.19+0.0385*Math.sin(ka)],[0,-ka,0])}
add(g,rbox(0.024,0.006,0.01,0.002),GREENL,[-0.15,0.6335,0.19]);
/* overflow neck and gold braided hose running to the thermostat housing vent */
add(g,cyl(0.0075,0.022),STEEL,[-0.19,0.608,0.19],AX);add(g,cyl(0.0095,0.004),STEEL,[-0.2,0.608,0.19],AX);
var BR=[[-0.2,0.608,0.19],[-0.21,0.645,0.165],[-0.232,0.652,0.115],[-0.247,0.637,0.08],[-0.268,0.627,0.075]];
var GOLDB={c:"#c9a44c",r:0.45,m:0.45},GOLDD={c:"#8d6f2a",r:0.6,m:0.3};
hose(g,BR,0.0072,GOLDB);var BC=curve(BR);
for(var bi=0;bi<46;bi++){var bu=0.03+bi*0.0205,bq=BC.getPoint(bu),bt=BC.getTangent(bu);var bm=add(g,new T.TorusGeometry(0.0074,0.0009,4,12),GOLDD,[bq.x,bq.y,bq.z]);bm.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),bt);bm.rotateZ(bi*0.5)}
clampAt(g,[-0.205,0.614,0.188],[0.3,1,-0.5],0.0085,0);clampAt(g,[-0.261,0.629,0.076],[1,0.1,0],0.0085,Math.PI);
/* front end of the tank: spigots for the thermostat and raw water hoses */
add(g,cyl(0.0145,0.034),STEEL,[-0.293,0.56,0.19],AX);add(g,cyl(0.0205,0.005),STEEL,[-0.282,0.56,0.19],AX);
add(g,cyl(0.0145,0.034),STEEL,[-0.293,0.525,0.19],AX);add(g,cyl(0.0205,0.005),STEEL,[-0.282,0.525,0.19],AX);
/* aft end: end cover with bolts and a small drain stub */
add(g,cyl(0.05,0.008),GREENL,[0.124,0.53,0.19],AX);
for(i=0;i<6;i++){var ea=i/6*Math.PI*2;bolt(g,[0.131,0.53+0.04*Math.cos(ea),0.19+0.04*Math.sin(ea)],AX,0.0045,0.006)}
add(g,cyl(0.009,0.03),STEEL,[0.111,0.49,0.235],AZ);
add(g,rbox(0.04,0.04,0.03,0.006),GREEN,[-0.02,0.488,0.16]);

g=part("thermostat",[-0.3,0.8,0.2]);
add(g,cyl(0.034,0.07),GREEN,[-0.305,0.585,0.075]);add(g,cyl(0.028,0.014),STEEL,[-0.305,0.627,0.075]);
for(i=0;i<3;i++){var a4=i/3*Math.PI*2;bolt(g,[-0.305+0.02*Math.cos(a4),0.636,0.075+0.02*Math.sin(a4)],null,0.0055,0.006)}
add(g,cyl(0.0165,0.034),STEEL,[-0.305,0.585,0.1],AZ);add(g,cyl(0.0205,0.005),STEEL,[-0.305,0.585,0.087],AZ);
var TH=[[-0.305,0.585,0.108],[-0.306,0.585,0.14],[-0.322,0.572,0.18],[-0.325,0.563,0.19],[-0.30,0.56,0.19],[-0.2845,0.56,0.19]];
hose(g,TH,0.0185,{c:"#2a7566",r:0.7,m:0});
clampAt(g,[-0.305,0.585,0.118],[0,0,1],0.0215,0);clampAt(g,[-0.294,0.56,0.19],[1,0,0],0.0215,Math.PI);

/* ---- air and exhaust ---- */
g=part("turbo",[0.2,0.7,0.5]);
add(g,rbox(0.42,0.045,0.04,0.012),CAST,[0.02,0.52,0.153]);
add(g,cyl(0.03,0.06),CAST,[0.26,0.545,0.18],AZ);
add(g,cyl(0.062,0.055),CAST,[0.275,0.57,0.225],AX);add(g,cyl(0.05,0.018),CAST,[0.31,0.57,0.225],AX);
add(g,cyl(0.026,0.04),STEEL,[0.2375,0.57,0.225],AX);
add(g,cyl(0.052,0.05),ALU,[0.19,0.57,0.225],AX);add(g,cyl(0.03,0.03),ALU,[0.15,0.57,0.225],AX);
add(g,cyl(0.014,0.03),ALU,[0.2,0.62,0.245]);
for(i=0;i<6;i++){var a5=i/6*Math.PI*2;bolt(g,[0.2985,0.57+0.047*Math.cos(a5),0.225+0.047*Math.sin(a5)],AX,0.004,0.006)}
/* woven heat blanket wrapped round the turbine housing, laced with stainless wire */
(function(){var c=document.createElement("canvas");c.width=128;c.height=128;var x=c.getContext("2d");
  x.fillStyle="#d8d3c4";x.fillRect(0,0,128,128);
  for(var a=0;a<128;a+=4){x.fillStyle=(a/4)%2?"#cdc7b6":"#e2ddcf";x.fillRect(a,0,2,128);x.fillRect(0,a,128,2)}
  var gr=x.createLinearGradient(0,0,128,0);gr.addColorStop(0,"rgba(120,95,60,0.28)");gr.addColorStop(0.4,"rgba(120,95,60,0)");gr.addColorStop(1,"rgba(120,95,60,0.2)");x.fillStyle=gr;x.fillRect(0,0,128,128);
  var tx=new T.CanvasTexture(c);tx.encoding=T.sRGBEncoding;tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.repeat.set(7,4);
  var bm=new T.Mesh(new T.CylinderGeometry(0.073,0.073,0.072,36),new T.MeshStandardMaterial({map:tx,roughness:0.95,metalness:0}));
  bm.rotation.z=Math.PI/2;bm.position.set(0.281,0.575,0.225);bm.userData.c="#d8d3c4";bm.castShadow=true;bm.receiveShadow=true;g.add(bm);
  [-0.027,0.027].forEach(function(dx){add(g,new T.TorusGeometry(0.0738,0.0016,6,40),STEEL,[0.281+dx,0.575,0.225],[0,Math.PI/2,0])});
  add(g,cyl(0.0014,0.07),STEEL,[0.281,0.649,0.225],AX)})();

g=part("aircooler",[0.1,0.7,0.8]);
/* charge air cooler: compressed air leaves the turbo outlet in a black pipe, runs down the end of the engine and into the cooler on the front */
(function(){var CP=[[0.2,0.633,0.245],[0.2,0.605,0.268],[0.2,0.54,0.268],[0.19,0.49,0.262],[0.155,0.453,0.25],[0.12,0.445,0.245]];
  hose(g,CP,0.0185,BLACK);var cc=curve(CP);[0.04,0.97].forEach(function(u,k){var q=cc.getPoint(u),t=cc.getTangent(u);clampAt(g,[q.x,q.y,q.z],[t.x,t.y,t.z],0.0205,k*Math.PI)});
  add(g,cyl(0.032,0.12),ALU,[0.055,0.445,0.24],AX);add(g,cyl(0.036,0.01),ALU,[-0.007,0.445,0.24],AX);add(g,cyl(0.036,0.01),ALU,[0.117,0.445,0.24],AX);
  add(g,rbox(0.1,0.012,0.04,0.004),ALU,[0.055,0.417,0.225])})();

g=part("exhaust",[0.6,0.6,0.6]);
/* hose clamp: flat band lying round the hose, axis along the hose, screw housing on the band */
function clampAt(g,pos,axis,r,ang){
  var sg=new T.Group();sg.position.fromArray(pos);sg.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3().fromArray(axis).normalize());sg.rotateY(ang||0);g.add(sg);
  add(sg,new T.CylinderGeometry(r,r,0.011,32,1,true),STEEL,[0,0,0],null,{ds:true});
  add(sg,rbox(0.02,0.013,0.014,0.003),STEEL,[r+0.003,0,0]);
  add(sg,hex(0.0042,0.012),ZINC,[r+0.003,0,0.0095],[Math.PI/2,0,0]);
  add(sg,cyl(0.0022,0.02),STEEL,[r+0.003,0,0.002],[Math.PI/2,0,0]);
}
function nrm(a){var l=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);return[a[0]/l,a[1]/l,a[2]/l]}
var EL=[[0.315,0.57,0.225],[0.375,0.57,0.225],[0.43,0.53,0.245],[0.455,0.43,0.285]];
add(g,tube(EL,0.046,false,40),GREEN);
add(g,cyl(0.058,0.014),GREEN,[0.322,0.57,0.225],AX);
/* elbow outlet: bead and spigot along the outlet direction, hose slips over the spigot */
var ET=nrm([EL[3][0]-EL[2][0],EL[3][1]-EL[2][1],EL[3][2]-EL[2][2]]),EQ=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3().fromArray(ET));
var bead=add(g,cyl(0.05,0.012),GREEN,EL[3]);bead.quaternion.copy(EQ);
var sp=add(g,cyl(0.0385,0.07),GREEN,[EL[3][0]+ET[0]*0.035,EL[3][1]+ET[1]*0.035,EL[3][2]+ET[2]*0.035]);sp.quaternion.copy(EQ);
var HP=[[EL[3][0]+ET[0]*0.012,EL[3][1]+ET[1]*0.012,EL[3][2]+ET[2]*0.012],[EL[3][0]+ET[0]*0.075,EL[3][1]+ET[1]*0.075,EL[3][2]+ET[2]*0.075],[0.49,0.29,0.335],[0.52,0.25,0.345],[0.54,0.19,0.345],[0.54,0.125,0.345]],HR=0.045;
hose(g,HP,HR,RUBBER);
var HC=curve(HP);
for(var ri=0;ri<22;ri++){var ru=0.2+ri*0.034,rq=HC.getPoint(ru),rt=HC.getTangent(ru);var rm=add(g,new T.TorusGeometry(HR+0.0004,0.0028,6,24),RUBBER,[rq.x,rq.y,rq.z]);rm.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),rt)}
[0.045,0.11].forEach(function(u,k){var q=HC.getPoint(u),t=HC.getTangent(u);clampAt(g,[q.x,q.y,q.z],[t.x,t.y,t.z],HR+0.0025,k*Math.PI)});
/* lower connection: steel inlet pipe, hose over it, double clamp */
add(g,cyl(0.039,0.09),STEEL,[0.54,0.12,0.345]);add(g,cyl(0.05,0.012),STEEL,[0.54,0.075,0.345]);
[0.88,0.96].forEach(function(u,k){var q=HC.getPoint(u),t=HC.getTangent(u);clampAt(g,[q.x,q.y,q.z],[t.x,t.y,t.z],HR+0.0025,k*Math.PI)});

g=part("airfilter",[0.3,0.5,-0.7]);
/* moulded black intake silencer: large rounded wedge, green hose to the turbo inlet */
add(g,rbox(0.13,0.18,0.13,0.04),BLACK,[0.34,0.52,-0.215]);
add(g,rbox(0.105,0.055,0.105,0.03),BLACK,[0.34,0.625,-0.205]);
add(g,rbox(0.085,0.09,0.012,0.012),GREY,[0.34,0.5,-0.288]);
for(i=0;i<5;i++)add(g,rbox(0.075,0.006,0.008,0.002),BLACK,[0.34,0.47+i*0.018,-0.29]);
/* silencer outlet spigot, turbo inlet spigot; hose slips over both and is held by double clamps */
add(g,cyl(0.0265,0.06),BLACK,[0.34,0.675,-0.205]);add(g,cyl(0.033,0.006),BLACK,[0.34,0.652,-0.205]);
add(g,cyl(0.0265,0.06),CAST,[0.15,0.60,0.225]);add(g,cyl(0.033,0.006),CAST,[0.15,0.572,0.225]);
var HG={c:"#2a7566",r:0.7,m:0},AP=[[0.34,0.668,-0.205],[0.335,0.72,-0.17],[0.30,0.745,-0.06],[0.22,0.74,0.08],[0.165,0.70,0.2],[0.152,0.65,0.222],[0.15,0.597,0.225]],AR=0.031;
hose(g,AP,AR,HG);
var AC=curve(AP);[0.04,0.11,0.89,0.96].forEach(function(u,k){var q=AC.getPoint(u),t=AC.getTangent(u);clampAt(g,[q.x,q.y,q.z],[t.x,t.y,t.z],AR+0.0025,(k%2)*Math.PI)});
/* crankcase breather: round cover with five bolts on the valve cover, black hose rising to a tee on the intake hose, clamped both ends */
(function(){var gr=g;g=groups.rocker;
  var cx=0.16,cy=0.622,cz=0.015,RS={c:"#8a7f73",r:0.85,m:0.35};
  add(g,cyl(0.047,0.006),GREEN,[cx,cy+0.003,cz]);
  add(g,cyl(0.039,0.006),RS,[cx,cy+0.009,cz]);
  add(g,cyl(0.012,0.004),RS,[cx,cy+0.0125,cz]);
  for(i=0;i<5;i++){var ba=i/5*Math.PI*2+0.3;bolt(g,[cx+0.0335*Math.cos(ba),cy+0.0145,cz+0.0335*Math.sin(ba)],null,0.0042,0.007);add(g,cyl(0.0075,0.004),GREEN,[cx+0.0335*Math.cos(ba),cy+0.0095,cz+0.0335*Math.sin(ba)])}
  add(g,cyl(0.0105,0.026),STEEL,[cx+0.047,cy+0.014,cz],AX);add(g,cyl(0.0125,0.004),STEEL,[cx+0.036,cy+0.014,cz],AX);
  var q=AC.getPoint(0.57),tq=AC.getTangent(0.57);
  add(g,cyl(0.0095,0.022),STEEL,[q.x,q.y-0.038,q.z]);add(g,cyl(0.0125,0.004),STEEL,[q.x,q.y-0.031,q.z]);
  var BH=[[cx+0.05,cy+0.014,cz],[cx+0.085,cy+0.02,cz+0.01],[cx+0.1,cy+0.06,cz+0.03],[q.x+0.01,q.y-0.06,q.z-0.004],[q.x,q.y-0.044,q.z]];
  hose(g,BH,0.0112,BLACK);
  clampAt(g,[cx+0.059,cy+0.014,cz],[1,0.1,0],0.0132,0);clampAt(g,[q.x,q.y-0.047,q.z],[0,1,0],0.0132,0.4);
  g=gr})();

/* ---- fuel ---- */
g=part("injpump",[0,0,-0.6]);
add(g,rbox(0.20,0.08,0.02,0.006),ALU,[-0.12,0.35,-0.15]);
add(g,cyl(0.036,0.18),ALU,[-0.12,0.355,-0.185],AX);
add(g,cyl(0.044,0.03),BLACK,[-0.225,0.355,-0.185],AX);add(g,cyl(0.03,0.02),STEEL,[-0.045,0.355,-0.185],AX);
[-0.18,-0.14,-0.10,-0.06].forEach(function(x){add(g,hex(0.0135,0.03),GREEN,[x,0.4,-0.185]);add(g,cyl(0.009,0.012),GREEN,[x,0.42,-0.185])});
add(g,cyl(0.022,0.06),BLACK,[-0.195,0.405,-0.2]);
add(g,rbox(0.01,0.07,0.006,0.002),ALU,[-0.245,0.39,-0.215],[0,0,0.3]);add(g,new T.SphereGeometry(0.008,10,8),BLACK,[-0.255,0.425,-0.215]);
shiftG(g,[-0.04,0,0]);

g=part("injectors",[0,0.9,-0.4]);
var IPC=[];
XS.forEach(function(x,k){
  add(g,cyl(0.017,0.012),GREEN,[x,0.56,-0.12],[-0.3,0,0]);
  add(g,cyl(0.011,0.07),GREEN,[x,0.585,-0.125],[-0.3,0,0]);
  add(g,hex(0.0145,0.02),GREEN,[x,0.623,-0.136],[-0.3,0,0]);
  add(g,cyl(0.0105,0.01),STEEL,[x,0.636,-0.139],[-0.3,0,0]);
  add(g,cyl(0.004,0.022),BRASS,[x+0.016,0.612,-0.134],[0,0,Math.PI/2]);
  var xd=[-0.22,-0.18,-0.14,-0.10][k],dx=x-xd;
  var pts=[[xd,0.43,-0.185],[xd,0.466,-0.19],[xd+dx*0.35,0.505,-0.222],[xd+dx*0.75,0.575,-0.225],[x,0.615,-0.2],[x,0.63,-0.165],[x,0.632,-0.141]];
  add(g,tube(pts,0.0048,false,60),GREEN);IPC.push(curve(pts));
});
/* plate clamps holding the four pipes together */
[0.36,0.66].forEach(function(u){
  var q=IPC.map(function(c){return c.getPoint(u)}),x0=q[0].x,x1=q[3].x,cx=(x0+x1)/2,w=Math.abs(x1-x0)+0.034;
  add(g,rbox(w,0.016,0.018,0.004),GREENL,[cx,q[0].y,q[0].z]);
  add(g,hex(0.0065,0.01),GREEN,[x0-0.012,q[0].y,q[0].z-0.011],[Math.PI/2,0,0]);add(g,hex(0.0065,0.01),GREEN,[x1+0.012,q[0].y,q[0].z-0.011],[Math.PI/2,0,0]);
});
add(g,tube([[-0.2,0.64,-0.14],[0,0.645,-0.145],[0.22,0.64,-0.14]],0.003,false,12),BLACK);

g=part("fuelfilter",[0.3,0.2,-0.8]);
add(g,rbox(0.07,0.04,0.09,0.008),GREEN,[0.17,0.47,-0.185]);
add(g,rbox(0.10,0.04,0.09,0.008),GREEN,[0.17,0.48,-0.225]);
["ffOld","ffNew"].forEach(function(nm){var fs=osub(nm,[0.17,0.42,-0.225],[0,-1,0]);g.add(fs);
  add(fs,cyl(0.038,0.075),nm==="ffOld"?{c:"#cfd3d6",r:0.6,m:0.1}:WHITE,[0,0.0025,0]);add(fs,cyl(0.04,0.01),ALU,[0,0.04,0]);
  add(fs,cyl(0.0385,0.022),BLUE,[0,0,0]);add(fs,cyl(0.012,0.02),BLACK,[0,-0.045,0]);add(fs,cyl(0.006,0.012),YEL,[0,-0.061,0])});
OJ.ffNew.x=0.15;OJ.ffNew.tx=0.15;OJ.ffNew.s=0;OJ.ffNew.ts=0;
var fv=osub("fvent",[0.17,0.515,-0.225],[0,1,0]);g.add(fv);
add(fv,cyl(0.014,0.03),BLACK,[0,0,0]);add(fv,cyl(0.02,0.01),BLACK,[0,0.02,0]);
/* manual photo: filter sits level with the oil filter's centreline, between the feed pump and the injection pump */
shiftG(g,[-0.15,0,0],["ffOld","ffNew","fvent"]);
hose(g,[[0.065,0.482,-0.225],[0.1,0.5,-0.222],[0.135,0.49,-0.208],[0.14,0.468,-0.2]],0.0065,BLACK);
hose(g,[[-0.03,0.5,-0.225],[-0.075,0.545,-0.25],[-0.12,0.5,-0.25],[-0.135,0.43,-0.22],[-0.135,0.392,-0.195]],0.0065,BLACK);

g=part("fuelpump",[0.1,-0.2,-0.7]);
add(g,cyl(0.028,0.05),ALU,[0.08,0.27,-0.17],AZ);add(g,cyl(0.03,0.012),STEEL,[0.08,0.27,-0.2],AZ);
add(g,rbox(0.05,0.02,0.035,0.005),ALU,[0.08,0.30,-0.165]);
var fpl=osub("fpump",[0.105,0.255,-0.205],[0,0,0]);g.add(fpl);
add(fpl,rbox(0.009,0.05,0.005,0.002),STEEL,[0.0105,0.017,0],[0,0,0.35]);add(fpl,cyl(0.007,0.016),STEEL,[0.021,0.04,0],AZ);
shiftG(g,[0.06,0.175,0],["fpump"]);

/* ---- lubrication ---- */
g=part("oilfilter",[-0.2,-0.2,-0.7]);
add(g,cyl(0.04,0.014),ALU,[-0.14,0.20,-0.147],AZ);
[["ofOld",{c:"#cfd3d6",r:0.6,m:0.1}],["ofNew",WHITE]].forEach(function(q){
  var sg=osub(q[0],[-0.14,0.20,-0.14],[0,0,-1]);
  add(sg,lathe([[0.052,0],[0.052,0.008],[0.047,0.011],[0.046,0.095],[0.042,0.106],[0.03,0.113],[0,0.115]]),q[1],[0,0,0],[-Math.PI/2,0,0]);
  add(sg,cyl(0.0465,0.02),BLUE,[0,0,-0.06],AZ);g.add(sg)});
shiftG(g,[0.16,0,0],["ofOld","ofNew"]);
OJ.ofNew.x=0.15;OJ.ofNew.tx=0.15;OJ.ofNew.s=0;OJ.ofNew.ts=0;

g=part("dipstick",[0,0.6,-0.5]);
add(g,cyl(0.011,0.2),BLACK,[-0.06,0.40,-0.2]);add(g,cyl(0.016,0.012),ALU,[-0.06,0.305,-0.2]);
var dq=osub("dip",[-0.06,0.50,-0.2],[0,1,0]);g.add(dq);
add(dq,cyl(0.006,0.2),STEEL,[0,-0.07,0]);
add(dq,new T.TorusGeometry(0.015,0.0045,8,18),YEL,[0,0.05,0],[0,Math.PI/2,0]);add(dq,cyl(0.013,0.012),YEL,[0,0.004,0]);
/* oil drain hose and container (shown while pumping out) */
var dr=osub("drain",[0,0,0],[0,0,0]);g.add(dr);OJ.drain.s=0;OJ.drain.ts=0;
add(dr,cyl(0.012,0.03),BRASS,[-0.27,0.27,-0.168],AZ);
hose(dr,[[-0.27,0.27,-0.18],[-0.27,0.25,-0.24],[-0.27,0.16,-0.3],[-0.27,0.1,-0.3]],0.007,{c:"#c8a64a",r:0.6,m:0});
add(dr,lathe([[0.0,0],[0.06,0],[0.065,0.01],[0.07,0.11],[0.0,0.11]].map(function(a){return [a[0],a[1]]}),28),{c:"#2f6fa8",r:0.6,m:0.05},[-0.27,0.002,-0.3]);

g=part("rawpump",[-0.6,-0.1,-0.5]);
var PXC=-0.352,PYC=0.29,PZC=-0.16,PUMP={};
add(g,lathe([[0.043,-0.0225],[0.05,-0.0225],[0.05,0.0225],[0.043,0.0225]],40),BRASS,[PXC,PYC,PZC],AX,{ds:true});
add(g,cyl(0.05,0.008),BRASS,[PXC+0.0285,PYC,PZC],AX);add(g,cyl(0.012,0.012),STEEL,[PXC+0.0215,PYC,PZC],AX);
add(g,cyl(0.0125,0.045),BRASS,[-0.352,0.345,-0.16]);add(g,cyl(0.0175,0.005),BRASS,[-0.352,0.3235,-0.16]);add(g,cyl(0.014,0.045),BRASS,[-0.352,0.25,-0.205],AZ);
hose(g,[[-0.352,0.332,-0.16],[-0.352,0.395,-0.16],[-0.4,0.43,-0.12],[-0.42,0.47,0.0],[-0.39,0.512,0.14],[-0.34,0.523,0.188],[-0.30,0.525,0.19],[-0.2845,0.525,0.19]],0.0165,RUBBER);clampAt(g,[-0.294,0.525,0.19],[1,0,0],0.0195,Math.PI);
clampAt(g,[-0.352,0.352,-0.16],[0,1,0],0.0188,0);clampAt(g,[-0.352,0.37,-0.16],[0,1,0],0.0188,Math.PI);
function sub(name,dx){var s2=new T.Group();s2.position.set(PXC+(dx||0),PYC,PZC);g.add(s2);PUMP[name]={g:s2,bx:s2.position.x,by:PYC,x:0,s:1,tx:0,ts:1};return s2}
var OLDI={c:"#5a4636",r:0.9,m:0}, NEWI={c:"#16324a",r:0.8,m:0};
var pb=sub("bolts"),pcv=sub("cover"),ga=sub("gOld"),gb=sub("gNew"),io=sub("impOld"),inw=sub("impNew");
add(pcv,cyl(0.052,0.014),BRASS,[-0.031,0,0],AX);
for(i=0;i<6;i++){var a6=i/6*Math.PI*2;bolt(pb,[-0.040,0.04*Math.cos(a6),0.04*Math.sin(a6)],AX,0.0055,0.006)}
function ring(){return lathe([[0.03,-0.0008],[0.05,-0.0008],[0.05,0.0008],[0.03,0.0008]],40)}
add(ga,ring(),{c:"#c9bfa5",r:0.9,m:0},[-0.0238,0,0],AX,{ds:true});add(gb,ring(),{c:"#d8d0b8",r:0.9,m:0},[-0.0238,0,0],AX,{ds:true});
function impeller(grp,pal,broken){
  add(grp,cyl(0.014,0.036),pal,[0,0,0],AX);add(grp,cyl(0.0085,0.038),BRASS,[0,0,0],AX);
  for(var k=0;k<8;k++){
    if(broken&&(k===2||k===3)){var st=new T.Group();st.rotation.x=k/8*Math.PI*2;grp.add(st);add(st,rbox(0.036,0.006,0.003,0.0008),pal,[0,0.017,0]);continue}
    var v=new T.Group();v.rotation.x=k/8*Math.PI*2;grp.add(v);
    var vm=add(v,rbox(0.036,0.032,0.0032,0.001),pal,[0,0.03,0.004],[0.45,0,0])}
}
impeller(io,OLDI,true);impeller(inw,NEWI,false);
/* ---- electrical ---- */
g=part("starter",[0.1,-0.2,0.7]);
add(g,cyl(0.042,0.115),BLACK,[0.215,0.215,0.205],AX);add(g,cyl(0.036,0.03),ALU,[0.287,0.215,0.205],AX);
add(g,cyl(0.024,0.09),STEEL,[0.205,0.272,0.205],AX);add(g,cyl(0.012,0.022),BLACK,[0.262,0.272,0.205],AX);
add(g,cyl(0.0055,0.016),RED,[0.17,0.305,0.205]);add(g,cyl(0.0055,0.016),STEEL,[0.2,0.305,0.205]);
add(g,rbox(0.02,0.1,0.1,0.006),ALU,[0.275,0.215,0.205]);

g=part("relaybox",[-0.1,0.3,0.9]);
add(g,rbox(0.10,0.075,0.045,0.008),BLACK,[-0.10,0.405,0.168]);add(g,rbox(0.09,0.008,0.04,0.002),GREY,[-0.10,0.446,0.168]);
for(i=0;i<4;i++)bolt(g,[-0.135+i*0.023,0.45,0.168],null,0.0045,0.004);
add(g,rbox(0.04,0.02,0.03,0.004),BLACK,[-0.045,0.405,0.185]);
hose(g,[[-0.045,0.405,0.19],[0.05,0.385,0.225],[0.12,0.36,0.23],[0.152,0.335,0.215],[0.17,0.317,0.205]],0.0035,RED);
hose(g,[[-0.045,0.41,0.19],[0.05,0.395,0.23],[0.14,0.375,0.235],[0.188,0.34,0.215],[0.2,0.317,0.205]],0.0035,YEL);
/* ring lugs crimped on the wire ends, seated on the solenoid studs and held by nuts */
[0.17,0.2].forEach(function(x){add(g,cyl(0.0085,0.003),ZINC,[x,0.3155,0.205]);add(g,hex(0.0065,0.005),ZINC,[x,0.321,0.205])});
hose(g,[[-0.15,0.405,0.19],[-0.22,0.43,0.2],[-0.19,0.38,0.22]],0.0035,BLACK);

g=part("battery",[0,0,0.5]);
add(g,rbox(0.20,0.15,0.13,0.012),BLACK,[-0.44,0.075,0.5]);add(g,rbox(0.20,0.014,0.13,0.004),GREY,[-0.44,0.157,0.5]);
add(g,rbox(0.204,0.04,0.002,0.001),YEL,[-0.44,0.1,0.566]);
add(g,cyl(0.012,0.02),RED,[-0.5,0.174,0.5]);add(g,cyl(0.012,0.02),STEEL,[-0.38,0.174,0.5]);
add(g,tube([[-0.5,0.17,0.5],[-0.48,0.15,0.42],[-0.3,0.1,0.34],[0.0,0.09,0.3],[0.17,0.13,0.23],[0.17,0.3,0.205]],0.0055,false,50),RED);

g=part("mounts",[0,-0.9,0]);
(function(){
  var SF={c:"#8c949a",r:0.5,m:0.6};
  var fp=new T.Shape();fp.moveTo(-0.045,0);fp.lineTo(0.045,0);fp.lineTo(0.045,0.028);fp.lineTo(0.02,0.068);fp.lineTo(-0.02,0.068);fp.lineTo(-0.045,0.028);fp.closePath();
  var fg=new T.ExtrudeGeometry(fp,{depth:0.07,bevelEnabled:false,curveSegments:1});fg.translate(0,0,-0.035);
  [[-0.22,0.205],[-0.22,-0.205],[0.2,0.205],[0.2,-0.205]].forEach(function(p){
    var px=p[0],pz=p[1],sd=pz>0?1:-1;
    add(g,rbox(0.13,0.01,0.09,0.004),SF,[px,0.005,pz]);
    bolt(g,[px-0.052,0.014,pz],null,0.007,0.008);bolt(g,[px+0.052,0.014,pz],null,0.007,0.008);
    add(g,fg,SF,[px,0.01,pz],null,{ds:true});
    add(g,cyl(0.032,0.006),STEEL,[px,0.081,pz]);
    add(g,cyl(0.03,0.058,0.024),RUBBER,[px,0.113,pz]);
    add(g,cyl(0.034,0.006),STEEL,[px,0.145,pz]);
    add(g,rbox(0.075,0.026,0.085,0.008),GREEN,[px,0.165,sd*0.178]);
    add(g,rbox(0.06,0.06,0.016,0.004),GREEN,[px,0.17,sd*0.142]);
    add(g,cyl(0.0055,0.14),STEEL,[px,0.15,pz]);
    add(g,cyl(0.017,0.003),STEEL,[px,0.1815,pz]);
    bolt(g,[px,0.153,pz],null,0.011,0.009);bolt(g,[px,0.188,pz],null,0.011,0.009);bolt(g,[px,0.1985,pz],null,0.011,0.007);
  });
})();

/* rear saildrive-side mounts: stack on the transom platform, arms from the drive bracket */
(function(){
  var SF={c:"#8c949a",r:0.5,m:0.6};
  [-1,1].forEach(function(sd){
    var px=0.72,pz=sd*0.12,y0=0.115;
    add(g,rbox(0.1,0.01,0.09,0.004),SF,[px,y0+0.005,pz]);
    bolt(g,[px-0.036,y0+0.014,pz],null,0.007,0.008);bolt(g,[px+0.036,y0+0.014,pz],null,0.007,0.008);
    add(g,rbox(0.07,0.04,0.07,0.01),SF,[px,y0+0.03,pz]);
    add(g,cyl(0.03,0.005),STEEL,[px,y0+0.0525,pz]);
    add(g,cyl(0.028,0.05,0.022),RUBBER,[px,y0+0.08,pz]);
    add(g,cyl(0.032,0.005),STEEL,[px,y0+0.1075,pz]);
    add(g,cyl(0.0055,0.12),STEEL,[px,y0+0.12,pz]);
    add(g,cyl(0.017,0.003),STEEL,[px,y0+0.1675,pz]);
    bolt(g,[px,y0+0.122,pz],null,0.011,0.009);bolt(g,[px,y0+0.1755,pz],null,0.011,0.009);bolt(g,[px,y0+0.187,pz],null,0.011,0.007);
    add(g,rbox(0.1,0.022,0.07,0.007),BLACK,[0.675,y0+0.1285,pz]);
    add(g,rbox(0.05,0.07,0.014,0.004),BLACK,[0.64,y0+0.095,pz+sd*0.04]);
  });
})();

g=part("driveupper",[0.5,0.3,0]);
var DG={c:"#9aa2a7",r:0.5,m:0.55}, DGL={c:"#b4bbc0",r:0.45,m:0.55};
add(g,rbox(0.20,0.23,0.20,0.022),DG,[0.50,0.245,0]);
add(g,cyl(0.105,0.02),DG,[0.50,0.132,0]);
add(g,rbox(0.08,0.03,0.17,0.006),DG,[0.50,0.372,0]);
[-1,1].forEach(function(s){
  for(i=0;i<5;i++)add(g,rbox(0.17,0.006,0.007,0.002),DGL,[0.50,0.17+i*0.04,s*0.1035]);
  for(i=0;i<5;i++)add(g,rbox(0.006,0.19,0.007,0.002),DGL,[0.43+i*0.035,0.245,s*0.1035])});
add(g,cyl(0.025,0.07),WHITE,[0.52,0.2,-0.145],AZ);add(g,cyl(0.0255,0.016),BLUE,[0.52,0.2,-0.15],AZ);
add(g,cyl(0.018,0.02),STEEL,[0.50,0.30,0.121],AZ);
add(g,tube([[0.50,0.30,0.125],[0.50,0.3,0.2],[0.52,0.34,0.27]],0.0055,false,16),PALE);add(g,new T.SphereGeometry(0.013,12,10),PALE,[0.52,0.34,0.27]);
/* rear mount: black U bracket behind the casing */
[-1,1].forEach(function(sd){add(g,rbox(0.03,0.2,0.035,0.008),BLACK,[0.625,0.24,sd*0.12])});add(g,rbox(0.03,0.03,0.26,0.008),BLACK,[0.625,0.34,0]);
add(g,rbox(0.1,0.03,0.28,0.008),BLACK,[0.58,0.13,0]);
add(g,rbox(0.1,0.025,0.1,0.006),BLACK,[0.60,0.36,0]);

g=part("sdip",[0.6,0.5,0.2]);
/* saildrive oil dipstick: short tube in the top casing, brown cap */
add(g,cyl(0.012,0.034),BLACK,[0.55,0.392,0.05]);add(g,cyl(0.0095,0.014),{c:"#a8602a",r:0.5,m:0.1},[0.55,0.416,0.05]);add(g,cyl(0.0125,0.006),{c:"#a8602a",r:0.5,m:0.1},[0.55,0.405,0.05]);

g=part("seal",[0.6,-0.1,0]);
add(g,lathe([[0.072,0.002],[0.085,0.018],[0.12,0.024],[0.155,0.014],[0.19,0.026],[0.2,0.004],[0.196,-0.004],[0.155,0.008],[0.12,0.017],[0.085,0.01],[0.074,-0.003]],48),RUBBER,[0.50,0.118,0],null,{ds:true});
add(g,new T.TorusGeometry(0.201,0.004,8,56),STEEL,[0.50,0.122,0],[Math.PI/2,0,0]);
add(g,new T.TorusGeometry(0.073,0.0035,8,40),STEEL,[0.50,0.118,0],[Math.PI/2,0,0]);

g=part("seacock",[0.6,0.1,0.6]);
add(g,new T.SphereGeometry(0.026,16,12),BRASS,[0.50,0.195,0.145]);
add(g,cyl(0.017,0.05),BRASS,[0.50,0.195,0.115],AZ);add(g,cyl(0.015,0.045),BRASS,[0.55,0.195,0.145],AX);
add(g,cyl(0.007,0.03),STEEL,[0.50,0.222,0.145]);
var LEV=new T.Group();LEV.position.set(0.50,0.238,0.145);g.add(LEV);
add(LEV,rbox(0.011,0.008,0.09,0.002),RED,[0,0,0.04]);add(LEV,new T.SphereGeometry(0.0095,10,8),RED,[0,0,0.088]);
add(g,cyl(0.034,0.085),CLEAR,[0.60,0.195,0.145]);add(g,cyl(0.037,0.014),BLACK,[0.60,0.245,0.145]);add(g,cyl(0.037,0.014),BLACK,[0.60,0.148,0.145]);
hose(g,[[0.55,0.195,0.145],[0.57,0.2,0.145]],0.016,RUBBER);

g=part("leg",[0.6,-0.4,0]);
var LEGP=null,LEGSEC=null,LP={c:"#aab1b6",r:0.45,m:0.2};
(function(){
  /* leg: blunt rounded-rectangle section, near-parallel sides, three real through-slots in the forward third */
  var poly=[],k,n=40,A=0.11,B=0.052,E=3.0;
  for(k=0;k<n;k++){var th=k/n*Math.PI*2,cs=Math.cos(th),sn=Math.sin(th);
    poly.push([A*(cs<0?-1:1)*Math.pow(Math.abs(cs),2/E),B*(sn<0?-1:1)*Math.pow(Math.abs(sn),2/E)])}
  LEGSEC=poly;
  function clip(pl,keep){var out=[];for(var i2=0;i2<pl.length;i2++){var a=pl[i2],b=pl[(i2+1)%pl.length],ia=keep(a),ib=keep(b);
      if(ia)out.push(a);
      if(ia!==ib){var lim=keep.lim,tt=(lim-a[0])/(b[0]-a[0]);out.push([lim,a[1]+tt*(b[1]-a[1])])}}return out}
  var KA=function(p){return p[0]<=-0.07};KA.lim=-0.07;
  var KB=function(p){return p[0]>=-0.03};KB.lim=-0.03;
  var YT=0.185,YB=-0.26;
  function seg(pl,y0,y1){
    var sh=new T.Shape(pl.map(function(p){return new T.Vector2(p[0],p[1])}));
    var geo=new T.ExtrudeGeometry(sh,{depth:y0-y1,bevelEnabled:false,curveSegments:1});
    geo.rotateX(-Math.PI/2);geo.translate(0,y1,0);
    var ps=geo.attributes.position;
    for(var q=0;q<ps.count;q++){var yy=ps.getY(q),r=(YT-yy)/(YT-YB);ps.setX(q,ps.getX(q)*(1-0.1*r));ps.setZ(q,ps.getZ(q)*(1-0.08*r))}
    ps.needsUpdate=true;geo.computeVertexNormals();
    add(g,geo,LP,[0.50,-0.07,0])}
  var bands=[[0.185,-0.012,0],[-0.012,-0.028,1],[-0.028,-0.046,0],[-0.046,-0.062,1],[-0.062,-0.080,0],[-0.080,-0.096,1],[-0.096,-0.26,0]];
  bands.forEach(function(bd){
    if(!bd[2])seg(poly,bd[0],bd[1]);
    else{seg(clip(poly,KA),bd[0],bd[1]);seg(clip(poly,KB),bd[0],bd[1])}});
  /* rounded foot: lofted rings that close the leg section into a blunt bottom */
  var rings=8,pos=[],idx=[],sc=0.9,sz=0.92,hFoot=0.055,y0=-0.07+YB;
  for(var r2=0;r2<=rings;r2++){var ph=r2/rings*Math.PI/2,f=Math.cos(ph),yy2=y0-hFoot*Math.sin(ph);
    for(k=0;k<n;k++)pos.push(poly[k][0]*sc*f,yy2,poly[k][1]*sz*f)}
  for(var r3=0;r3<rings;r3++)for(k=0;k<n;k++){var k2=(k+1)%n,i0=r3*n+k,i1=r3*n+k2,i2=(r3+1)*n+k,i3=(r3+1)*n+k2;idx.push(i0,i2,i1,i1,i2,i3)}
  var fg=new T.BufferGeometry();fg.setAttribute("position",new T.Float32BufferAttribute(pos,3));fg.setIndex(idx);fg.computeVertexNormals();
  add(g,fg,LP,[0.50,0,0],null,{ds:true});
})();
add(g,rbox(0.25,0.03,0.12,0.012),LP,[0.50,0.1,0]);

g=part("lower",[0.6,-0.7,0]);
/* straight shaft housing running aft from the leg, as on the 150S (no torpedo bulb) */
add(g,cyl(0.041,0.2),LP,[0.64,-0.30,0],AX);
add(g,lathe([[0.041,-0.004],[0.047,-0.002],[0.047,0.002],[0.041,0.004]],32),LP,[0.585,-0.30,0],[0,0,-Math.PI/2],{ds:true});
add(g,lathe([[0.043,-0.007],[0.047,-0.007],[0.047,0.007],[0.043,0.007]],32),STEEL,[0.705,-0.30,0],[0,0,-Math.PI/2],{ds:true});
add(g,rbox(0.014,0.012,0.012,0.003),STEEL,[0.705,-0.30,0.05]);

g=part("sdrain",[0.5,-0.9,0.3]);
/* saildrive oil drain: a round port in the underside of the foot, on the centreline and forward of the old plug, laid on the slope of the dome */
(function(){var hx=0.45,hy=-0.3777,tl=[0,0,-0.31];
  add(g,lathe([[0.0105,-0.0012],[0.0155,-0.0012],[0.0155,0.0006],[0.0105,0.0006]],32),LP,[hx,hy,0],tl,{ds:true});
  add(g,cyl(0.0105,0.0014),{c:"#0d1114",r:0.9,m:0},[hx,hy-0.0006,0],tl)})();

g=part("anode",[1.0,-0.7,0]);
/* split anode collar with saw-tooth rim, clamped round the housing where it leaves the leg */
(function(){var cx=0.612,cy=-0.30,R=0.054;
  add(g,lathe([[0.04,-0.016],[R,-0.016],[R,0.016],[0.04,0.016]],36),ZINC,[cx,cy,0],[0,0,-Math.PI/2],{ds:true});
  for(i=0;i<20;i++){var ph=i/20*Math.PI*2,tx=i%2?-1:1;
    add(g,rbox(0.014,0.012,0.011,0.002),ZINC,[cx+tx*0.011,cy+(R+0.003)*Math.cos(ph),(R+0.003)*Math.sin(ph)],[ph,0,0])}
  add(g,rbox(0.03,0.016,0.03,0.004),ZINC,[cx,cy-0.057,0.0]);
  bolt(g,[cx,cy-0.058,0.0],null,0.008,0.03,STEEL);
})();

g=part("prop",[1.4,-0.7,0]);
/* three-blade folding propeller: blades open under power, fold aft when stopped */
var PROPB=[],foldV=1;
add(g,lathe([[0,0],[0.028,0.004],[0.034,0.02],[0.034,0.05],[0.028,0.074],[0.012,0.088],[0,0.092]]),ALU,[0.672,-0.30,0],[0,0,-Math.PI/2]);
add(g,cyl(0.034,0.012),STEEL,[0.676,-0.30,0],AX);
(function(){
  var pts=[[-0.026,0.0],[-0.05,0.04],[-0.058,0.10],[-0.044,0.16],[0,0.215],[0.045,0.19],[0.074,0.12],[0.066,0.05],[0.03,0.0]].map(function(p){return new T.Vector2(p[0],p[1])});
  var sp=new T.Shape(new T.SplineCurve(pts).getPoints(40));
  var bg=new T.ExtrudeGeometry(sp,{depth:0.0045,bevelEnabled:true,bevelThickness:0.0015,bevelSize:0.0015,bevelSegments:1,curveSegments:1});
  bg.translate(0,0,-0.00225);bg.rotateY(-Math.PI/2);
  [0,1,2].forEach(function(k){
    var sg=new T.Group();sg.position.set(0.715,-0.30,0);sg.rotation.x=k*Math.PI*2/3;
    var hb=new T.Group();hb.position.set(0,0.05,0);sg.add(hb);PROPB.push(hb);
    var bl=add(hb,bg,BRASS,[0,0.002,0]);bl.rotation.y=0.55;bl.rotation.z=-0.1;
    add(hb,cyl(0.0105,0.034),BRASS,[0,0,0],AZ);
    add(sg,rbox(0.036,0.03,0.007,0.002),ALU,[0,0.034,0.0205]);add(sg,rbox(0.036,0.03,0.007,0.002),ALU,[0,0.034,-0.0205]);
    add(sg,cyl(0.0042,0.056),STEEL,[0,0.05,0],AZ);
    add(sg,cyl(0.0068,0.004),STEEL,[0,0.05,0.027],AZ);add(sg,cyl(0.0068,0.004),STEEL,[0,0.05,-0.027],AZ);
    g.add(sg);
  });
})();

var PSPIN=new T.Group(),spinA=0;PSPIN.position.set(0.76,-0.30,0);
g.children.slice().forEach(function(c){c.position.x-=0.7;c.position.y+=0.30;PSPIN.add(c)});g.add(PSPIN);

/* ---- hull and engine bed (context only, not clickable) ---- */
(function(){
  function dm(geo,pos){var m=new T.Mesh(geo,mat(HULL));m.position.fromArray(pos);m.userData.c=HULL.c;m.castShadow=true;m.receiveShadow=true;scene.add(m);decor.push(m);return m}
  dm(rbox(0.74,0.03,0.58,0.01),[-0.05,-0.0225,0]);
  dm(rbox(0.04,0.16,0.58,0.01),[0.335,0.04,0]);
  var s=new T.Shape();s.moveTo(-0.25,-0.4);s.lineTo(0.25,-0.4);s.lineTo(0.25,0.4);s.lineTo(-0.25,0.4);s.closePath();
  var h=new T.Path();h.absarc(-0.07,0,0.085,0,Math.PI*2,true);s.holes.push(h);
  var geo=new T.ExtrudeGeometry(s,{depth:0.02,bevelEnabled:true,bevelThickness:0.005,bevelSize:0.005,bevelSegments:2,curveSegments:32});
  geo.translate(0,0,-0.01);geo.rotateX(-Math.PI/2);
  dm(geo,[0.57,0.1,0]);
})();

/* ---- internals (visible in X-ray) ---- */
var R=0.03, ROD=0.15, PHI=[0,Math.PI,Math.PI,0], crank=new T.Group(), camsh=null;
crank.position.set(0,0.20,0);rig.add(crank);
(function(){
  var CS=function(p,pos,geo,rot){var m=add(crank,geo,p,pos,rot);return m};
  CS(STEEL,[0,0,0],cyl(0.016,0.66),AX);
  CS(STEEL,[0.33,0,0],cyl(0.15,0.035),AX);CS(CAST,[0.33,0,0],cyl(0.158,0.012),AX);
  CS(STEEL,[-0.325,0,0],cyl(0.03,0.04),AX);
  XS.forEach(function(x,k){
    var sg=Math.cos(PHI[k])>0?1:-1;
    [-0.016,0.016].forEach(function(dx){
      CS(STEEL,[x+dx,-sg*0.012,0],rbox(0.012,0.085,0.045,0.004));
      CS(STEEL,[x+dx,-sg*0.03,0],cyl(0.036,0.012),AX);
    });
    CS(STEEL,[x,sg*R,0],cyl(0.014,0.044),AX);
  });
})();
var pistons=[], rods=[];
(function(){
  XS.forEach(function(x){
    var pg=new T.Group();rig.add(pg);
    add(pg,cyl(0.046,0.06),ALU,[0,0.015,0]);[0.032,0.022,0.012].forEach(function(dy){add(pg,cyl(0.0475,0.004),STEEL,[0,dy,0])});
    add(pg,cyl(0.009,0.07),STEEL,[0,0,0],AX);
    pg.position.x=x;pistons.push(pg);
    var rd=new T.Group();rig.add(rd);
    add(rd,rbox(0.014,ROD,0.016,0.003),STEEL,[0,0,0]);add(rd,cyl(0.02,0.026),STEEL,[0,-ROD/2,0],AX);
    rd.position.x=x;rods.push(rd);
    add(rig,new T.CylinderGeometry(0.0525,0.0525,0.17,24,1,true),ALU,[x,0.355,0],null,{ds:true,op:0.22});
  });
  [-0.28,-0.14,0,0.14,0.28].forEach(function(x){add(crank,cyl(0.017,0.036),STEEL,[x,0,0],AX)});
  /* camshaft at half crank speed, valves, springs, rocker shaft */
  camsh=new T.Group();camsh.position.set(0,0.36,-0.085);rig.add(camsh);
  add(camsh,cyl(0.01,0.56),STEEL,[0,0,0],AX);
  XS.forEach(function(x,k){[-0.022,0.022].forEach(function(dx,j){add(camsh,rbox(0.012,0.034,0.022,0.004),STEEL,[x+dx,0.004,0],[(k+j)*1.6,0,0])})});
  XS.forEach(function(x){[-0.022,0.022].forEach(function(dx,j){
    var z=j?0.038:-0.038;
    add(rig,cyl(0.0035,0.09),STEEL,[x+dx,0.5,z]);add(rig,cyl(0.015,0.004),STEEL,[x+dx,0.455,z]);
    add(rig,new T.TorusGeometry(0.0085,0.0018,6,14),STEEL,[x+dx,0.51,z],[Math.PI/2,0,0]);
    add(rig,cyl(0.01,0.034),STEEL,[x+dx,0.515,z]);
    add(rig,rbox(0.014,0.008,0.075,0.003),STEEL,[x+dx,0.562,z*0.45+0.004*(j?1:-1)]);
  })});
  add(rig,cyl(0.006,0.52),STEEL,[0,0.572,0],AX);
})();

/* state */
var camGoal=null, levT=0, levV=0, xray=false, running=false, explode=0, angle=0, focus=null, flashId=null;
function refresh(){
  Object.keys(groups).forEach(function(id){
    var gr=groups[id], dim=sysFilter&&PARTS[id].s!==sysFilter, shell=xray&&shells.indexOf(id)>=0;
    gr.userData.pick=!dim&&!shell;
    gr.traverse(function(m){if(!m.isMesh)return;
      m.material.color.copy(lin(m.userData.c));
      if(sysFilter&&!dim)m.material.color.lerp(lin(SYS[sysFilter].color),0.5);
      m.material.opacity=dim?0.07:(shell?0.16:1);
      m.material.depthWrite=!(dim||shell);
      m.castShadow=!(dim||shell);
      m.material.emissive.copy(lin(id===flashId?"#2f9e5f":(id===selected?"#c8551b":"#000000")));
      m.material.emissiveIntensity=id===flashId?0.8:(id===selected?(job.on?0.2:0.55):0);
    });
    gr.position.copy(gr.userData.dir).multiplyScalar(explode*0.42);
  });
  decor.forEach(function(m){m.material.opacity=sysFilter?0.1:(xray?0.5:1);m.material.depthWrite=!(sysFilter||xray);m.castShadow=!(sysFilter||xray)});
}
function centre(id){var b=new T.Box3().setFromObject(groups[id]);return b.getCenter(new T.Vector3())}
api.refresh=refresh;
api.pose=function(p){levT=p.lever;Object.keys(OJ).forEach(function(k){var o=OJ[k],q=(p[k]||{});o.tx=q.x||0;o.ts=q.s===undefined?1:q.s});["bolts","cover","impOld","impNew","gOld","gNew"].forEach(function(k){var o=PUMP[k],q=p[k]||{};o.tx=q.x||0;o.ts=q.s===undefined?1:q.s})};
api.view=function(look,off){var c=new T.Vector3().fromArray(look);camGoal=c.clone().add(new T.Vector3().fromArray(off));focus=c};
api.camSnap=function(){if(camGoal){cam.position.copy(camGoal);camGoal=null}if(focus){ctl.target.copy(focus);focus=null}ctl.update()};
renderer.domElement.addEventListener("pointerdown",function(){camGoal=null});
function stepPose(dt){
  var k=1-Math.exp(-dt*5);
  Object.keys(PUMP).forEach(function(n){var o=PUMP[n];
    o.x+=(o.tx-o.x)*k;o.s+=(o.ts-o.s)*k;
    var lift=n==="bolts"?0:-o.x*0.25;
    o.g.position.set(o.bx+o.x,o.by+lift,PZC);
    o.g.scale.setScalar(Math.max(o.s,0.001));o.g.visible=o.s>0.02;
    if(n==="impOld"||n==="impNew")o.g.rotation.x=o.x*28});
  Object.keys(OJ).forEach(function(n){var o=OJ[n];o.x+=(o.tx-o.x)*k;o.s+=(o.ts-o.s)*k;
    o.g.position.set(o.bp[0]+o.dir[0]*o.x,o.bp[1]+o.dir[1]*o.x,o.bp[2]+o.dir[2]*o.x);
    if(n==="ofOld"||n==="ofNew"||n==="ffOld"||n==="ffNew")o.g.scale.setScalar(Math.max(o.s,0.001));
    if(n==="fpump")o.g.rotation.z=o.x*(0.25+0.25*Math.sin(performance.now()/110));
    o.g.visible=o.s>0.02;
    if(n==="ofNew"||n==="ofOld")o.g.rotation.z=o.x*18});
  var open=running||(sim.on&&sim.rpm>250),fk=1-Math.exp(-dt*(open?2.5:1.2));
  foldV+=((open?0:1)-foldV)*fk;PROPB.forEach(function(h){h.rotation.z=-foldV*1.5});
  levV+=(levT-levV)*k;LEV.rotation.y=-levV*Math.PI/2;
}
api.flash=function(id){flashId=id;refresh();setTimeout(function(){flashId=null;refresh()},1800)};
api.select=function(id,fromPanel){
  selected=id||null;
  if(selected&&sysFilter&&PARTS[selected].s!==sysFilter){sysFilter=null;[].forEach.call($("sys").children,function(c){c.setAttribute("aria-pressed","false")})}
  refresh();renderPart();
  if(selected){focus=centre(selected);if(sim.on)showTab("tPrac");else if(job.on){}else if(!fromPanel||window.innerWidth>820)showTab("tPart")}
  if(sim.on)renderSel();
};
$("bXray").onclick=function(){xray=!xray;this.setAttribute("aria-pressed",xray);refresh()};
$("bRun").onclick=function(){running=!running;this.setAttribute("aria-pressed",running);this.textContent=running?"Stop engine":"Run engine";if(running&&!xray)$("bXray").click()};
$("explode").oninput=function(){explode=this.value/100;refresh();if(selected)focus=centre(selected)};
$("bReset").onclick=function(){cam.position.copy(HOME);focus=TGT.clone()};

/* picking */
var ray=new T.Raycaster(), down=null;
renderer.domElement.addEventListener("pointerdown",function(e){down=[e.clientX,e.clientY]});
renderer.domElement.addEventListener("pointerup",function(e){
  if(!down||Math.abs(e.clientX-down[0])+Math.abs(e.clientY-down[1])>6)return;
  var r=renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),cam);
  var list=[];Object.keys(groups).forEach(function(id){if(groups[id].userData.pick)list.push(groups[id])});
  var hit=ray.intersectObjects(list,true);
  if(hit.length){var o=hit[0].object;while(o&&!o.userData.id)o=o.parent;api.select(o.userData.id)}
});

function size(){var w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
window.addEventListener("resize",size);if(window.ResizeObserver)new ResizeObserver(size).observe(stage);size();refresh();

function crankAngle(a){
  crank.rotation.x=a;
  for(var k=0;k<4;k++){
    var th=a+PHI[k], cy=0.20+R*Math.cos(th), cz=R*Math.sin(th);
    var py=0.20+R*Math.cos(th)+Math.sqrt(ROD*ROD-R*R*Math.sin(th)*Math.sin(th));
    pistons[k].position.y=py;
    var dy=py-cy, dz=-cz;
    rods[k].position.set(XS[k],(py+cy)/2,cz/2);rods[k].rotation.x=Math.atan2(dz,dy);
  }
  camsh.rotation.x=a/2;
}
var still=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches, last=performance.now();
/* smoke and steam */
var PN=90, plist=[], pidx=0, pgeo=new T.SphereGeometry(0.022,8,6), emitAcc=0, steamAcc=0, tGauge=0;
(function(){for(var k=0;k<PN;k++){var p=new T.Mesh(pgeo,new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));p.visible=false;p.userData={on:false,age:0,life:1,o:0,sc:1,v:new T.Vector3()};scene.add(p);plist.push(p)}})();
function emit(x,y,z,col,op,vx,vy,vz,life,sc){
  var p=plist[pidx=(pidx+1)%PN],u=p.userData;u.on=true;u.age=0;u.life=life;u.o=op;u.sc=sc;
  u.v.set(vx+(Math.random()-0.5)*0.03,vy+(Math.random()-0.5)*0.02,vz+(Math.random()-0.5)*0.03);
  p.position.set(x,y,z);p.material.color.copy(lin(col));p.visible=true}
function stepParticles(dt){
  for(var k=0;k<PN;k++){var p=plist[k],u=p.userData;if(!u.on)continue;
    u.age+=dt;if(u.age>=u.life){u.on=false;p.visible=false;continue}
    var q=u.age/u.life;p.position.addScaledVector(u.v,dt);u.v.y+=0.02*dt;
    p.scale.setScalar(u.sc*(1+q*3.2));p.material.opacity=u.o*(1-q)*(q<0.1?q/0.1:1)}}
var SMK={black:["#161616",0.6,22],white:["#f4f4f4",0.55,16],blue:["#8ea3c9",0.38,12]};
crankAngle(0);

(function loop(now){
  requestAnimationFrame(loop);
  var dt=Math.min((now-last)/1000,0.05);last=now;
  if(sim.on){
    simStep(dt);
    if(sim.rpm>0){angle+=dt*(2+sim.rpm/3300*14)*(still?0.2:1);crankAngle(angle)}
    var a=(sim.state==="run"?0.0005+sim.vib*0.0035:(sim.state==="crank"&&sim.rpm>0?0.0006:0))*(still?0.3:1),t=now*0.001;
    rig.position.set(Math.sin(t*47)*a,Math.sin(t*61+1)*a,Math.sin(t*53+2)*a);
    rig.rotation.set(sim.fx.tilt+Math.sin(t*39)*a*2,0,Math.sin(t*43)*a*2);
    if(SMK[sim.smoke]&&sim.smokeI>0){var sm=SMK[sim.smoke];emitAcc+=sm[2]*sim.smokeI*dt;
      while(emitAcc>=1){emitAcc--;emit(0.54,0.10,0.37,sm[0],sm[1],0.03,0.05,0.14,2.2,0.7)}}
    if(sim.steam){steamAcc+=18*dt;while(steamAcc>=1){steamAcc--;emit(-0.15,0.65,0.19,"#f4f4f4",0.4,0.0,0.12,0.02,1.8,0.8)}}
    var bp=groups.belt;bp.position.copy(bp.userData.dir).multiplyScalar(explode*0.42);bp.position.y-=sim.fx.beltSag*0.012;
    tGauge+=dt;if(tGauge>0.12){tGauge=0;updateGauges()}
  }else{
    rig.position.set(0,0,0);rig.rotation.set(0,0,0);
    if(running){angle+=dt*(still?1.5:9);crankAngle(angle)}
  }
  stepParticles(dt);stepPose(dt);
  var pr=sim.on?sim.rpm:(running?2200:0);spinA+=dt*pr/3300*16*(still?0.2:1);PSPIN.rotation.x=spinA;
  audioUpdate(pr,sim.on&&sim.state==='crank',sim.on?(sim.fx.rough||0)+(sim.fx.vib||0)*0.5:0,sim.on&&sim.alarms&&sim.alarms.length>0&&sim.state==='run',dt);
  if(camGoal){cam.position.lerp(camGoal,0.08);if(cam.position.distanceTo(camGoal)<0.01)camGoal=null}
  if(focus){ctl.target.lerp(focus,0.12);if(ctl.target.distanceTo(focus)<0.002)focus=null}
  ctl.update();renderer.render(scene,cam);
})(last);
applyHash();
})();
