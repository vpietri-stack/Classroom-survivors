const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const {dashboardData}=require('./api/src/functions/shared/dashboardData');
const {readArchivedPractice}=require('./api/src/functions/shared/practiceReads');
const {buildReports}=require('./api/src/functions/getTargetReports');
const copy=value=>JSON.parse(JSON.stringify(value));
const now=Date.parse('2026-10-19T12:00:00+08:00');
const event={type:'session',eventId:'live',sessionType:'study',timestamp:'2026-10-19T02:00:00.000Z',data:{durationMs:60000}};
const target={id:'t',startTime:'2026-10-18T10:00:00.000Z',endTime:'2026-10-25T08:30:00.000Z',targetSessions:10};
(async()=>{
 let docs=Array.from({length:41},(_,i)=>({id:'s'+i,role:'student',fullName:'Student '+i,teacher:'Teacher A',classTime:'Sun 16:30',password:'PRIVATE',targets:[target],attendance:[],
     srState:{big:'x'.repeat(30000)},analytics:[{type:'exercise',itemDetails:'y'.repeat(10000)},event]}));
 let queries=[];
 const container={items:{query:spec=>({fetchAll:async()=>{
     const query=typeof spec==='string'?spec:spec.query;queries.push(query);
     assert(!query.includes('SELECT *'));assert(!query.includes('c.srState'));
     if(!query.includes('JOIN e IN')) assert(query.includes('NOT IS_DEFINED(c.type)')); // Diagnostic and archive documents are not students.
     if(query.includes('JOIN e IN')) {
         const ids=spec.parameters.filter(p=>p.name.startsWith('@id')).map(p=>p.value);
         assert(ids.length<=20);
         return {resources:ids.flatMap(studentId=>[{studentId,event:{...event,eventId:'archived'}},{studentId,event}])};
     }
     return {resources:docs.map(s=>{const {srState,analytics,password,...small}=s;return {...copy(small),...(query.includes('c.password')?{password}:{}),analytics:copy(analytics.filter(e=>e.type==='session'))};})};
 }})}};
 const full=await dashboardData(container,{secure:true});
 assert.equal(full.status,200);assert(full.jsonBody.full);assert.equal(full.jsonBody.students.length,41);
 assert(Buffer.byteLength(JSON.stringify(full.jsonBody))<Buffer.byteLength(JSON.stringify(docs))/50);
 assert(full.jsonBody.students.every(s=>s._summary && !s.srState && !s.analytics && s.sessionDays.length===1));
 const unchanged=await dashboardData(container,{secure:true,since:full.jsonBody.revision});
 assert.equal(unchanged.status,304);assert.equal(unchanged.jsonBody,undefined);
 docs[0].analytics.push({type:'exercise',itemDetails:'z'.repeat(20000)});
 docs[0].analytics.push({type:'session',sessionType:'study'}); // Old malformed telemetry must not break the overview.
 assert.equal((await dashboardData(container,{secure:true,since:full.jsonBody.revision})).status,304);
 docs[0].fullName='Changed';
 const delta=await dashboardData(container,{secure:true,since:full.jsonBody.revision});
 assert(!delta.jsonBody.full);assert.equal(delta.jsonBody.students.length,1);assert.equal(delta.jsonBody.students[0].id,'s0');
 docs.pop();
 const removed=await dashboardData(container,{secure:true,since:delta.jsonBody.revision});
 assert.deepEqual(removed.jsonBody.removed,['s40']);assert.equal(removed.jsonBody.students.length,0);
 assert((await dashboardData(container,{secure:true,since:'unknown-instance'})).jsonBody.full);
 const publicView=await dashboardData(container,{since:full.jsonBody.revision});
 assert(!JSON.stringify(publicView).includes('PRIVATE'));assert(publicView.jsonBody.full);
 queries=[];
 const reports=await buildReports(container,'Teacher A',now);
 assert.equal(queries.length,3); // one roster projection + two batches, instead of 41 requests
 assert.equal(reports.groups[0].rows.length,40);
 assert(reports.groups[0].rows.every(r=>r.completed===2)); // archive/live duplicate counted once
 assert(!JSON.stringify(reports).includes('PRIVATE'));assert(!JSON.stringify(reports).includes('itemDetails'));
 assert.equal(reports.progressUpdates.length,40);
 queries=[];
 await readArchivedPractice(container,[{id:'s0',from:target.startTime,to:target.endTime},{id:'s0',from:'2026-10-17T00:00:00Z',to:target.endTime}]);
 assert.equal(queries.length,1);

 // New summary/detail parameters cannot widen the existing student-role boundary.
 let handler,privileged=false;
 const auth={verifyToken:()=>({sub:'s0',role:privileged?'admin':'student'}),SESSION_SECRET:()=>'',isPrivileged:()=>privileged,publicUser:s=>{const {password,...safe}=s;return safe;},enforceAuth:()=>true};
 const rawContainer={items:{query:spec=>({fetchAll:async()=>({resources:docs.filter(s=>s.id===spec.parameters[0].value)})})}};
 const sandbox={require:name=>name==='@azure/functions'?{app:{http:(_name,o)=>{handler=o.handler;}}}:name==='./shared/validateApiKey'?{validateApiKey:()=>true}:name==='./shared/db'?{getContainer:()=>rawContainer}:name==='./shared/auth'?auth:{dashboardData},console};
 vm.runInNewContext(fs.readFileSync('api/src/functions/getStudents.js','utf8'),sandbox);
 const context={log:()=>{},error:()=>{}};
 let response=await handler({query:new Map([['view','dashboard'],['studentId','s1'],['includeSecure','true']])},context);
 assert.equal(response.status,200);assert.equal(response.jsonBody.length,1);assert.equal(response.jsonBody[0].id,'s0');assert(!response.jsonBody[0].password);
 privileged=true;
 response=await handler({query:new Map([['studentId','s1'],['includeSecure','true']])},context);
 assert.equal(response.jsonBody[0].id,'s1');assert.equal(response.jsonBody[0].password,'PRIVATE');
 console.log('PASS: compact overview, unchanged/changed/removed rows, cold-instance fallback, safe fields, batched exact report counts, and scoped student details');
})().catch(e=>{console.error(e);process.exitCode=1;});
