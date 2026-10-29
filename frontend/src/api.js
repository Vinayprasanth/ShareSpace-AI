const BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');
// A fresh browser tab starts signed out; an existing tab may keep its own session.
// Remove legacy persistent login from older ShareSpace builds.
try { localStorage.removeItem('ss_token'); } catch {}
let token = sessionStorage.getItem('ss_session_token') || '';
export function setToken(value){token=value||'';if(token)sessionStorage.setItem('ss_session_token',token);else sessionStorage.removeItem('ss_session_token');}
export function getToken(){return token;}
export async function api(path, options={}){
 const headers={'Content-Type':'application/json',...(options.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;
 const response=await fetch(`${BASE}${path}`,{...options,headers,body:options.body&&typeof options.body!=='string'?JSON.stringify(options.body):options.body});
 let data={};try{data=await response.json();}catch{}
 if(!response.ok){const error=new Error(data.error||`Request failed (${response.status})`);error.data=data;error.status=response.status;throw error;}
 return data;
}
