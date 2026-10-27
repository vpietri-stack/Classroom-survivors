(function (root) {
  'use strict';
  // Fixed preprocessing shared by benchmark export and browser inference.
  // It uses only the drawing, never its requested letter or teacher label.
  function prepare(card) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#000';ctx.fillRect(0,0,128,128);ctx.strokeStyle=ctx.fillStyle='#fff';
    ctx.lineWidth=card.pen||9;ctx.lineCap=ctx.lineJoin='round';
    let x0=128,y0=128,x1=-1,y1=-1;
    for(const stroke of card.strokes){if(stroke.length<2)continue;
      for(let i=0;i<stroke.length;i+=2){x0=Math.min(x0,stroke[i]);x1=Math.max(x1,stroke[i]);y0=Math.min(y0,stroke[i+1]);y1=Math.max(y1,stroke[i+1]);}
      if(stroke.length===2){ctx.beginPath();ctx.arc(stroke[0],stroke[1],ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
      else{ctx.beginPath();ctx.moveTo(stroke[0],stroke[1]);for(let i=2;i<stroke.length;i+=2)ctx.lineTo(stroke[i],stroke[i+1]);ctx.stroke();}
    }
    const raw=ctx.getImageData(0,0,128,128).data;
    let bx0=128,by0=128,bx1=-1,by1=-1,inkCount=0;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){const value=raw[(y*128+x)*4];if(value>90)inkCount++;if(value>16){bx0=Math.min(bx0,x);bx1=Math.max(bx1,x);by0=Math.min(by0,y);by1=Math.max(by1,y);}}
    const out=document.createElement('canvas');out.width=out.height=28;
    const dest=out.getContext('2d',{willReadFrequently:true});dest.fillStyle='#000';dest.fillRect(0,0,28,28);
    if(bx1>=bx0&&by1>=by0){const width=bx1-bx0+1,height=by1-by0+1,scale=20/Math.max(width,height);
      const dw=Math.max(1,Math.round(width*scale)),dh=Math.max(1,Math.round(height*scale));
      dest.imageSmoothingEnabled=true;dest.imageSmoothingQuality='high';
      dest.drawImage(canvas,bx0,by0,width,height,Math.floor((28-dw)/2),Math.floor((28-dh)/2),dw,dh);
    }
    const pixels=dest.getImageData(0,0,28,28).data,input=new Float32Array(784);
    for(let i=0;i<784;i++)input[i]=pixels[i*4]/255;
    return{input,rawInkCount:inkCount,minimal:Math.max(x1-x0,y1-y0)<=6,hasInk:bx1>=bx0};
  }
  function forTarget(card, target) {
    // The reviewed é examples establish a readable e body as acceptable for
    // this exercise. Keep the displayed/spelled target é. A detached accent,
    // when present, must not shrink the body in the 26-class image classifier.
    if (String(target).toLowerCase() !== 'é' || card.strokes.length < 2) return prepare(card);
    const body = card.strokes.reduce((a,b) => a.length >= b.length ? a : b);
    const ys = body.filter((_,i) => i%2), top = Math.min(...ys);
    const kept = card.strokes.filter(stroke => stroke === body || Math.max(...stroke.filter((_,i) => i%2)) >= top - 8);
    return prepare({strokes:kept,pen:card.pen});
  }
  function hasDot(card) {
    // Repeated stems are still one piece. Require a short upper stroke with
    // a real vertical gap above a taller body, in either writing order.
    const points=[];
    for(const stroke of card.strokes)for(let i=0;i<stroke.length;i+=2)points.push({x:stroke[i],y:stroke[i+1]});
    points.sort((a,b)=>a.y-b.y);
    for(let i=1;i<points.length;i++){
      if(points[i].y-points[i-1].y<5)continue;
      const upper=points.slice(0,i),lower=points.slice(i),bodyHeight=points[points.length-1].y-points[i].y;
      const dotHeight=points[i-1].y-points[0].y;
      if(bodyHeight<10||dotHeight>Math.max(12,bodyHeight*.65))continue;
      const ux0=Math.min(...upper.map(p=>p.x)),ux1=Math.max(...upper.map(p=>p.x));
      const lx0=Math.min(...lower.map(p=>p.x)),lx1=Math.max(...lower.map(p=>p.x));
      if(ux1>=lx0-12&&ux0<=lx1+12)return true;
    }
    return false;
  }
  root.HWNN={prepare,forTarget,hasDot};
})(typeof window==='undefined'?globalThis:window);
