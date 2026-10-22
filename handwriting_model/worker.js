importScripts('cnn.js');
let model=null;
self.onmessage=event=>{
  const m=event.data;
  try {
    if(m.type==='load'){
      model=HWCNN.load(m.manifest,m.weights);
      HWCNN.predict(model,new Float32Array(784));
      self.postMessage({type:'ready'});
    }else if(m.type==='predict'){
      if(!model)throw Error('Not ready');
      const input=new Float32Array(m.input);
      if(input.length!==784||!input.every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw Error('Invalid input');
      self.postMessage({type:'prediction',id:m.id,probabilities:Array.from(HWCNN.predict(model,input).probabilities)});
    }
  }catch(e){self.postMessage({type:'error',id:m.id});}
};
