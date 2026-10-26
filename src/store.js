/* Small wrapper over localStorage. Progress lives on this device only; a blocked or private store just means nothing is remembered. */
var KEY="vdt:";
export function get(k,d){try{var v=localStorage.getItem(KEY+k);return v===null?d:JSON.parse(v)}catch(e){return d}}
export function set(k,v){try{localStorage.setItem(KEY+k,JSON.stringify(v))}catch(e){}}
