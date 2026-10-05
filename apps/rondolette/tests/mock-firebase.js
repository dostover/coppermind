// In-browser stand-in for the Firebase compat SDK (app, auth, database), for tests only.
// Pages on the same origin share one fake database through localStorage and see each
// other's writes through BroadcastChannel. Each page's user comes from ?u=<name>.
// Supports what index.html uses: signInAnonymously, ref/child, on('value'), set, update,
// transaction, onDisconnect().remove() (a no-op) and .info/connected. Like Firebase, it
// drops nulls and empty containers and turns dense numeric-keyed objects back into arrays.
(function(){
  const u = new URLSearchParams(location.search).get('u') || 'alice';
  const bc = new BroadcastChannel('fbmock'); const listeners=[];
  const load=()=>JSON.parse(localStorage.getItem('fbmock')||'{}'), save=t=>localStorage.setItem('fbmock',JSON.stringify(t));
  const parts=p=>p.split('/').filter(Boolean);
  function prune(v){ if (v===null||v===undefined) return undefined; if (Array.isArray(v)){ const a=v.map(prune); if (!a.some(x=>x!==undefined)) return undefined; const o={}; a.forEach((x,i)=>{ if(x!==undefined) o[i]=x; }); return o; } if (typeof v==='object'){ const o={}; for (const k in v){ const x=prune(v[k]); if (x!==undefined) o[k]=x; } return Object.keys(o).length?o:undefined; } return v; }
  function arrayify(v){ if (v && typeof v==='object'){ const ks=Object.keys(v); const isArr = ks.length && ks.every((k,i)=>String(i)===k); const o = isArr ? ks.map(k=>arrayify(v[k])) : Object.fromEntries(ks.map(k=>[k,arrayify(v[k])])); return o; } return v; }
  function getAt(t,p){ let c=t; for (const k of parts(p)){ if (!c||typeof c!=='object') return undefined; c=c[k]; } return c; }
  function setAt(t,p,v){ const ks=parts(p); let c=t; ks.slice(0,-1).forEach(k=>{ if (!c[k]||typeof c[k]!=='object') c[k]={}; c=c[k]; }); const last=ks.at(-1); const pv=prune(v); if (pv===undefined) delete c[last]; else c[last]=pv; }
  const notify=()=>{ listeners.forEach(f=>f()); };
  bc.onmessage=notify;
  const write=(fn)=>{ const t=load(); fn(t); save(t); notify(); bc.postMessage(1); };
  function snap(v){ return { exists:()=>v!==undefined, val:()=>v===undefined?null:arrayify(JSON.parse(JSON.stringify(v))) }; }
  function ref(path){ return {
    child:(p)=>ref(path+'/'+p),
    on(ev, cb){ if (path==='.info/connected'){ setTimeout(()=>cb(snap(true)),0); return; } let last; const f=()=>{ const v=getAt(load(),path); const j=JSON.stringify(v); if (j!==last){ last=j; cb(snap(v)); } }; listeners.push(f); setTimeout(f,0); },
    set: async(v)=>write(t=>setAt(t,path,v)),
    update: async(o)=>write(t=>{ for (const k in o) setAt(t,path+'/'+k,o[k]); }),
    onDisconnect:()=>({ remove(){} }),
    transaction: async(fn)=>{ const cur=getAt(load(),path); const out=fn(cur===undefined?null:arrayify(JSON.parse(JSON.stringify(cur)))); if (out===undefined) return {committed:false}; write(t=>setAt(t,path,out)); return {committed:true}; }
  }; }
  window.firebase = { apps:[], initializeApp(){ this.apps.push(1); }, auth:()=>({ signInAnonymously: async()=>({ user:{ uid:'uid-'+u } }) }), database:()=>({ ref }) };
})();
