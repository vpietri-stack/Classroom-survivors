(function(root){
  'use strict';
  const base=new URL('handwriting_model/',document.currentScript.src);
  let worker=null,manifest=null,loading=null,ready=false,serial=0,workerURL=null;
  let phase='idle',lastFailure=null;
  const pending=new Map();
  const CACHE='cs-handwriting-model-v2';
  function stop(){ready=false;if(worker)worker.terminate();worker=null;if(workerURL){URL.revokeObjectURL(workerURL);workerURL=null;}for(const item of pending.values()){clearTimeout(item.timer);item.resolve(null);}pending.clear();}
  async function checked(buffer,expected){
    const digest=await crypto.subtle.digest('SHA-256',buffer);
    return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')===expected;
  }
  async function fetchBounded(url,timeoutMs=8000){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{const r=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw Error('Unavailable');return await r.arrayBuffer();}finally{clearTimeout(timer);}
  }
  function load(){
    if(loading)return loading;
    if(!/^https?:$/.test(location.protocol)||typeof Worker==='undefined'||!root.crypto||!crypto.subtle)return Promise.resolve(false);
    loading=(async()=>{
      phase='manifest';lastFailure=null;
      let cache=null;try{cache=await caches.open(CACHE);}catch(e){}
      const manifestURL=new URL('model.json?v=2026-10-23b',base).href;
      let raw;
      try{raw=await fetchBounded(manifestURL);}catch(e){const cached=cache&&await cache.match(manifestURL);if(!cached)throw e;raw=await cached.arrayBuffer();}
      manifest=JSON.parse(new TextDecoder().decode(raw));
      if(!manifest.sha256||manifest.weightBytes!==324840||manifest.weightsFile!=='letters-v2.bin'||!manifest.calibration)throw Error('Invalid model');
      const weightsURL=new URL(manifest.weightsFile+'?sha='+manifest.sha256,base).href;
      phase='weights';
      let weights=null,cached=cache&&await cache.match(weightsURL);
      if(cached){const bytes=await cached.arrayBuffer();if(bytes.byteLength===manifest.weightBytes&&await checked(bytes,manifest.sha256))weights=bytes;else if(cache)await cache.delete(weightsURL);}
      if(!weights){
        for(let attempt=0;attempt<2&&!weights;attempt++){
          try{weights=await fetchBounded(weightsURL,60000);}catch(e){if(attempt===1)throw e;}
        }
        if(weights.byteLength!==manifest.weightBytes||!await checked(weights,manifest.sha256))throw Error('Invalid weights');
      }
      if(cache){try{await cache.put(weightsURL,new Response(weights));await cache.put(manifestURL,new Response(raw));}catch(e){}}
      // A worker outside the preview-page SW scope cannot fetch its imports
      // offline. Bundle the two self-hosted sources into one local worker.
      async function source(file){
        const url=new URL(file,base).href;let bytes;
        try{bytes=await fetchBounded(url);if(cache)try{await cache.put(url,new Response(bytes));}catch(e){}}
        catch(e){const cached=cache&&await cache.match(url);if(!cached)throw e;bytes=await cached.arrayBuffer();}
        return new TextDecoder().decode(bytes);
      }
      phase='runtime';
      const kernel=await source('cnn.js'),handler=await source('worker.js?v=2026-10-23b');
      workerURL=URL.createObjectURL(new Blob([kernel,'\n',handler.replace(/^importScripts\([^\n]+\);\s*/, '')],{type:'text/javascript'}));
      await new Promise((resolve,reject)=>{
        phase='worker';
        const timer=setTimeout(()=>reject(Error('Worker timeout')),4000);
        worker=new Worker(workerURL);
        worker.onerror=event=>{event.preventDefault();clearTimeout(timer);stop();reject(Error('Worker failed'));};
        worker.onmessage=event=>{
          const message=event.data;
          if(message.type==='ready'){clearTimeout(timer);URL.revokeObjectURL(workerURL);workerURL=null;ready=true;phase='ready';resolve();return;}
          const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);
          item.resolve(message.type==='prediction'?message.probabilities:null);
        };
        worker.postMessage({type:'load',manifest,weights},[weights]);
      });
      return true;
    })().catch(error=>{lastFailure={phase,message:error.message};stop();phase='failed';loading=null;return false;});
    return loading;
  }
  async function verify(card,target,baselineAccepted){
    if(!ready)return null;
    const info=HWNN.forTarget(card,target);info.strokeCount=card.strokes.length;info.hasDot=HWNN.hasDot(card);info.baselineAccepted=baselineAccepted;
    if(info.minimal||info.rawInkCount<200)return {accepted:false,reason:'insufficient-ink',model:manifest.id};
    const input=info.input,id=++serial;
    const probabilities=await new Promise(resolve=>{
      const timer=setTimeout(()=>{pending.delete(id);resolve(null);},1200);
      pending.set(id,{resolve,timer});worker.postMessage({type:'predict',id,input:input.buffer},[input.buffer]);
    });
    return probabilities?Object.assign(HWDecision.decide(probabilities,target,info,manifest.calibration),{model:manifest.id}):null;
  }
  root.HWRecognition={load,verify,isReady:()=>ready,status:()=>({ready,phase,lastFailure})};
})(window);
