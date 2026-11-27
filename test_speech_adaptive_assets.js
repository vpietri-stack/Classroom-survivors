const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{pathToFileURL}=require('url');
(async()=>{const base='speech_assets/adaptive-20261029a/',manifest=JSON.parse(fs.readFileSync(base+'manifest.json')),dictionary=manifest.files.find(f=>f.name==='phonetic-lexicon.json'),source=fs.readFileSync('speech_adaptive_assets.js','utf8').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(path.resolve('speech_adaptive_assets.js')).href)),assets=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const banban = new URL('https://banban.quest/');
const model = manifest.files.find(file => file.name === 'whisper/onnx/decoder_model_merged_quantized.onnx');
const raw = 'https://raw.githubusercontent.com/vpietri-stack/Classroom-survivors/' + model.sourceRevision + '/' + model.url;
assert.deepEqual(assets.adaptiveAssetSources(model, banban), [
  'https://gh-proxy.com/' + raw, new URL(model.url, banban).href, raw
], 'custom-domain model downloads use the pinned repository and retain both fallbacks');
const small = manifest.files[0];
assert.equal(assets.adaptiveAssetSources(small, banban)[0], new URL(small.url, banban).href);
const preview = new URL('https://vpietri-stack.github.io/Classroom-survivors-preview/');
assert.equal(assets.adaptiveAssetSources(model, preview)[0], new URL(model.url, preview).href);
assert.match(assets.adaptiveAssetSources(model, preview)[1], /githubusercontent\.com\/vpietri-stack\/Classroom-survivors-preview\//);
const local = new URL('https://localhost:8443/Classroom-survivors/');
assert.deepEqual(assets.adaptiveAssetSources(model, local), [new URL(model.url, local).href]);
assert.deepEqual(assets.adaptiveAssetSources(model.variants[0], banban), model.variants[0].urls);

const zipaManifest = JSON.parse(fs.readFileSync('speech_option1/zipa/manifest.json'));
assert.equal(zipaManifest.chunkBytes, 1024 * 1024);
const zipaPart = zipaManifest.parts[0];
const checksum = value => crypto.createHash('sha256').update(value).digest('hex');
const zipaBytes = fs.readFileSync(path.join('speech_option1/zipa', zipaPart.name));
assert.equal(zipaBytes.length, zipaPart.bytes);
assert.equal(checksum(zipaBytes), zipaPart.sha256);
assert.deepEqual(zipaPart.chunks, Array.from({ length: Math.ceil(zipaPart.bytes / zipaManifest.chunkBytes) },
  (_, index) => checksum(zipaBytes.subarray(index * zipaManifest.chunkBytes, (index + 1) * zipaManifest.chunkBytes))));

const fixture = Buffer.from('chunk-onechunk-twochunk-end');
const chunkBytes = 9;
const fixtureFile = {
  name: 'model.w8.fixture.bin', bytes: fixture.length, sha256: checksum(fixture),
  chunks: Array.from({ length: 3 }, (_, index) => checksum(fixture.subarray(index * chunkBytes, (index + 1) * chunkBytes)))
};
const segments = new Map();
const cache = {
  match: key => segments.get(key)?.clone(),
  delete: key => segments.delete(key),
  put: (key, response) => segments.set(key, response)
};
const routes = ['https://broken.test/part.bin', 'https://verified.test/part.bin'];
let interrupted = true;
const requested = [];
const fetcher = async (url, options) => {
  const [, first, last] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
  const start = Number(first), end = Number(last);
  const host = new URL(url).hostname;
  requested.push({ host, start });
  if (start === chunkBytes && interrupted) throw Error('connection dropped');
  const bytes = host === 'broken.test' ? new Uint8Array(end - start + 1) : fixture.subarray(start, end + 1);
  return new Response(bytes, { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${fixture.length}` } });
};
const transportOptions = { cache, cacheBase: banban, chunkBytes, fetcher, routes };
await assert.rejects(assets.downloadVerifiedAsset(fixtureFile, transportOptions), /Verified parts are saved/);
assert.equal(segments.size, 2, 'only verified segments survive an interrupted download');
interrupted = false;
requested.length = 0;
const resumed = await assets.downloadVerifiedAsset(fixtureFile, transportOptions);
assert.deepEqual(Buffer.from(resumed), fixture);
assert(requested.length > 0 && requested.every(({ start }) => start === chunkBytes),
  'a retry downloads only the interrupted segment');

const packed=fs.readFileSync(dictionary.packed.url);assert.equal(packed.length,dictionary.packed.bytes);assert.equal(crypto.createHash('sha256').update(packed).digest('hex'),dictionary.packed.sha256);assert.deepEqual(require('zlib').gunzipSync(packed),fs.readFileSync(dictionary.url));assert(packed.length<dictionary.bytes*.4);
const originalCaches=globalThis.caches,originalDecompress=globalThis.DecompressionStream;async function run(mode){const store=new Map(manifest.files.filter(f=>f!==dictionary).map(f=>[f.sha256,fs.readFileSync(f.url)])),key=url=>String(url).match(/__files__\/([a-f0-9]+)/)?.[1]||String(url);const cache={match:async u=>store.has(key(u))?new Response(store.get(key(u))):undefined,put:async(u,r)=>store.set(key(u),new Uint8Array(await r.arrayBuffer())),keys:async()=>[...store.keys()].map(url=>({url})),delete:async u=>store.delete(key(u))};globalThis.caches={open:async()=>cache};globalThis.DecompressionStream=mode==='legacy'?undefined:originalDecompress;const requests=[];const fetcher=async(input,init={})=>{const url=String(input);if(url.includes('manifest.json?'))return new Response(JSON.stringify(manifest));requests.push(url);const file=url.includes('gzip.bin')?dictionary.packed:dictionary;if(mode==='broken'&&file===dictionary.packed)return new Response('Unavailable',{status:503});const bytes=fs.readFileSync(file.url),m=init.headers.Range.match(/bytes=(\d+)-(\d+)/),start=+m[1],end=+m[2];return new Response(bytes.subarray(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}});};const result=await assets.prepareAdaptiveAssets(()=>{},{fetch:fetcher,sources:f=>['https://public-assets.test/'+f.url]});assert(result.lexicon.words.ball);assert.equal(result.config.id,'speech-encouragement-20261029-a');assert(result.buffers.has('whisper/onnx/encoder_model_quantized.onnx'));result.buffers.clear();return {networkBytes:result.networkBytes,requests,lexicon:result.lexicon};}
try{const compressed=await run('modern'),legacy=await run('legacy'),fallback=await run('broken');assert.equal(compressed.networkBytes,dictionary.packed.bytes);assert(compressed.requests.every(u=>u.includes('gzip.bin')));assert.equal(legacy.networkBytes,dictionary.bytes);assert(legacy.requests.every(u=>!u.includes('gzip.bin')));assert.equal(fallback.networkBytes,dictionary.bytes);assert(fallback.requests.some(u=>u.includes('gzip.bin'))&&fallback.requests.some(u=>u.includes('phonetic-lexicon.json')));assert.deepEqual(compressed.lexicon,legacy.lexicon);assert.deepEqual(fallback.lexicon,legacy.lexicon);console.log('Adaptive asset transport: exact compressed data, older-browser fallback, failed-route recovery and identical decoded dictionary passed.');}finally{globalThis.caches=originalCaches;globalThis.DecompressionStream=originalDecompress;}})().catch(e=>{console.error(e);process.exitCode=1});
