// A cylindrical paper curl, drawn from the page's own artwork and live caption.
// No screenshot service or image assets are needed for the animation.
(() => {
  const motions=[
    {duration:1740,radius:.098,lean:.08,lift:5.4,bow:.004,weight:.94,hold:.018},
    {duration:1880,radius:.112,lean:.12,lift:4.8,bow:-.005,weight:1.04,hold:-.024},
    {duration:2010,radius:.119,lean:.09,lift:5.8,bow:.006,weight:1.09,hold:.028},
    {duration:1810,radius:.104,lean:.13,lift:5.1,bow:-.003,weight:.98,hold:-.016}
  ];
  let motionBag=[],lastMotion=-1;
  function chooseMotion(){
    if(!motionBag.length){
      motionBag=motions.map((_,i)=>i);
      for(let i=motionBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[motionBag[i],motionBag[j]]=[motionBag[j],motionBag[i]]}
      if(motionBag.at(-1)===lastMotion)[motionBag[0],motionBag[motionBag.length-1]]=[motionBag.at(-1),motionBag[0]];
    }
    lastMotion=motionBag.pop();
    return {...motions[lastMotion],duration:Math.round(motions[lastMotion].duration*(.98+Math.random()*.04))};
  }
  async function capture(sheet,override){
    const image=sheet.querySelector('img'),caption=sheet.querySelector('figcaption');
    await document.fonts.ready;
    let art=image;
    if(override){art=new Image();art.src=override.src;await art.decode()}
    const rect=sheet.getBoundingClientRect(),ir=image.getBoundingClientRect(),cr=caption.getBoundingClientRect(),style=getComputedStyle(caption);
    const ratio=Math.min(devicePixelRatio||1,2),canvas=document.createElement('canvas');canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
    const c=canvas.getContext('2d');c.scale(ratio,ratio);c.fillStyle='#fff8e9';c.fillRect(0,0,rect.width,rect.height);
    c.fillStyle='#fff5e3';c.fillRect(0,ir.top-rect.top,rect.width,ir.height);
    const scale=Math.min(ir.width/art.naturalWidth,ir.height/art.naturalHeight),w=art.naturalWidth*scale,h=art.naturalHeight*scale;
    c.drawImage(art,(rect.width-w)/2,ir.top-rect.top+(ir.height-h)/2,w,h);
    const size=parseFloat(style.fontSize),lineHeight=parseFloat(style.lineHeight),padding=parseFloat(style.paddingLeft),available=cr.width-padding*2;
    c.font=`${style.fontWeight} ${size}px ${style.fontFamily}`;c.textAlign='center';c.textBaseline='alphabetic';c.fillStyle=style.color;
    let line='',y=cr.top-rect.top+parseFloat(style.paddingTop)+size*.85;
    for(const word of (override?.text||caption.textContent).split(/\s+/)){
      const next=line?line+' '+word:word;
      if(line&&c.measureText(next).width>available){c.fillText(line,rect.width/2,y);line=word;y+=lineHeight}else line=next;
    }
    if(line)c.fillText(line,rect.width/2,y);
    return {canvas,ratio,width:rect.width,height:rect.height};
  }
  function animate(book,page,backward,motion=chooseMotion()){
    const canvas=document.createElement('canvas');canvas.className='paper-curl';canvas.setAttribute('aria-hidden','true');canvas.width=page.canvas.width;canvas.height=page.canvas.height;book.append(canvas);
    const c=canvas.getContext('2d'),W=page.width,H=page.height,steps=128,sw=W/steps;
    c.scale(page.ratio,page.ratio);
    function paint(progress){
      const p=backward?1-progress:progress,R=W*motion.radius*(1+.07*Math.sin(p*Math.PI)),s=W-(W+Math.PI*R/2)*p;
      c.clearRect(0,0,W,H);
      const gradient=c.createLinearGradient(s-10,0,s+R*2,0);gradient.addColorStop(0,'#4c341800');gradient.addColorStop(.28,'#4c34183d');gradient.addColorStop(1,'#4c341800');c.fillStyle=gradient;c.fillRect(Math.max(0,s-10),0,R*2+10,H);
      if(s>0)c.drawImage(page.canvas,0,0,Math.min(W,s)*page.ratio,H*page.ratio,0,0,Math.min(W,s),H);
      const strips=[];
      const point=u=>{const theta=Math.max(0,(u-s)/R);let x,z;if(theta<=Math.PI){x=s+R*Math.sin(theta);z=R*(1-Math.cos(theta))}else{x=s-(u-s-Math.PI*R);z=2*R}const scale=1+z/(W*motion.lift),bow=H*motion.bow*Math.sin(Math.min(theta,Math.PI))*Math.sin(p*Math.PI);return {x:x+z*motion.lean,z,top:(H-H*scale)/2+bow,height:H*scale,back:theta>Math.PI/2,theta}};
      for(let u=Math.max(0,s);u<W;u+=sw){const end=Math.min(u+sw,W),a=point(u),b=point(end);strips.push({u,end,a,b,z:(a.z+b.z)/2})}
      strips.sort((a,b)=>a.z-b.z);
      for(const {u,end,a,b} of strips){
        const left=Math.min(a.x,b.x),width=Math.abs(b.x-a.x)+.75,top=(a.top+b.top)/2,height=(a.height+b.height)/2;
        if(width<.1||left>W||left+width<0)continue;
        if(a.back){const shade=Math.round(248-26*Math.sin(Math.min(a.theta,Math.PI)));c.fillStyle=`rgb(${shade},${shade-9},${shade-27})`;c.fillRect(left,top,width,height)}
        else{c.drawImage(page.canvas,u*page.ratio,0,(end-u)*page.ratio,H*page.ratio,left,top,width,height);c.fillStyle=`rgba(60,38,10,${.16*Math.sin(Math.min(a.theta,Math.PI))})`;c.fillRect(left,top,width,height)}
      }
    }
    return new Promise(resolve=>{let began;function frame(now){began??=now;const raw=Math.min(1,(now-began)/motion.duration),t=Math.pow(raw,motion.weight),eased=t*t*(3-2*t)+motion.hold*Math.sin(2*Math.PI*t)*Math.sin(Math.PI*t)**2;paint(Math.max(0,Math.min(1,eased)));if(raw<1)requestAnimationFrame(frame);else{canvas.remove();resolve()}}requestAnimationFrame(frame)});
  }
  window.PictureBookTurn={capture,animate,chooseMotion};
})();
