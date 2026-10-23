(function(root){
  'use strict';
  function load(manifest,buffer){
    if(buffer.byteLength!==manifest.weightBytes)throw Error('Model size mismatch');
    const weights={};for(const[name,meta]of Object.entries(manifest.tensors))weights[name]=new Float32Array(buffer,meta.byteOffset,meta.count);
    return{manifest,weights};
  }
  // Fused 3x3 convolution, ReLU and 2x2 max-pool. Tensor layout is CHW.
  function layer(input,channels,width,outChannels,weights,bias){
    const stride=width+2,padded=new Float32Array(channels*stride*stride),outWidth=Math.floor(width/2),output=new Float32Array(outChannels*outWidth*outWidth);
    for(let c=0;c<channels;c++)for(let y=0;y<width;y++)padded.set(input.subarray(c*width*width+y*width,c*width*width+(y+1)*width),c*stride*stride+(y+1)*stride+1);
    for(let oc=0;oc<outChannels;oc++)for(let y=0;y<outWidth;y++)for(let x=0;x<outWidth;x++){
      let best=0;
      for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
        let sum=bias[oc];
        for(let ic=0;ic<channels;ic++){
          const p=ic*stride*stride+(y*2+dy)*stride+x*2+dx,w=(oc*channels+ic)*9;
          sum+=padded[p]*weights[w]+padded[p+1]*weights[w+1]+padded[p+2]*weights[w+2]
            +padded[p+stride]*weights[w+3]+padded[p+stride+1]*weights[w+4]+padded[p+stride+2]*weights[w+5]
            +padded[p+2*stride]*weights[w+6]+padded[p+2*stride+1]*weights[w+7]+padded[p+2*stride+2]*weights[w+8];
        }
        if(sum>best)best=sum;
      }
      output[oc*outWidth*outWidth+y*outWidth+x]=best;
    }
    return output;
  }
  function dense(input,count,weights,bias,relu){
    const output=new Float32Array(count);
    for(let o=0;o<count;o++){let s=bias[o];const start=o*input.length;for(let i=0;i<input.length;i++)s+=input[i]*weights[start+i];output[o]=relu?Math.max(0,s):s;}
    return output;
  }
  function predict(model,input){
    if(input.length!==784)throw Error('Expected one 28 by 28 image');
    const w=model.weights;
    let x=layer(input,1,28,16,w['conv1.weight'],w['conv1.bias']);
    x=layer(x,16,14,32,w['conv2.weight'],w['conv2.bias']);
    x=layer(x,32,7,64,w['conv3.weight'],w['conv3.bias']);
    x=dense(x,96,w['fc1.weight'],w['fc1.bias'],true);
    const logits=dense(x,26,w['fc2.weight'],w['fc2.bias'],false),max=Math.max(...logits),probabilities=new Float32Array(26);
    let sum=0;for(let i=0;i<26;i++){probabilities[i]=Math.exp(logits[i]-max);sum+=probabilities[i];}
    for(let i=0;i<26;i++)probabilities[i]/=sum;
    return{logits,probabilities};
  }
  root.HWCNN={load,predict};
})(typeof window==='undefined'?globalThis:window);
