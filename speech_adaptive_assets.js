// Public model assets only. This module never receives a recording or account ID.
export const ASSET_ID='speech-encouragement-20261029-a';
const CHUNK=262144,assetBase=new URL('./speech_assets/adaptive-20261029a/',import.meta.url),appBase=new URL('./',import.meta.url);
export async function sha256(buffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function verifiedCachedAsset(buffer,file){
 if(!buffer)return null;const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
 if(bytes.byteLength===file.bytes&&await sha256(bytes)===file.sha256)return bytes;
 // Some Windows development caches contain CRLF JSON. Verify its canonical
 // published bytes without mutating or replacing the original legacy entry.
 if(file.name.endsWith('.json')){const canonical=new TextEncoder().encode(new TextDecoder().decode(bytes).replace(/\r\n/g,'\n'));if(canonical.byteLength===file.bytes&&await sha256(canonical)===file.sha256)return canonical;}
 return null;
}
async function legacyFile(name){
 try{return await new Promise(resolve=>{const request=indexedDB.open('whisper-model-cache',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('files'))request.result.createObjectStore('files',{keyPath:'name'});};request.onerror=()=>resolve(null);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('files')){db.close();return resolve(null);}const tx=db.transaction('files','readonly'),get=tx.objectStore('files').get('whisper-tiny.en-model-v1/'+name);get.onsuccess=()=>resolve(get.result?.data||null);get.onerror=()=>resolve(null);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();resolve(null);};};});}catch(_){return null;}
}
export async function applyVerifiedBytePatch(base,patch,target,maximumBytes=48*1024*1024,maximumOps=4096){
 if(patch.schema!==1||base.byteLength!==patch.baseBytes||!Number.isInteger(patch.resultBytes)||patch.resultBytes<1||patch.resultBytes>maximumBytes||patch.resultBytes!==target.bytes||patch.resultSHA256!==target.sha256||!Array.isArray(patch.ops)||patch.ops.length>maximumOps||await sha256(base)!==patch.baseSHA256)throw Error('Cached speech file does not match this update');
 const original=new Uint8Array(base),out=new Uint8Array(patch.resultBytes);let offset=0;
 for(const op of patch.ops){let part;if(op.copy){const [start,length]=op.copy;if(!Number.isInteger(start)||!Number.isInteger(length)||start<0||length<0||start+length>original.length)throw Error('Invalid encoder update');part=original.subarray(start,start+length);}else{const text=atob(op.data);part=Uint8Array.from(text,c=>c.charCodeAt(0));}if(offset+part.length>out.length)throw Error('Invalid encoder update size');out.set(part,offset);offset+=part.length;}
 if(offset!==out.length||await sha256(out)!==patch.resultSHA256)throw Error('Encoder update did not verify');return out;
}
export async function applyEncoderPatch(base,patch){return applyVerifiedBytePatch(base,patch,{bytes:patch.resultBytes,sha256:patch.resultSHA256},16*1024*1024,64);}
export function adaptiveAssetSources(file, base = appBase) {
 if (file.urls) return file.urls;
 const local = new URL(file.url, base).href;
 const host = base.hostname;
 const onBanban = host === 'banban.quest';
 if (!onBanban && !host.endsWith('.github.io')) return [local];

 const owner = onBanban ? 'vpietri-stack' : host.slice(0, -'.github.io'.length);
 const repo = onBanban ? 'Classroom-survivors' : base.pathname.split('/').filter(Boolean)[0];
 if (!owner || !repo) return [local];

 const raw = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + (file.sourceRevision || 'main') + '/' + file.url;
 const mirror = 'https://gh-proxy.com/' + raw;
 // BanBan's Pages route can return ranges of a compressed representation.
 // Try the byte-verified mirror first for files that need multiple ranges.
 return onBanban && file.bytes > CHUNK ? [mirror, local, raw] : [local, mirror, raw];
}
export async function downloadVerifiedAsset(file, {
 cache, cacheBase = assetBase, chunkBytes = CHUNK, timeoutMs = 20000,
 fetcher = globalThis.fetch.bind(globalThis), routes = adaptiveAssetSources(file),
 onDownload = () => {}, onNetworkBytes = () => {}, onSegment = () => {}
} = {}) {
 const output = new Uint8Array(file.bytes);
 const count = Math.ceil(file.bytes / chunkBytes);
 const unhealthy = new Set();
 let next = 0;

 async function getSegment(start, end, expectedHash) {
  const length = end - start + 1;
  const cacheKey = new URL('__chunks__/' + file.sha256 + '/' + start, cacheBase).href;
  try {
   const cached = await cache?.match(cacheKey);
   if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    if (bytes.byteLength === length && await sha256(bytes) === expectedHash) return { bytes, reused: true };
    await cache.delete(cacheKey);
   }
  } catch (_) {}

  let error;
  const available = routes.filter(url => !unhealthy.has(url));
  for (const url of available.length ? available : routes) {
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), timeoutMs);
   try {
    const segmentUrl = new URL(url);
    segmentUrl.searchParams.set('part', start + '-' + end);
    onDownload();
    const response = await fetcher(segmentUrl.href, {
     headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal
    });
    const range = response.headers.get('Content-Range');
    if (!response.ok || (response.status !== 206 && length !== file.bytes)
      || (range && range !== `bytes ${start}-${end}/${file.bytes}`)) {
     await response.body?.cancel();
     throw Error('Invalid download range');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    onNetworkBytes(bytes.byteLength);
    if (bytes.byteLength !== length || await sha256(bytes) !== expectedHash) {
     throw Error('Download segment did not match ' + file.name);
    }
    try { await cache?.put(cacheKey, new Response(bytes.slice(0))); } catch (_) {}
    return { bytes, reused: false };
   } catch (failure) {
    error = failure;
    unhealthy.add(url);
   } finally {
    clearTimeout(timer);
   }
  }
  throw Error('Could not finish ' + file.name + '. Verified parts are saved for Retry. ' + String(error?.message || ''));
 }

 async function downloadSegments() {
  while (next < count) {
   const index = next++;
   const start = index * chunkBytes;
   const end = Math.min(file.bytes, start + chunkBytes) - 1;
   const expectedHash = file.chunks?.[index];
   if (!expectedHash) throw Error('Missing verified download segment for ' + file.name);
   const { bytes, reused } = await getSegment(start, end, expectedHash);
   output.set(bytes, start);
   onSegment(bytes.byteLength, reused);
  }
 }
 const completed = await Promise.allSettled(Array.from({ length: Math.min(4, count) }, downloadSegments));
 const failed = completed.find(result => result.status === 'rejected');
 if (failed) throw failed.reason;
 if (await sha256(output) !== file.sha256) throw Error(file.name + ' did not match its verified file list.');
 return output;
}

