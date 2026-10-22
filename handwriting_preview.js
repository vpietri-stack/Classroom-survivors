// A public, account-free preview of the real Round C widget. No collector,
// authentication or analytics sender is loaded on this page.
var currentTTSWord='',selectedClassContent=null;
var previewEvents=[],previewStart=0;
function playTTS(){if(!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(currentTTSWord);u.lang='en-US';speechSynthesis.speak(u);}
function showTranslation(){}
function showVocabImage(){}
function startExerciseTracking(){}
function incrementExerciseAttempts(){}
function synthGem(){}
function synthError(){}
function initAudio(){}
function queueExerciseEvent(type,mode,word){previewEvents.push({type,word});}
function previewBegin(){
  document.querySelector('header').classList.add('started');
  if(roundDTrace){roundDTrace.destroy();roundDTrace=null;}
  clearTimeout(roundDTimer);previewEvents=[];previewStart=performance.now();
  document.getElementById('preview-summary').hidden=true;
  document.getElementById('studyModeOverlay').hidden=false;
  STUDY_STATE.words=['cat','tip','dog','café'];STUDY_STATE.active=true;STUDY_STATE.isTransitioning=false;
  startRoundD();
}
// Finish after the handwriting round instead of entering the rest of Study.
startRoundE=function(){
  STUDY_STATE.active=false;STUDY_STATE.round='done';
  document.getElementById('studyModeOverlay').hidden=true;
  document.getElementById('preview-summary').hidden=false;
  const independent=previewEvents.filter(e=>e.type==='handwriting').length;
  const assisted=previewEvents.filter(e=>e.type==='handwritingAssisted').length;
  document.getElementById('preview-results').textContent=`用时 ${Math.round((performance.now()-previewStart)/1000)} 秒；独立完成 ${independent} 个词，提示帮助 ${assisted} 个词，跳过 ${4-independent-assisted} 个词。`;
};
document.getElementById('preview-start').onclick=previewBegin;
document.getElementById('preview-again').onclick=previewBegin;
HWRecognition.load().then(ok=>{document.getElementById('model-status').textContent=ok?'手写识别已就绪，可以开始练习。':'手写识别暂未加载，仍可使用基础识别、提示和跳过。';});
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('handwriting_preview_sw.js',{scope:new URL('handwriting_preview',location.href).pathname}).catch(()=>{});
}
