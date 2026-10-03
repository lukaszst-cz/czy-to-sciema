import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// A real stoppable origin tests offline behavior without WebKit's broken
// setOffline emulation: https://github.com/microsoft/playwright/issues/42775
export async function testOrigin() {
  const root=path.resolve('dist');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.gz':'application/octet-stream'};
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+path.sep)||req.method!=='GET'){res.writeHead(403);res.end();return;}
      const data=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let closed=false;
  return {url:`http://127.0.0.1:${server.address().port}/`,close:async()=>{
    if(closed)return;closed=true;
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  }};
}