export async function prepareAdaptiveAssets(progress=()=>{},options={}){
 const fetcher=options.fetch||globalThis.fetch.bind(globalThis),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let manifest;
 try{const response=await fetcher(new URL('manifest.json?v=5',assetBase),{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error('Speech asset list unavailable');manifest=await response.json();}finally{clearTimeout(timer);}
 if(manifest.schema!==1||manifest.id!==ASSET_ID||manifest.transportVersion!==3)throw Error('Speech file list is out of date. Reload this preview page.');
 let cache;try{cache=await caches.open('speech-adaptive-assets-v1');}catch(_){}
 const buffers=new Map(),total=manifest.files.reduce((sum,f)=>sum+f.bytes,0);let done=0,networkBytes=0,reusedBytes=0;
 const notify=stage=>progress({stage,downloaded:done,total,networkBytes,reusedBytes,progress:Math.round(done/total*100)});
 function download(file, logicalBytes) {
  const stage = 'Downloading ' + file.name;
  return downloadVerifiedAsset(file, {
   cache, fetcher, routes: options.sources?.(file) || adaptiveAssetSources(file),
   onDownload: () => notify(stage),
   onNetworkBytes: bytes => { networkBytes += bytes; },
   onSegment: (bytes, reused) => {
    if (reused) reusedBytes += bytes;
    done += bytes * logicalBytes / file.bytes;
    notify(stage);
   }
  });
 }
 async function transfer(file,logicalBytes){
  if(file.packed&&typeof DecompressionStream==='function'){const previousDone=done;try{const compressed=await download(file.packed,logicalBytes),data=new Uint8Array(await new Response(new Response(compressed).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(data.byteLength!==file.bytes||await sha256(data)!==file.sha256)throw Error('Unpacked speech file did not verify');return data;}catch(_){done=previousDone;}}
  return download(file,logicalBytes);
 }
 async function helper(file){const key=new URL('__files__/'+file.sha256,assetBase).href;try{const saved=await cache?.match(key);if(saved){const data=await verifiedCachedAsset(await saved.arrayBuffer(),file);if(data)return data;}}catch(_){}const data=await transfer(file,0);try{await cache?.put(key,new Response(data.slice(0)));}catch(_){}return data;}
 const localOnly=options.preferLocal||['localhost','127.0.0.1'].includes(appBase.hostname)||appBase.protocol==='file:';
 for(const file of manifest.files){
  const key=new URL('__files__/'+file.sha256,assetBase).href;let data,legacy;
  try{const saved=await cache?.match(key);if(saved)data=await verifiedCachedAsset(await saved.arrayBuffer(),file);}catch(_){}
  if(!data)for(const candidate of file.httpCacheURLs||[]){const url=new URL(candidate,appBase);if(url.origin!==appBase.origin)continue;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);try{const response=await fetcher(url,{cache:'only-if-cached',mode:'same-origin',signal:controller.signal});if(response.ok)data=await verifiedCachedAsset(await response.arrayBuffer(),file);else await response.body?.cancel();}catch(_){}finally{clearTimeout(timer);}if(data)break;}
  if(!data&&file.legacyName){legacy=await (options.legacyFile||legacyFile)(file.legacyName);data=await verifiedCachedAsset(legacy,file);}
  if(data){done+=file.bytes;reusedBytes+=file.bytes;notify('Reusing saved speech files');}
  else{
   for(const variant of file.variants||[]){const saved=await verifiedCachedAsset(legacy,variant);if(saved){notify('Updating saved '+file.name);const patch=JSON.parse(new TextDecoder().decode(await helper(variant.patch)));data=await applyVerifiedBytePatch(saved,patch,file);done+=file.bytes;reusedBytes+=saved.byteLength;notify('Reusing saved speech model');break;}let savedParts=false;try{const prefix=new URL('__chunks__/'+variant.sha256+'/',assetBase).href;savedParts=(await cache?.keys()||[]).some(r=>r.url.startsWith(prefix));}catch(_){}if(!localOnly||options.allowVariantNetwork||savedParts){const previousDone=done;try{const source=await download(variant,file.bytes),patch=JSON.parse(new TextDecoder().decode(await helper(variant.patch)));data=await applyVerifiedBytePatch(source,patch,file);break;}catch(_){done=previousDone;}}}
   if(!data)data=await transfer(file,file.bytes);
  }
  buffers.set(file.name,data);try{await cache?.put(key,new Response(data.slice(0)));}catch(_){}
 }
 const parse=name=>JSON.parse(new TextDecoder().decode(buffers.get(name))),patch=parse('encoder.patch.json');
 buffers.set('whisper/onnx/encoder_model_quantized.onnx',await applyEncoderPatch(buffers.get('whisper/onnx/encoder_model_quantized.onnx'),patch));
 notify('Speech files ready. Preparing the model…');
 return {buffers,config:parse('config.json'),calibration:parse('sentence-calibration.json'),lexicon:parse('phonetic-lexicon.json'),networkBytes,reusedBytes,total,whisperBase:new URL('models/whisper-tiny.en/',appBase).href,vadBase:new URL('models/silero-vad-v5/',appBase).href};
}
