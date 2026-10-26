/* App shell: theme switch, install button and service worker. */
import * as store from "./store.js";
var $=function(id){return document.getElementById(id)};

var THEMES=["auto","light","dark"],theme=store.get("theme","auto");
function applyTheme(){
  if(theme==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",theme);
  $("bTheme").textContent="Theme: "+theme[0].toUpperCase()+theme.slice(1);
}
$("bTheme").onclick=function(){theme=THEMES[(THEMES.indexOf(theme)+1)%THEMES.length];store.set("theme",theme);applyTheme()};
applyTheme();

var deferred=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferred=e;$("bInstall").hidden=false});
$("bInstall").onclick=function(){if(!deferred)return;deferred.prompt();deferred.userChoice.finally(function(){deferred=null;$("bInstall").hidden=true})};
window.addEventListener("appinstalled",function(){$("bInstall").hidden=true});

if("serviceWorker" in navigator&&location.protocol!=="file:"){
  window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(e){console.warn("Service worker not registered",e)})});
}
