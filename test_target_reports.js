const assert=require('assert/strict');
const fs=require('fs');
const vm=require('vm');
const core=require('./api/src/functions/shared/targetReportsCore');
const {buildReports}=require('./api/src/functions/getTargetReports');
const now=Date.parse('2026-10-13T12:00:00+08:00');
const target={startTime:'2026-10-11T18:00:00+08:00',endTime:'2026-10-18T16:30:00+08:00',targetSessions:10,manualOffset:2};
const event={type:'session',sessionType:'study',timestamp:'2026-10-12T12:00:00.000Z',eventId:'one'};
const student={id:'a',teacher:'Teacher A',classTime:'Sun 16:30',fullName:'Student A',password:'NEVER EXPORTED',targets:[target],analytics:[event]};
assert.equal(core.selectTarget(student,now),target);
const past={...target,endTime:'2026-10-10T12:00:00Z'};
const future={...target,startTime:'2026-10-20T12:00:00Z',endTime:'2026-10-27T12:00:00Z'};
assert.equal(core.selectTarget({targets:[future,past]},now),past);
assert.equal(core.selectTarget({targets:[future]},now),future);
assert.equal(core.row(student,future,[event],now).completed,0);
assert.equal(core.row(student,target,[event,event,{...event,eventId:'loss',sessionType:'uno',data:{winner:1,totalTimeSec:30}},{...event,eventId:'future',timestamp:'2026-10-14T12:00:00Z'}],now).completed,3);
const rows=[core.row(student,target,[event],now),core.row({...student,fullName:'Student B'}, {...target,startTime:'2026-09-13T10:00:00Z',targetSessions:50},[],now),core.row({...student,fullName:'No target'},null,[],now)];
const message=core.message(core.groups(rows)[0]);
assert(message.includes('Student A 3/10'));
assert(message.includes('Student B 2/50'));
assert(message.includes('2026/09/13 - 2026/10/18'));
assert(message.includes('No target 未设置目标'));
assert(!message.includes(student.password));
assert.equal((message.match(/打卡记录/g)||[]).length,1);
assert.equal(core.closings.length,10);
assert.equal(new Set(core.closings).size,10);
for(let i=0;i<10;i++) assert.equal(core.pickClosing(()=>(i+0.5)/10),core.closings[i]);
assert.equal(core.pickClosing(()=>0),core.pickClosing(()=>0)); // Repeats are allowed.
assert(core.message({...core.groups(rows)[0],closing:core.closings[8]}).endsWith(core.closings[8]));
assert.equal(core.groups([{...rows[0],classTime:'Sun 10:40'},{...rows[0],classTime:'Fri 19:00'}])[0].classTime,'Fri 19:00');

(async()=>{
    let calls=0;
    const container={items:{query:(spec,options)=>({fetchAll:async()=>{
        calls++;
        if(spec.query.includes('c.teacher = @teacher')) {assert.equal(spec.parameters[0].value,'Teacher A');assert(!spec.query.includes('password'));return {resources:[student]};}
        assert.equal(options.partitionKey,'a');assert.equal(spec.parameters[1].value,'2026-10-11T10:00:00.000Z');
        return {resources:[event,{...event,eventId:'archived'}]};
    }})}};
    const reports=await buildReports(container,'Teacher A',now);
    assert.equal(calls,2);assert.equal(reports.groups[0].rows[0].completed,4);
    assert(!JSON.stringify(reports).includes('NEVER EXPORTED'));
    assert(!Object.hasOwn(reports.groups[0].rows[0],'id'));
    await assert.rejects(buildReports({items:{query:()=>({fetchAll:async()=>{throw new Error('unavailable');}})}},'Teacher A',now));
    let token=null,enforce=true,key=true;
    const sandbox={module:{exports:{}},require:name=>name==='@azure/functions'?{app:{http:()=>{}}}:name==='./shared/auth'?{requireAuth:()=>({token}),enforceAuth:()=>enforce,isPrivileged:(t,r)=>r.includes(t.role),unauthorized:()=>({status:401})}:name==='./shared/db'?{getContainer:()=>container}:name==='./shared/validateApiKey'?{validateApiKey:()=>key}:core,Date,Promise,Array};
    vm.runInNewContext(fs.readFileSync('api/src/functions/getTargetReports.js','utf8'),sandbox);
    const handler=sandbox.module.exports.handler,req={query:new Map([['teacher','Teacher A']])},ctx={error:()=>{}};
    assert.equal((await handler(req,ctx)).status,401);
    token={role:'student'};assert.equal((await handler(req,ctx)).status,401);
    token={role:'admin'};assert.equal((await handler({query:new Map()},ctx)).status,400);
    key=false;assert.equal((await handler(req,ctx)).status,403);key=true;
    assert.equal((await handler(req,ctx)).status,200);
    console.log('PASS: target reports — target choice, archive dedup, offsets, short losses, periods, safe fields, errors and authorization');
})().catch(err=>{console.error(err);process.exitCode=1;});
