// Scope is the handwriting_preview URL prefix only, never the main app.
const CACHE='cs-hw-preview-2026-10-22b';
const FILES=['handwriting_preview.html','handwriting_preview.css?v=2026-10-22b','handwriting_preview.js?v=2026-10-22b','style.css?v=2026-10-22b','handwriting.js?v=2026-10-22b','study_mode.js?v=2026-10-22b','handwriting_recognition.js?v=2026-10-22b','handwriting_model/preprocess.js?v=2026-10-22b','handwriting_model/decision.js?v=2026-10-22b','handwriting_model/worker.js?v=2026-10-22b','handwriting_model/cnn.js','fonts/fonts.css',...['Fredoka-400-latin','Fredoka-400-latin-ext','Nunito-400-latin','Nunito-400-latin-ext','Nunito-700-latin','Nunito-700-latin-ext','Nunito-800-latin','Nunito-800-latin-ext'].map(name=>'fonts/'+name+'.woff2')];
const base=new URL('./',self.location.href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);await cache.addAll(FILES.map(file=>new URL(file,base).href));
  const manifestURL=new URL('handwriting_model/model.json?v=2026-10-22b',base).href;
  const response=await fetch(manifestURL);if(!response.ok)throw Error('No manifest');const m=await response.clone().json();
  await cache.put(manifestURL,response);await cache.add(new URL('handwriting_model/'+m.weightsFile+'?sha='+m.sha256,base).href);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);const cached=await cache.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return await cache.match(new URL('handwriting_preview.html',base).href)||fetch(event.request);
    return fetch(event.request);
  })());
});
