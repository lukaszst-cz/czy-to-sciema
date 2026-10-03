const CACHE='czytosciema-__CACHE_VERSION__';
const ASSETS=/*__ASSETS__*/[];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  // Cache only packaged public assets. Never messages, uploads or foreign URLs.
  for(const url of ASSETS) await cache.add(new Request(url,{cache:'reload'}));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys()) if(name.startsWith('czytosciema-')&&name!==CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);const scope=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||url.search)return;
  const relative='./'+url.pathname.slice(scope.pathname.length);
  if(event.request.mode==='navigate'){
    if(relative!=='./'&&relative!=='./index.html')return;
    event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./index.html',self.registration.scope))));return;
  }
  if(!ASSETS.includes(relative))return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
