const crypto = require('crypto');
const core = require('./classCalendarCore');

function error(message, status = 400) { return Object.assign(new Error(message), { status }); }
function conflict(err) { return Number(err.code || err.statusCode) === 412; }
function item(container, doc) { return container.item(doc.id, doc.studentId === undefined ? undefined : doc.studentId); }
async function findStudent(container, id) {
    const { resources } = await container.items.query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] }).fetchAll();
    const doc = resources[0];
    if (!doc || (doc.role && doc.role !== 'student') || doc.type === 'student_analytics_archive') throw error('Student not found', 404);
    return doc;
}
async function listEvents(container) {
    const { resources } = await container.items.query("SELECT * FROM c WHERE c.role = 'classCalendar'").fetchAll();
    return resources.sort((a,b) => a.startTime.localeCompare(b.startTime));
}
async function ensureCalendar(container, through, now = Date.now()) {
    const today = core.beijingDate(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(through) || !Number.isFinite(+new Date(through)) || through < core.START_DATE || through > core.beijingDate(now + 366 * core.DAY)) throw error('Calendar date must be between 12 October 2026 and one year ahead.');
    const end = core.beijingDate(Math.max(+new Date(through + 'T23:59:59+08:00'), now) + 35 * core.DAY);
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
    const existing = await listEvents(container);
    for (const event of existing) {
        if (!event.manual && !event.attendanceStarted && event.status === 'scheduled' && +new Date(event.startTime) > now && !groups.has(event.groupKey)) {
            try { await item(container,event).patch([{op:'set',path:'/status',value:'retired'}], {accessCondition:{type:'IfMatch',condition:event._etag}}); }
            catch (err) { if (!conflict(err)) throw err; }
        }
    }
    const byId = new Map(existing.map(e => [e.id,e]));
    const knownGroups = new Set(existing.map(e => e.groupKey));
    for (const [key, group] of groups) {
        const from = existing.length && !knownGroups.has(key) ? today : core.START_DATE;
        for (const event of core.occurrences(group, from, end)) {
            const id = 'class_' + crypto.createHash('sha256').update(key + '|' + core.beijingDate(event.startTime)).digest('hex').slice(0,32);
            const saved = byId.get(id);
            if (saved) {
                if (saved.status === 'retired' && +new Date(saved.startTime) > now) {
                    try { await item(container,saved).patch([{op:'set',path:'/status',value:'scheduled'},{op:'set',path:'/studentIds',value:group.studentIds}], {accessCondition:{type:'IfMatch',condition:saved._etag}}); }
                    catch (err) { if (!conflict(err)) throw err; }
                }
                // Retain historic rosters and edited times. Future rosters follow group membership even after rescheduling.
                if (!saved.attendanceStarted && saved.status === 'scheduled' && +new Date(saved.startTime) > now && JSON.stringify(saved.studentIds) !== JSON.stringify(group.studentIds)) {
                    try { await item(container, saved).patch([{ op: 'set', path: '/studentIds', value: group.studentIds }], { accessCondition: { type: 'IfMatch', condition: saved._etag } }); }
                    catch (err) { if (!conflict(err)) throw err; }
                }
                continue;
            }
            try { await container.items.create({ ...event, id, studentId: id, role: 'classCalendar' }); }
            catch (err) { if (Number(err.code || err.statusCode) !== 409) throw err; }
        }
    }
    return listEvents(container);
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
async function recordOne(container, event, studentId, status, nextClass, actor) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const student = await findStudent(container,studentId);
        const receipt = (student.attendance || []).find(r => r.classId === event.id);
        if (receipt) return { studentId, success:true, duplicate:true, attendance:student.attendance, targets:student.targets || [] };
        let analytics = student.analytics || [];
        if (status === 'missed') {
            // Archived practice is just as valid as the live tail when deciding earned carry-over.
            const { resources } = await container.items.query({ query:"SELECT c.events FROM c WHERE c.type = 'student_analytics_archive' AND c.studentId = @id", parameters:[{name:'@id',value:studentId}] }).fetchAll();
            analytics = analytics.concat(resources.flatMap(a => a.events || []));
        }
        const targets = core.updateTargets(student,event,status,nextClass,analytics);
        const attendance = [...(student.attendance || []), { classId:event.id, startTime:event.startTime, endTime:event.endTime, classTime:event.classTime, teacher:event.teacher, status, recordedAt:new Date().toISOString(), recordedBy:actor }];
        try {
            await item(container,student).patch([{op:'set',path:'/attendance',value:attendance}, {op:'set',path:'/targets',value:targets}], {accessCondition:{type:'IfMatch',condition:student._etag}});
            return { studentId, success:true, attendance, targets };
        } catch (err) { if (!conflict(err)) throw err; }
    }
    throw error('Student changed concurrently. Please retry.',409);
}
async function recordBatch(container, body, actor) {
    const cancel = body.action === 'cancel';
    if (!cancel && !['attended','missed'].includes(body.status)) throw error('Choose attended or missed.');
    const events = await ensureCalendar(container,core.beijingDate(Date.now() + 35 * core.DAY));
    const original = await readEvent(container,body.eventId);
    const ids = cancel ? original.studentIds : body.studentIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some(id => !original.studentIds.includes(id))) throw error('Select students belonging to this class (maximum 200).');
    if (!cancel && original.status !== 'scheduled') throw error('This class is no longer scheduled.');
    if (!cancel && +new Date(original.endTime) > Date.now()) throw error('Attendance is available after the class ends.');
    const event = cancel ? await lockEvent(container,body.eventId,true,original) : original;
    const nextClass = events.find(e => e.groupKey === event.groupKey && e.status === 'scheduled' && +new Date(e.startTime) > +new Date(event.endTime));
    const results = [];
    for (const id of [...new Set(ids)]) {
        try {
            // Chronology is independent for each of a student's groups.
            const student = await findStudent(container,id);
            const pendingEarlier = events.find(e => e.groupKey === event.groupKey && e.status === 'scheduled' && e.studentIds.includes(id) && +new Date(e.endTime) <= Date.now() && +new Date(e.startTime) < +new Date(event.startTime) && !(student.attendance || []).some(r => r.classId === e.id));
            if (!cancel && pendingEarlier) throw error('Record this student’s earlier class first.');
            const locked = cancel ? event : await lockEvent(container,event.id,false,event);
            results.push(await recordOne(container,locked,id,cancel ? 'cancelled' : body.status,nextClass,actor));
        } catch (err) { results.push({studentId:id,success:false,error:err.status ? err.message : 'Could not save attendance. Please retry.'}); }
    }
    return {success:results.every(r => r.success),results};
}
module.exports = { ensureCalendar, listEvents, readEvent, saveEvent, recordBatch, recordOne };
