// Picture books share the native Study shell, recovery and credit pipeline.
(function () {
 'use strict';
 const content=window.PhonicsPictureBookContent;
 const audio=new Audio();
 let gate=null,generation=0,paper=null,lastPaper=-1,advanceInFlight=false;
 const state=()=>STUDY_STATE.pictureBook;
 const isSelected=()=>typeof selectedClassContent!=='undefined' && selectedClassContent?.book==='Phonics1'
   && String(selectedClassContent.unit)==='1' && String(selectedClassContent.page)==='4';
 const isStory=placement=>placement?.book==='Phonics1' && String(placement.unit)==='1' && String(placement.page)==='4';
 const isNext=placement=>placement?.book==='Phonics1' && String(placement.unit)==='2' && String(placement.page)==='5';
 function prepare(options={}) {
   if(!isSelected() || !authActiveUser || isTestMode || ['teacher','BM','admin'].includes(authActiveUser.role))return null;
   if(!isStory(authActiveUser))return null;
   if(!options.previewNoteId && window.PhonicsStudy?.requirePreview())return null;
   const note=PreviewNotesState.find(content.id);
   if(options.previewNoteId && options.previewNoteId!==note.id)return null;
   return {words:['bear','bag','apple','banana'],exercises:null,
     context:{id:note.id,owner:authActiveUser.id,book:note.book,unit:note.unit,page:note.page,version:note.version},
     state:{schema:1,index:0,speech:null,microphoneUnavailable:false,completed:false}};
 }
 function capture(){if(state()&&gate?.isConnected)state().speech=gate.studyResumeState();}
 function save(){capture();window.StudyRecovery?.capture();}
 function cancel(){generation++;audio.pause();audio.onended=null;audio.onerror=null;if(paper)paper.pause();gate?.querySelector('.speech-rec-btn')?.disposeSpeech?.();gate=null;}
 function element(tag,cls,text){const el=document.createElement(tag);el.className=cls||'';if(text)el.textContent=text;return el;}
 async function render(previous=null) {
   cancel();const ticket=generation,s=state();if(!s||s.completed)return;
   STUDY_STATE.round='A';currentTTSWord=content.pages[s.index].text;
   updateStudyUI('The Big Bag · '+(s.index+1)+' / '+content.pages.length,'先听故事，再读一读。');
   const page=content.pages[s.index],area=document.getElementById('study-game-area');area.replaceChildren();
   const wrap=element('div','picture-book-study text-center w-full');
   const speaker=element('button','game-btn bg-blue-600 rounded-full','🔊');speaker.type='button';speaker.setAttribute('aria-label','再听这一页');
   const book=element('div','story-book'),sheet=element('figure','story-sheet');
   const image=element('img');image.src=content.base+page.image;image.alt=page.text;image.width=1536;image.height=1024;
   const caption=element('figcaption','',page.text);sheet.append(image,caption);book.append(sheet);
   const meaning=element('p','story-meaning',page.meaning),slot=element('div','story-speech');
   const status=element('p','story-listening','先听老师读，听完就可以录音。');
   wrap.append(speaker,book,meaning,status,slot);area.append(wrap);
   let ready=false;
   function listeningOnly(){
     if(ticket!==generation)return;slot.replaceChildren();status.textContent='已经听完这一页。可以继续，也可以再听。';
     const button=element('button','game-btn bg-emerald-600','继续 ▶');button.onclick=()=>next();slot.append(button);
   }
   function unlock(){
     if(ticket!==generation)return;
     slot.hidden=false;
     status.textContent='听完啦！试着读一读。';ready=true;
     if(s.microphoneUnavailable || !window.Recorder?.isSupported()){s.microphoneUnavailable=true;listeningOnly();save();return;}
     if(gate)return;
     const tiles=(page.text.match(/[a-z]+/gi)||[]).map(word=>{const tile=element('span','study-word-tile',word);tile.dataset.word=word.toLowerCase();return tile;});
     const row=element('div','story-word-tiles');row.append(...tiles);slot.append(row);
     gate=SpeechUI.makeSentenceGate({target:page.text,wordTiles:tiles,book:'Phonics1',level:1,mode:'study',
       requireAllHeard:true,requiredWords:page.requiredWords,resumeState:s.speech,
       resolveTargetWords:(text,meta)=>content.assess(text,page,meta),
       onStateChange:phase=>{if(phase==='recording')audio.pause();save();},
       onAssessment:(_text,meta)=>{if(ticket!==generation)return;if(page.requiredWords.every(word=>meta.targetWords.some(item=>item.text===word&&item.heardClear)))playHappySound();save();},
       onTechnicalError:(_error,permission)=>{if(ticket!==generation)return;if(permission||!window.Recorder?.isSupported())s.microphoneUnavailable=true;save();},
       onDone:()=>{if(ticket===generation)next();}});
     slot.append(gate);save();
   }
   function play(){
     if(ticket!==generation)return;
     if(gate?.querySelector('.speech-rec-btn')?.dataset.speechState==='recording')return;
     slot.hidden=true;ready=false;audio.pause();audio.src=content.base+page.narration;
     status.textContent='正在听故事…';audio.onended=unlock;
     // A missing teacher clip must be retried, rather than silently counting as listening.
     audio.onerror=()=>{if(ticket===generation){status.textContent='录音暂时没能播放，请点喇叭再试一次。';slot.hidden=true;}};
     audio.play().catch(()=>{if(ticket===generation)status.textContent='点喇叭，听这一页。';});
   }
   async function next(){
     if(ticket!==generation||!ready)return;ready=false;capture();
     if(s.index===content.pages.length-1){s.completed=true;save();cancel();finishStudySession();return;}
     let snapshot=null;try{snapshot=await window.PictureBookTurn?.capture(sheet);}catch(_){}
     if(ticket!==generation)return;
     s.index++;s.speech=null;gate?.querySelector('.speech-rec-btn')?.disposeSpeech?.();gate=null;save();startExerciseTracking();render(snapshot);
   }
   speaker.onclick=play;image.onclick=caption.onclick=play;
   if(previous && window.PictureBookTurn && !matchMedia('(prefers-reduced-motion: reduce)').matches){
     const motion=PictureBookTurn.chooseMotion();let choice=Math.floor(Math.random()*(lastPaper<0?5:4));if(lastPaper>=0&&choice>=lastPaper)choice++;lastPaper=choice;
     paper=new Audio(content.base+'paper-turn-soft-'+(choice+1)+'.mp3');paper.volume=.45;paper.playbackRate=1800/motion.duration;paper.play().catch(()=>{});
     try{await image.decode();if(ticket!==generation)return;await PictureBookTurn.animate(book,previous,false,motion);}catch(_){}
     paper?.pause();
   }
   if(ticket===generation)play();
 }
 function restore(){if(state()?.completed)finishStudySession();else render();return true;}
 // Persist a scoped, conditional intent before the profile write. Reapply only
 // from this exact source/destination, never over a teacher's newer assignment.
 const pendingKey=student=>'csPictureBookAdvance:'+location.origin+location.pathname+':'+student.id;
 function retryAdvance(){
   if(advanceInFlight)return;
   const student=typeof authActiveUser!=='undefined'&&authActiveUser;if(!student)return;
   const key=pendingKey(student);let pending;try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
   if(!pending||pending.owner!==student.id||pending.note!==content.id)return;
   if(!isStory(student)&&!isNext(student)){try{localStorage.removeItem(key);}catch(_){}return;}
   Object.assign(student,{book:'Phonics1',unit:'2',page:'5'});saveActiveUserToCache();
   advanceInFlight=true;
   apiFetch(API_BASE+'/updateStudent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:student.id,fields:{book:'Phonics1',unit:'2',page:'5'},pictureBookAdvance:{id:content.id,from:{book:'Phonics1',unit:'1',page:'4'}}})})
     .then(async response=>{
       if(response?.ok){try{if(localStorage.getItem(key)===JSON.stringify(pending))localStorage.removeItem(key);}catch(_){}return;}
       if(response?.status===409){const result=await response.json().catch(()=>null);
         if(result?.reason==='assignment_changed'){
           try{localStorage.removeItem(key);}catch(_){}
           if(authActiveUser?.id===student.id&&isNext(authActiveUser)){
             Object.assign(authActiveUser,{book:result.student.book,unit:result.student.unit,page:result.student.page});saveActiveUserToCache();
           }
         }
       }
     }).catch(()=>{}).finally(()=>{advanceInFlight=false;});
 }
 function advance(){
   if(!state()?.completed||STUDY_STATE.previewNote?.owner!==authActiveUser?.id||!isStory(authActiveUser))return;
   const pending={owner:authActiveUser.id,note:content.id};try{localStorage.setItem(pendingKey(authActiveUser),JSON.stringify(pending));}catch(_){}
   // Saving locally is normally available; the direct write still works if storage is blocked.
   retryAdvance();
   if(isStory(authActiveUser)){
     Object.assign(authActiveUser,{book:'Phonics1',unit:'2',page:'5'});saveActiveUserToCache();
     apiFetch(API_BASE+'/updateStudent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:authActiveUser.id,fields:{book:'Phonics1',unit:'2',page:'5'},pictureBookAdvance:{id:content.id,from:{book:'Phonics1',unit:'1',page:'4'}}})}).catch(()=>{});
   }
 }
 window.PhonicsPictureBookStudy={prepare,isSelected,render,capture,cancel,restore,advance,retryAdvance};
})();
