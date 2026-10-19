const crypto = require('crypto');
const core = require('./classCalendarCore');
const {liveSessions, readArchivedPractice} = require('./practiceReads');
const targetCore = require('./targetReportsCore');

function error(message, status = 400) { return Object.assign(new Error(message), { status }); }
function conflict(err) { return Number(err.code || err.statusCode) === 412; }
function item(container, doc) { return container.item(doc.id, doc.studentId === undefined ? undefined : doc.studentId); }
async function findStudent(container, id) {
    const { resources } = await container.items.query({ query: `SELECT c.id, c.studentId, c._etag, c.role, c.type, c.teacher, c.classTime, c.classGroups, c.targets, c.attendance, ${liveSessions} FROM c WHERE c.id = @id`, parameters: [{ name: '@id', value: id }] }).fetchAll();
    const doc = resources[0];
    if (!doc || (doc.role && doc.role !== 'student') || doc.type === 'student_analytics_archive') throw error('Student not found', 404);
    return doc;
}
async function listEvents(container, groupKey, window, futureAfter) {
    const parameters = [];
    let query = "SELECT * FROM c WHERE c.role = 'classCalendar'";
    if (groupKey) {query += ' AND c.groupKey = @group'; parameters.push({name:'@group',value:groupKey});}
    if (futureAfter !== undefined) {query += ' AND c.startTime > @future'; parameters.push({name:'@future',value:new Date(futureAfter).toISOString()});}
    if (window) {
        query += ' AND ((c.startTime >= @from AND c.startTime <= @to) OR (c.endTime <= @now AND c.status = @status AND (NOT IS_DEFINED(c.attendanceComplete) OR c.attendanceComplete = false)))';
        parameters.push({name:'@from',value:window.from+'T00:00:00.000+08:00'},{name:'@to',value:window.to+'T23:59:59.999+08:00'},
            {name:'@now',value:new Date().toISOString()},{name:'@status',value:'scheduled'});
        // Persisted class times are normalized UTC strings.
        parameters[parameters.length-4].value = new Date(parameters[parameters.length-4].value).toISOString();
        parameters[parameters.length-3].value = new Date(parameters[parameters.length-3].value).toISOString();
    }
    const { resources } = await container.items.query(parameters.length ? {query,parameters} : query).fetchAll();
    return resources.sort((a,b) => a.startTime.localeCompare(b.startTime));
}
const STATE_ID = 'class_calendar_state';
async function readState(container) {
    try {return (await container.item(STATE_ID,STATE_ID).read()).resource;}
    catch (err) {if (Number(err.code || err.statusCode) === 404) return null; throw err;}
}
async function ensureCalendar(container, through, now = Date.now(), window) {
    const today = core.beijingDate(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(through) || !Number.isFinite(+new Date(through)) || through < core.START_DATE || through > core.beijingDate(now + 366 * core.DAY)) throw error('Calendar date must be between 12 October 2026 and one year ahead.');
    let end = core.beijingDate(Math.max(+new Date(through + 'T23:59:59+08:00'), now) + 35 * core.DAY);
    const { resources: roster } = await container.items.query("SELECT c.id, c.teacher, c.classTime, c.classGroups FROM c WHERE (c.role = 'student' OR NOT IS_DEFINED(c.role)) AND NOT IS_DEFINED(c.type)").fetchAll();
    const groups = new Map();
    for (const s of roster) {
        for (const g of core.memberships(s)) {
            if (!core.parseClassTime(g.classTime)) continue;
            const key = core.groupKey(g.teacher, g.classTime);
            if (!groups.has(key)) groups.set(key, { ...g, studentIds: [] });
            groups.get(key).studentIds.push(s.id);
        }
    }
    for (const group of groups.values()) group.studentIds.sort();
    const hash = crypto.createHash('sha256').update(JSON.stringify([...groups].sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
    const state = await readState(container);
    if (state && state.rosterHash !== hash && state.generatedThrough > end) end = state.generatedThrough;
    // Persist only generation metadata: reads still return fresh classes/locks from Cosmos.
    if (state && state.rosterHash === hash && state.generatedThrough >= end) return listEvents(container,null,window);
    const extending = state && state.rosterHash === hash;
    const existing = await listEvents(container,null,null,state ? now : undefined);
    let conflicted = false;
    for (const event of existing) {
        if (!extending && !event.manual && !event.attendanceStarted && event.status === 'scheduled' && +new Date(event.startTime) > now && !groups.has(event.groupKey)) {
            try { await item(container,event).patch([{op:'set',path:'/status',value:'retired'}], {accessCondition:{type:'IfMatch',condition:event._etag}}); }
            catch (err) { if (!conflict(err)) throw err; conflicted = true; }
        }
        const group = groups.get(event.groupKey);
        if (!extending && group && !event.attendanceStarted && +new Date(event.startTime) > now && ['scheduled','retired'].includes(event.status) &&
            (event.status === 'retired' || JSON.stringify([...event.studentIds].sort()) !== JSON.stringify(group.studentIds))) {
            try {await item(container,event).patch([{op:'set',path:'/studentIds',value:group.studentIds},{op:'set',path:'/status',value:'scheduled'}],{accessCondition:{type:'IfMatch',condition:event._etag}});}
            catch (err) {if (!conflict(err)) throw err; conflicted = true;}
        }
    }
    const byId = new Map(existing.map(e => [e.id,e]));
    const knownGroups = new Set([...(state?.groupKeys || []),...existing.map(e => e.groupKey)]);
    for (const [key, group] of groups) {
        const from = extending ? core.beijingDate(+new Date(state.generatedThrough+'T00:00:00+08:00')+core.DAY) : state || (existing.length && !knownGroups.has(key)) ? today : core.START_DATE;
        for (const event of core.occurrences(group, from, end)) {
            const id = 'class_' + crypto.createHash('sha256').update(key + '|' + core.beijingDate(event.startTime)).digest('hex').slice(0,32);
            const saved = byId.get(id);
            if (saved) {
                continue;
            }
            try { await container.items.create({ ...event, id, studentId: id, role: 'classCalendar' }); }
            catch (err) { if (Number(err.code || err.statusCode) !== 409) throw err; }
        }
    }
    if (!conflicted) {
        const metadata = {rosterHash:hash,generatedThrough:extending ? end : state && state.generatedThrough > end ? state.generatedThrough : end,groupKeys:[...new Set([...knownGroups,...groups.keys()])]};
        try {
            if (state) await container.item(STATE_ID,STATE_ID).patch(Object.entries(metadata).map(([key,value])=>({op:'set',path:'/'+key,value})),{accessCondition:{type:'IfMatch',condition:state._etag}});
            else await container.items.create({id:STATE_ID,studentId:STATE_ID,role:'classCalendarState',...metadata});
        } catch (err) {if (!conflict(err) && Number(err.code || err.statusCode)!==409) throw err;}
    }
    return listEvents(container,null,window);
}
async function readEvent(container, id) {
    if (typeof id !== 'string' || !/^class_[a-f0-9]{32}$/.test(id)) throw error('Invalid class id');
    try { return (await container.item(id,id).read()).resource; }
    catch (err) { if (Number(err.code || err.statusCode) === 404) throw error('Class not found',404); throw err; }
}
async function lockEvent(container, id, cancel, expected) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const event = await readEvent(container,id);
        if (expected && (event.startTime !== expected.startTime || event.endTime !== expected.endTime)) throw error('Class was rescheduled. Reload and retry.',409);
        if (!cancel && event.status !== 'scheduled') throw error('This class is cancelled.');
        if (!cancel && +new Date(event.endTime) > Date.now()) throw error('Attendance is available after the class ends.');
        if (cancel && event.attendanceStarted && event.status !== 'cancelled') throw error('Attendance has already been recorded; this class cannot be cancelled.');
        if (event.attendanceStarted) return event;
        try {
            const { resource } = await item(container,event).patch([
                { op: 'set', path: '/attendanceStarted', value: true },
                ...(cancel ? [{ op: 'set', path: '/status', value: 'cancelled' }] : [])
            ], { accessCondition: { type:'IfMatch', condition:event._etag } });
            return resource;
        } catch (err) { if (!conflict(err)) throw err; }
    }
    throw error('Class changed concurrently. Please retry.',409);
}
async function saveEvent(container, body) {
    const event = await readEvent(container,body.eventId);
    if (event.attendanceStarted || event.status !== 'scheduled') throw error('Classes with recorded attendance or cancellation cannot be edited.');
    if (!Number.isFinite(+new Date(body.startTime)) || !Number.isFinite(+new Date(body.endTime))) throw error('Choose a valid start and end time.');
    const startTime = new Date(body.startTime).toISOString(), endTime = new Date(body.endTime).toISOString();
    if (+new Date(endTime) <= +new Date(startTime) || +new Date(endTime)-+new Date(startTime) > core.DAY || core.beijingDate(startTime) < core.START_DATE) throw error('Choose a valid class time and duration (up to 24 hours).');
    try {
        const { resource } = await item(container,event).patch([
            {op:'set',path:'/startTime',value:startTime}, {op:'set',path:'/endTime',value:endTime},
            {op:'set',path:'/manual',value:true}
        ], {accessCondition:{type:'IfMatch',condition:body.etag || event._etag}});
        return resource;
    } catch (err) { if (conflict(err)) throw error('Class changed concurrently. Reload and retry.',409); throw err; }
}
function attendanceWindow(student,event,status,nextClass) {
    const previous=core.previousTarget((student.targets || []).filter(t=>core.targetBelongsTo(student,t,event.groupKey)),event);
    const current=targetCore.selectTarget(student,Date.now(),event.groupKey);
    const from=Math.min(+new Date(previous?.startTime || event.endTime),+new Date(current?.startTime || event.endTime));
    const to=Math.min(Date.now(),Math.max(+new Date(nextClass?.startTime || event.endTime),+new Date(current?.endTime || event.endTime),
        status==='cancelled' && previous ? +new Date(core.addDays(previous.endTime,7)) : 0));
    return {id:student.id,from:new Date(from).toISOString(),to:new Date(to).toISOString()};
}
function currentTargetCounts(student, targets, event, analytics) {
    const target=targetCore.selectTarget({...student,targets},Date.now(),event.groupKey);
    return target ? {[core.targetCountKey(target)]:core.countPractice(analytics,target,Date.now())} : {};
}
async function recordOne(container, event, studentId, status, nextClass, actor, initialStudent, archivedPractice) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const student = attempt === 0 && initialStudent ? initialStudent : await findStudent(container,studentId);
        const receipt = (student.attendance || []).find(r => r.classId === event.id);
        const archives = attempt === 0 && archivedPractice ? archivedPractice : (await readArchivedPractice(container,[attendanceWindow(student,event,status,nextClass)])).get(studentId) || [];
        const analytics = (student.analytics || []).concat(archives);
        if (receipt) return { studentId, success:true, duplicate:true, attendance:student.attendance, targets:student.targets || [],targetCounts:currentTargetCounts(student,student.targets || [],event,analytics) };
        const targets = core.updateTargets(student,event,status,nextClass,analytics);
        const attendance = [...(student.attendance || []), { classId:event.id, startTime:event.startTime, endTime:event.endTime, classTime:event.classTime, teacher:event.teacher, status, recordedAt:new Date().toISOString(), recordedBy:actor }];
        try {
            await item(container,student).patch([{op:'set',path:'/attendance',value:attendance}, {op:'set',path:'/targets',value:targets}], {accessCondition:{type:'IfMatch',condition:student._etag}});
            return { studentId, success:true, attendance, targets,targetCounts:currentTargetCounts(student,targets,event,analytics) };
        } catch (err) { if (!conflict(err)) throw err; }
    }
    throw error('Student changed concurrently. Please retry.',409);
}
async function recordBatch(container, body, actor) {
    const cancel = body.action === 'cancel';
    if (!cancel && !['attended','missed'].includes(body.status)) throw error('Choose attended or missed.');
    const original = await readEvent(container,body.eventId);
    let events = await listEvents(container,original.groupKey);
    const ids = cancel ? original.studentIds : body.studentIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some(id => !original.studentIds.includes(id))) throw error('Select students belonging to this class (maximum 200).');
    if (!cancel && original.status !== 'scheduled') throw error('This class is no longer scheduled.');
    if (!cancel && +new Date(original.endTime) > Date.now()) throw error('Attendance is available after the class ends.');
    let locked = cancel ? await lockEvent(container,body.eventId,true,original) : null;
    const event = locked || original;
    let nextClass = events.find(e => e.status === 'scheduled' && +new Date(e.startTime) > +new Date(event.endTime));
    if (!cancel && !nextClass) {
        await ensureCalendar(container,core.beijingDate(Date.now() + 35 * core.DAY));
        events = await listEvents(container,event.groupKey);
        nextClass = events.find(e => e.status === 'scheduled' && +new Date(e.startTime) > +new Date(event.endTime));
    }
    const {resources:students} = await container.items.query({query:`SELECT c.id, c.studentId, c._etag, c.role, c.type, c.teacher, c.classTime, c.classGroups, c.targets, c.attendance, ${liveSessions} FROM c WHERE ARRAY_CONTAINS(@ids, c.id) AND (c.role = 'student' OR NOT IS_DEFINED(c.role)) AND NOT IS_DEFINED(c.type)`,parameters:[{name:'@ids',value:original.studentIds}]}).fetchAll();
    const byId = new Map(students.map(s=>[s.id,s]));
    const archives = await readArchivedPractice(container,ids.flatMap(id=>{
        const student=byId.get(id); if (!student) return [];
        return [attendanceWindow(student,event,cancel ? 'cancelled' : body.status,nextClass)];
    }));
    const results = [];
    for (const id of [...new Set(ids)]) {
        try {
            // Chronology is independent for each of a student's groups.
            const student = byId.get(id);
            if (!student) throw error('Student not found',404);
            const pendingEarlier = events.find(e => e.groupKey === event.groupKey && e.status === 'scheduled' && e.studentIds.includes(id) && +new Date(e.endTime) <= Date.now() && +new Date(e.startTime) < +new Date(event.startTime) && !(student.attendance || []).some(r => r.classId === e.id));
            if (!cancel && pendingEarlier) throw error('Record this student’s earlier class first.');
            if (!locked) locked = await lockEvent(container,event.id,false,event);
            results.push(await recordOne(container,locked,id,cancel ? 'cancelled' : body.status,nextClass,actor,student,archives.get(id)));
        } catch (err) { results.push({studentId:id,success:false,error:err.status ? err.message : 'Could not save attendance. Please retry.'}); }
    }
    if (!cancel && locked && original.studentIds.every(id=>results.some(r=>r.studentId===id && r.success) || (byId.get(id)?.attendance || []).some(r=>r.classId===event.id))) {
        try {locked=(await item(container,locked).patch([{op:'set',path:'/attendanceComplete',value:true}],{accessCondition:{type:'IfMatch',condition:locked._etag}})).resource;}
        catch (err) {if (!conflict(err)) throw err; locked=await readEvent(container,event.id);}
    }
    return {success:results.every(r => r.success),results,event:locked || original};
}
module.exports = { ensureCalendar, listEvents, readEvent, saveEvent, recordBatch, recordOne };
