(function(root){
  'use strict';
  function decide(probabilities, target, info, config) {
    const letter=String(target).toLowerCase()==='é'?'e':String(target).toLowerCase();
    const expected='abcdefghijklmnopqrstuvwxyz'.indexOf(letter);
    if(!info || info.minimal || info.rawInkCount<200) return {accepted:false,reason:'insufficient-ink'};
    if(expected<0) return {accepted:!!info.baselineAccepted,reason:'font-fallback'};
    if((target==='i'||target==='j') && !info.hasDot) return {accepted:false,reason:'missing-dot'};
    if(probabilities.length!==26 || !probabilities.every(Number.isFinite)) return {accepted:false,reason:'invalid-output'};
    const score=probabilities[expected];let rival=0,top=0;
    for(let i=0;i<26;i++){if(i!==expected)rival=Math.max(rival,probabilities[i]);if(probabilities[i]>probabilities[top])top=i;}
    const veto=score<config.vetoTarget && rival>config.vetoRival;
    const accepted=(!!info.baselineAccepted || (score>=config.cutoff && score>=rival*config.ratio)) && !veto;
    return {accepted,reason:veto?'different-letter':accepted?'accepted':'uncertain',targetScore:score,topLetter:String.fromCharCode(97+top),topScore:probabilities[top]};
  }
  root.HWDecision={decide};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.HWDecision;
})(typeof window==='undefined'?globalThis:window);
