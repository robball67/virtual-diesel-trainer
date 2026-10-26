/* Synthesised sound: firing pulses, injector clatter, starter, alarm. */
import * as store from "./store.js";
var $=function(id){return document.getElementById(id)};
var AU={ctx:null,on:store.get("sound",true)};
$("bSnd").setAttribute("aria-pressed",AU.on);$("bSnd").textContent=AU.on?"Sound on":"Sound off";
function audioInit(){
  if(AU.ctx||!AU.on)return;
  try{
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    var c=new AC(),m=c.createGain();m.gain.value=0.9;m.connect(c.destination);
    var lp=c.createBiquadFilter();lp.type="lowpass";lp.frequency.value=400;lp.Q.value=0.7;
    var eg=c.createGain();eg.gain.value=0;lp.connect(eg);eg.connect(m);
    var o1=c.createOscillator();o1.type="sawtooth";var g1=c.createGain();g1.gain.value=1;o1.connect(g1);g1.connect(lp);
    var o2=c.createOscillator();o2.type="square";var g2=c.createGain();g2.gain.value=0.5;o2.connect(g2);g2.connect(lp);
    var nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=nb.getChannelData(0);for(var k=0;k<d.length;k++)d[k]=Math.random()*2-1;
    var ns=c.createBufferSource();ns.buffer=nb;ns.loop=true;
    var bp=c.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1500;bp.Q.value=0.8;
    var cg=c.createGain();cg.gain.value=0;
    var lfo=c.createOscillator();lfo.type="square";var lg=c.createGain();lg.gain.value=0;lfo.connect(lg);lg.connect(cg.gain);
    ns.connect(bp);bp.connect(cg);cg.connect(m);
    var so=c.createOscillator();so.type="sawtooth";var sg=c.createGain();sg.gain.value=0;
    var sf=c.createBiquadFilter();sf.type="bandpass";sf.frequency.value=900;sf.Q.value=1.5;so.connect(sf);sf.connect(sg);sg.connect(m);
    var ao=c.createOscillator();ao.type="square";ao.frequency.value=880;var ag=c.createGain();ag.gain.value=0;ao.connect(ag);ag.connect(m);
    [o1,o2,ns,lfo,so,ao].forEach(function(n){n.start()});
    AU.ctx=c;AU.m=m;AU.lp=lp;AU.eg=eg;AU.o1=o1;AU.o2=o2;AU.cg=cg;AU.lfo=lfo;AU.lg=lg;AU.bp=bp;AU.so=so;AU.sg=sg;AU.ag=ag;AU.t=0;
  }catch(e){AU.ctx=null}
}
["pointerdown","keydown"].forEach(function(ev){document.addEventListener(ev,function(){audioInit();if(AU.ctx&&AU.ctx.state==="suspended")AU.ctx.resume()},true)});
$("bSnd").onclick=function(){AU.on=!AU.on;store.set("sound",AU.on);this.setAttribute("aria-pressed",AU.on);this.textContent=AU.on?"Sound on":"Sound off";
  if(AU.ctx)AU.m.gain.setTargetAtTime(AU.on?0.9:0,AU.ctx.currentTime,0.05);else audioInit()};
export function audioUpdate(rpm,starter,rough,alarm,dt){
  var c=AU.ctx;if(!c||c.state!=="running")return;var t=c.currentTime;AU.t+=dt;
  var run=rpm>120&&!starter,fire=Math.max(rpm,1)/60*2;
  fire*=1+rough*0.04*Math.sin(AU.t*9);
  var load=Math.min(rpm/3300,1);
  AU.o1.frequency.setTargetAtTime(fire,t,0.04);AU.o2.frequency.setTargetAtTime(fire*0.5,t,0.04);
  AU.lp.frequency.setTargetAtTime(260+load*900,t,0.1);
  AU.eg.gain.setTargetAtTime(run?0.10+load*0.16:0,t,0.12);
  AU.lfo.frequency.setTargetAtTime(fire,t,0.04);
  AU.cg.gain.setTargetAtTime(run?0.03+load*0.06:0,t,0.12);AU.lg.gain.setTargetAtTime(run?0.03+load*0.06:0,t,0.12);
  AU.bp.frequency.setTargetAtTime(1200+load*1500,t,0.1);
  AU.so.frequency.setTargetAtTime(110+rpm*0.35,t,0.05);
  AU.sg.gain.setTargetAtTime(starter&&rpm>20?0.07:0,t,0.08);
  AU.ag.gain.setTargetAtTime(alarm&&(AU.t%0.8)<0.25?0.035:0,t,0.01);
}
