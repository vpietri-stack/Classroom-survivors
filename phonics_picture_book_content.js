// Story captions and the key vocabulary required for a young learner's attempt.
(function () {
 'use strict';
 const pages = [
  {
    "page": 1,
    "text": "The bear has a big bag.",
    "image": "page-01-master.webp",
    "narration": "page-01-recorded-v1.mp3",
    "meaning": "小熊有一个大包。",
    "requiredWords": [
      "bear",
      "bag"
    ]
  },
  {
    "page": 2,
    "text": "What is in the bag?",
    "image": "page-02-master.webp",
    "narration": "page-02-recorded-v1.mp3",
    "meaning": "包里有什么？",
    "requiredWords": [
      "bag"
    ]
  },
  {
    "page": 3,
    "text": "Look! An apple, and a banana!",
    "image": "page-03-master.webp",
    "narration": "page-03-recorded-v1.mp3",
    "meaning": "看！一个苹果，还有一根香蕉！",
    "requiredWords": [
      "apple",
      "banana"
    ]
  },
  {
    "page": 4,
    "text": "Look! A ball, and a cup!",
    "image": "page-04-master.webp",
    "narration": "page-04-recorded-v1.mp3",
    "meaning": "看！一个球，还有一个杯子！",
    "requiredWords": [
      "ball",
      "cup"
    ]
  },
  {
    "page": 5,
    "text": "Look! An axe, and a cactus!",
    "image": "page-05-master.webp",
    "narration": "page-05-recorded-v1.mp3",
    "meaning": "看！一把斧头，还有一棵仙人掌！",
    "requiredWords": [
      "axe",
      "cactus"
    ]
  },
  {
    "page": 6,
    "text": "Look! A cat, and a caterpillar!",
    "image": "page-06-master.webp",
    "narration": "page-06-recorded-v1.mp3",
    "meaning": "看！一只猫，还有一条毛毛虫！",
    "requiredWords": [
      "cat",
      "caterpillar"
    ]
  },
  {
    "page": 7,
    "text": "What?! An alligator on a bike!",
    "image": "page-07-master.webp",
    "narration": "page-07-recorded-v1.mp3",
    "meaning": "什么？！一只骑自行车的短吻鳄！",
    "requiredWords": [
      "alligator",
      "bike"
    ]
  },
  {
    "page": 8,
    "text": "What?! An astronaut with a camera!",
    "image": "page-08-master.webp",
    "narration": "page-08-recorded-v1.mp3",
    "meaning": "什么？！一位拿着相机的宇航员！",
    "requiredWords": [
      "astronaut",
      "camera"
    ]
  },
  {
    "page": 9,
    "text": "Where is the bear?",
    "image": "page-09-master.webp",
    "narration": "page-09-recorded-v1.mp3",
    "meaning": "小熊在哪里？",
    "requiredWords": [
      "bear"
    ]
  },
  {
    "page": 10,
    "text": "Look! The bear is in the bag!",
    "image": "page-10-master.webp",
    "narration": "page-10-recorded-v1.mp3",
    "meaning": "看！小熊在包里！",
    "requiredWords": [
      "bear",
      "bag"
    ]
  }
];
 const tokens = text => (String(text || '').toLowerCase().match(/[a-z]+/g) || []);
 function distance(a,b) {
   let row=Array.from({length:b.length+1},(_,i)=>i);
   for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next}return row[b.length];
 }
 // The recogniser also transcribes the teacher's "ball" as "bowl". Accept
 // that ambiguity only when this picture book is checking the target "ball".
 const aliases={ball:['bowl','bowls'],bear:['bare','bair','bea'],axe:['ax'],bike:['byke'],cup:['kup'],cat:['kat'],banana:['nana','bananna'],astronaut:['astro'],caterpillar:['caterpilla']};
 function matches(word,heard) {
   if(heard===word||heard===word+'s'||aliases[word]?.includes(heard))return true;
   // Long nouns tolerate young children's imperfect endings; short nouns keep
   // their identity (e.g. "big" must not satisfy "bag").
   return word.length>=4 && heard.length>=3 && word.slice(0,2)===heard.slice(0,2)
     && distance(word,heard)<=Math.max(1,Math.floor(word.length*.4));
 }
 function assess(text,page,meta={}) {
   const heard=tokens(text), expected=tokens(page.text);
   const usable=meta.phonicsAudioDetected!==false && meta.targetStatus!=='unavailable'
     && heard.length>0 && !heard.every(w=>w===heard[0]&&w.length===1);
   const found=new Set(page.requiredWords.filter(w=>usable&&heard.some(h=>matches(w,h))));
   return expected.map(word=>({text:word,heardClear:page.requiredWords.includes(word)?found.has(word):usable&&heard.includes(word),basis:'picture-book-key-vocabulary'}));
 }
 window.PhonicsPictureBookContent={id:'phonics1-u1-picture-book-p4',base:'media/phonics/p1-u1-picture-book/',pages,assess};
})();
