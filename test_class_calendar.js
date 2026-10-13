const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const core = require('./api/src/functions/shared/classCalendarCore');
const service = require('./api/src/functions/shared/classCalendarService');
const copy = value => JSON.parse(JSON.stringify(value));
const at = (day,time='16:30') => core.iso(`2026-10-${day}T${time}`);
const group = {teacher:'Teacher A',classTime:'Sun 16:30',studentIds:['a','b']};
const oldTarget = () => ({id:'old',startTime:at('11','18:00'),endTime:at('18'),targetSessions:10});
const practice = n => Array.from({length:n},(_,i) => ({eventId:'s'+i,type:'session',sessionType:'study',timestamp:at('14','12:00')}));

// In-memory Cosmos contract: reads are snapshots; writes honor ETags and partition keys.
class Store {
    constructor(docs) { this.docs = new Map(docs.map(d => [d.id,{...copy(d),_etag:'1'}])); this.inject = null; this.keys = []; }
    items = {
        query: spec => ({fetchAll:async () => {
            const q = typeof spec === 'string' ? spec : spec.query;
            let docs = [...this.docs.values()];
            if (q.includes("c.role = 'classCalendar'")) docs = docs.filter(d => d.role === 'classCalendar');
            else if (q.includes("c.type = 'student_analytics_archive'")) docs = docs.filter(d => d.type === 'student_analytics_archive' && d.studentId === spec.parameters[0].value);
            else if (q.includes('c.id = @id')) docs = docs.filter(d => d.id === spec.parameters[0].value);
            else docs = docs.filter(d => (!d.role || d.role === 'student') && !d.type);
            return {resources:copy(docs)};
        }}),
        create:async doc => { if (this.docs.has(doc.id)) throw {code:409}; const resource = {...copy(doc),_etag:'1'}; this.docs.set(doc.id,resource); return {resource:copy(resource)}; }
    };
    item(id,pk) {
        const read = () => {
            const doc = this.docs.get(id);
            if (!doc) throw {code:404};
            assert.equal(pk,doc.studentId);
            this.keys.push([id,pk]);
            return doc;
        };
        return {read:async () => ({resource:copy(read())}),patch:async (ops,options) => {
            const doc = read();
            if (this.inject) { const inject=this.inject; this.inject=null; inject(doc); doc._etag=String(+doc._etag+1); }
            if (options?.accessCondition && options.accessCondition.condition !== doc._etag) throw {code:412};
            for (const op of ops) doc[op.path.slice(1)] = copy(op.value);
            doc._etag=String(+doc._etag+1);
            return {resource:copy(doc)};
        }};
    }
}
async function coreAndServiceTests() {
    const classes = core.occurrences(group,'2026-10-12','2026-10-25');
    assert.equal(classes.length,2);
    assert.equal(classes[0].startTime,at('18'));
    assert.equal(classes[0].endTime,at('18','18:00'));
    assert.equal(core.parseClassTime('Saturday 9:05').day,6);
    assert.equal(core.parseClassTime('Sun 24:00'),null);
    assert.equal(core.beijingDate('2026-10-17T18:00:00Z'),'2026-10-18');
    const event = {...classes[0],id:'class_'+'a'.repeat(32)};
    let targets = core.updateTargets({targets:[oldTarget()]},event,'attended',classes[1],practice(10));
    assert.equal(targets[1].startTime,at('18','18:00'));
    assert.equal(targets[1].endTime,at('25'));
    assert.equal(targets[1].targetSessions,10);
    targets = core.updateTargets({targets:[oldTarget()]},event,'missed',classes[1],practice(10));
    assert.equal(targets.length,1);
    assert.equal(targets[0].targetSessions,20);
    assert.equal(targets[0].startTime,at('11','18:00'));
    assert.equal(targets[0].endTime,at('25'));
    targets = core.updateTargets({targets:[oldTarget()]},event,'missed',classes[1],practice(9));
    assert.equal(targets[1].targetSessions,10);
    assert.equal(targets[1].startTime,at('18','18:00'));
    targets = core.updateTargets({targets:[{...oldTarget(),manualOffset:1}]},event,'missed',classes[1],practice(9));
    assert.equal(targets[0].targetSessions,20);
    assert.equal(core.countPractice(practice(10).concat(practice(10)),oldTarget()),10);
    assert.equal(core.countPractice([{type:'session',eventId:'loss',sessionType:'uno',timestamp:at('14'),data:{winner:1,totalTimeSec:60}}],oldTarget()),0);
    const rescheduled = {...classes[1],startTime:at('26','17:00')};
    assert.equal(core.updateTargets({targets:[]},event,'attended',rescheduled,[])[0].endTime,rescheduled.startTime);
    const cancelled = core.updateTargets({targets:[oldTarget()]},event,'cancelled',null,[]);
    assert.equal(cancelled[0].endTime,at('25'));
    assert.equal(cancelled[0].targetSessions,10);
    const stats = core.attendanceStats({attendance:[{status:'attended',startTime:at('18')},{status:'missed',startTime:at('25')},{status:'cancelled',startTime:at('20')}]},'2026-10-12','2026-10-31');
    assert.equal(stats.rate,50); assert.equal(stats.recorded,2);
    assert.equal(core.attendanceStats({attendance:stats.records},'2026-10-18','2026-10-18').rate,100);
    assert.equal(core.attendanceStats({},'','').rate,null);

    const store = new Store([
        {id:'a',role:'student',...group,studentIds:undefined,targets:[oldTarget()],analytics:practice(9)},
        {id:'b',studentId:'b',role:'student',teacher:group.teacher,classTime:group.classTime,targets:[oldTarget()],analytics:[]},
        {id:'arc',type:'student_analytics_archive',studentId:'a',events:[practice(10)[9]]}
    ].map(d => Object.fromEntries(Object.entries(d).filter(([,v]) => v !== undefined))));
    const now = Date.now;
    Date.now = () => +new Date(at('19','12:00'));
    try {
        const generated = await service.ensureCalendar(store,'2026-10-31');
        const first = generated.find(e => e.startTime === at('18'));
        const second = generated.find(e => e.startTime === at('25'));
        assert(first && second);
        const size=store.docs.size;
        await service.ensureCalendar(store,'2026-10-31'); assert.equal(store.docs.size,size);
        // Foreign student and future attendance fail without locking a class.
        await assert.rejects(service.recordBatch(store,{action:'record',eventId:first.id,studentIds:['outsider'],status:'attended'},'admin'),/belonging/);
        assert(!store.docs.get(first.id).attendanceStarted);
        await assert.rejects(service.recordBatch(store,{action:'record',eventId:second.id,studentIds:['a'],status:'attended'},'admin'),/after the class ends/);
        // Conflict retry merges onto a newly saved analytics tail, preserving it.
        store.inject = d => { d.analytics=(d.analytics || []).concat({eventId:'concurrent',type:'exercise'}); };
        const result = await service.recordOne(store,first,'a','missed',second,'admin');
        assert(result.success); assert.equal(result.targets[0].targetSessions,20);
        assert(store.docs.get('a').analytics.some(e => e.eventId === 'concurrent'));
        const duplicate = await service.recordOne(store,first,'a','missed',second,'admin');
        assert(duplicate.duplicate); assert.equal(store.docs.get('a').targets[0].targetSessions,20);
        assert.equal(store.docs.get('a').attendance.length,1);
        const partial = await service.recordBatch(store,{action:'record',eventId:first.id,studentIds:['a','b'],status:'attended'},'admin');
        assert(partial.success); assert.equal(store.docs.get('b').targets[1].targetSessions,10);
        await assert.rejects(service.saveEvent(store,{eventId:first.id,startTime:at('20'),endTime:at('20','18:00')}),/cannot be edited/);
        const cancel1 = await service.recordBatch(store,{action:'cancel',eventId:second.id},'admin'); assert(cancel1.success);
        const before = copy(store.docs.get('a').targets);
        const cancel2 = await service.recordBatch(store,{action:'cancel',eventId:second.id},'admin'); assert(cancel2.success);
        assert.deepEqual(store.docs.get('a').targets,before);
        assert.equal(store.docs.get(second.id).status,'cancelled');
        assert.equal(core.attendanceStats(store.docs.get('a'),'','').recorded,1);
        assert(store.keys.some(([id,pk]) => id === 'a' && pk === undefined));
        assert(store.keys.some(([id,pk]) => id === 'b' && pk === 'b'));
        const editable = generated.find(e => e.startTime === core.iso('2026-11-01T16:30'));
        await service.saveEvent(store,{eventId:editable.id,etag:store.docs.get(editable.id)._etag,startTime:core.iso('2026-11-02T16:30'),endTime:core.iso('2026-11-02T18:00')});
        await service.ensureCalendar(store,'2026-11-30');
        assert.equal(store.docs.get(editable.id).startTime,core.iso('2026-11-02T16:30'));
    } finally { Date.now = now; }
}
async function uiTests() {
    const html=fs.readFileSync('teacher_dashboard.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
    const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.test/'});
    const w=dom.window;
    w.document.addEventListener=()=>{}; // Do not start a real login.
    w.eval('var API_BASE="/api"; var AVAILABLE_CONTENT={};');
    w.eval(['teacher_dashboard.js','geo_export.js','admin_dashboard.js','api/src/functions/shared/classCalendarCore.js','class_calendar.js'].map(file => fs.readFileSync(file,'utf8')).join('\n') + '\nallStudents=[{id:"a",fullName:"Student <script>",classTime:"Sun 16:30",teacher:"Teacher A",role:"student"}]; isAdmin=true; loadAllStudents=async()=>{}; window.testSetEvents=events=>{calendarEvents=events;calendarReady=true;};');
    for (const [id,value] of Object.entries({bulkTargetClass:'Sun 16:30',bulkTargetStart:'2026-10-18T18:00',bulkTargetEnd:'2026-10-25T16:30',bulkTargetCount:'10',bulkContentClass:'Sun 16:30',bulkBook:'PU1',bulkUnit:'1',bulkPage:'2'})) {
        const el=w.document.getElementById(id);
        if (el.tagName === 'SELECT') el.innerHTML=`<option>${value}</option>`;
        el.value=value;
    }
    const targetsBtn=w.document.querySelector('button[onclick="submitBulkTargets()"]');
    const contentBtn=w.document.querySelector('button[onclick="submitBulkContent()"]');
    w.apiFetch=async()=>({ok:true,json:async()=>({results:[{success:true}]}),text:async()=>''});
    await w.submitBulkTargets(); assert(!targetsBtn.disabled); assert(targetsBtn.textContent.includes('Set Targets'));
    await w.submitBulkTargets(); assert(!targetsBtn.disabled);
    await w.submitBulkContent(); assert(!contentBtn.disabled); assert(contentBtn.textContent.includes('Apply to Class'));
    await w.submitBulkContent(); assert(!contentBtn.disabled);
    w.apiFetch=async()=>({ok:false,text:async()=>'Save denied'});
    await w.submitBulkContent(); assert(!contentBtn.disabled); assert(w.document.getElementById('bulkContentError').textContent.includes('Save denied'));
    await w.submitBulkTargets(); assert(!targetsBtn.disabled);
    w.apiFetch=async()=>{throw Error('Offline');};
    await w.submitBulkTargets(); assert(!targetsBtn.disabled);
    const event={id:'class_'+'a'.repeat(32),groupKey:core.groupKey('Teacher A','Sun 16:30'),teacher:'Teacher A',classTime:'Sun 16:30',startTime:at('18'),endTime:at('18','18:00'),studentIds:['a'],status:'scheduled'};
    w.testSetEvents([event]); w.document.getElementById('calendarMonth').value='2026-10';
    const realNow=w.Date.now; w.Date.now=()=>+new Date(at('19','12:00'));
    w.renderClassCalendar(); assert.equal(w.document.querySelectorAll('.calendar-event').length,1);
    w.renderAttendanceChecklist(); assert(w.document.querySelector('#attendanceChecklist input').checked);
    w.selectAttendance(false); assert(!w.document.querySelector('#attendanceChecklist input').checked);
    w.selectAttendance(true);
    w.apiFetch=async()=>({ok:true,json:async()=>({success:true,results:[{studentId:'a',success:true,attendance:[{classId:event.id,status:'attended',startTime:event.startTime,endTime:event.endTime,classTime:event.classTime}],targets:[]}]} )});
    await w.saveCheckedAttendance('attended');
    assert.equal(w.document.querySelectorAll('#attendanceChecklist input').length,0);
    assert(w.document.getElementById('studentsTableBody').textContent.includes('100%'));
    assert(!w.document.querySelector('#attendanceChecklist script'));
    w.Date.now=realNow;
    dom.window.close();
}
function httpHandler(file,store,gate={token:{role:'admin',sub:'admin'}}) {
    let handler;
    const filename=require('path').resolve('api/src/functions',file);
    const sandbox={module:{exports:{}},console,Date,require: id => {
        if (id==='@azure/functions') return {app:{http:(_name,options)=>{handler=options.handler;}}};
        if (id==='./shared/validateApiKey') return {validateApiKey:()=>true};
        if (id==='./shared/db') return {getContainer:()=>store};
        if (id==='./shared/auth') return {requireAuth:()=>gate,isPrivileged:token=>['admin','teacher','BM'].includes(token.role),forbidden:()=>({status:403}),publicUser:copy};
        return require(require('path').resolve(require('path').dirname(filename),id));
    }};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox);
    return handler;
}
async function httpAndRosterTests() {
    const context={error:()=>{}};
    const store=new Store([{id:'a',role:'student',teacher:'Teacher A',classTime:'Sun 16:30',analytics:practice(1),attendance:[]}]);
    const request={method:'GET',query:{get:()=>null}};
    assert.equal((await httpHandler('classCalendar.js',store,{token:{role:'student',sub:'a'}})(request,context)).status,403);
    assert.equal((await httpHandler('classCalendar.js',store,{error:{status:401}})(request,context)).status,401);
    const now=Date.now;
    Date.now=()=>+new Date(at('19','12:00'));
    try {
        const roster=await service.ensureCalendar(store,'2026-11-30');
        const first=roster.find(e=>e.startTime===at('18'));
        const second=roster.find(e=>e.startTime===at('25'));
        // Recording a later class with earlier pending attendance does not lock it.
        Date.now=()=>+new Date(at('26','12:00'));
        const failed=await service.recordBatch(store,{action:'record',eventId:second.id,studentIds:['a'],status:'attended'},'admin');
        assert(!failed.success); assert(failed.results[0].error.includes('earlier')); assert(!store.docs.get(second.id).attendanceStarted);
        Date.now=()=>+new Date(at('19','12:00'));
        store.docs.get('a').classTime='Tue 17:00';
        await service.ensureCalendar(store,'2026-11-30');
        assert.equal(store.docs.get(second.id).status,'retired');
        assert.equal(store.docs.get(first.id).status,'scheduled'); // historical roster remains valid
        const targetReq={json:async()=>({studentIds:['a'],target:{startTime:at('18','18:00'),endTime:at('25'),targetSessions:10}})};
        store.inject=doc=>{doc.attendance.push({classId:first.id,status:'attended',startTime:first.startTime});};
        const assigned=await httpHandler('setTargets.js',store)(targetReq,context);
        assert.equal(assigned.status,200); assert(assigned.jsonBody.results[0].success);
        assert.equal(store.docs.get('a').attendance.length,1);
        assert.equal(store.docs.get('a').analytics.length,1);
        const contentReq={json:async()=>({studentId:'a',fields:{book:'PU1',unit:'2',page:'3'}})};
        const updated=await httpHandler('updateStudent.js',store)(contentReq,context);
        assert.equal(updated.status,200); assert.equal(store.docs.get('a').book,'PU1');
        assert.equal(store.docs.get('a').attendance.length,1);
        assert.equal(store.docs.get('a').targets.length,1);
    } finally {Date.now=now;}
}
(async()=>{await coreAndServiceTests();await httpAndRosterTests();await uiTests();console.log('PASS: calendar recurrence, target transitions, archives, retries, cancellation, auth, rosters and dashboard controls');})().catch(e=>{console.error(e);process.exitCode=1;});
