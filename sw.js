/* Offline support. App files are network-first (always fresh when online),
   CDN files (three.js, fonts) are cache-first since their URLs are versioned. Bump VERSION on release. */
var VERSION="vdt-v1";
var SHELL=["./","index.html","manifest.webmanifest","src/styles.css","src/main.js","src/shell.js","src/store.js","src/audio.js",
  "src/data/engine.js","src/data/faults.js","src/data/scenarios.js","src/data/jobs.js",
  "icons/icon.svg","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];
var CDN=["https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/controls/OrbitControls.js"];

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){
    return c.addAll(SHELL).then(function(){return c.addAll(CDN).catch(function(){})});
  }).then(function(){return self.skipWaiting()}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k!==VERSION}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
function put(req,res){if(res&&(res.ok||res.type==="opaque")){var copy=res.clone();caches.open(VERSION).then(function(c){c.put(req,copy)})}return res}
self.addEventListener("fetch",function(e){
  var req=e.request;if(req.method!=="GET")return;
  var url=new URL(req.url);
  if(url.origin===location.origin){
    e.respondWith(fetch(req).then(function(r){return put(req,r)}).catch(function(){
      return caches.match(req,{ignoreSearch:true}).then(function(r){return r||(req.mode==="navigate"?caches.match("index.html"):Response.error())});
    }));
  }else if(/^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)){
    e.respondWith(caches.match(req).then(function(r){return r||fetch(req).then(function(n){return put(req,n)})}));
  }
});
