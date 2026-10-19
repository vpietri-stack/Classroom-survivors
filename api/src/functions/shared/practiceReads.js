const calendar = require('./classCalendarCore');

// Only fields needed by counters, averages and the short-loss rule; no exercise payloads.
const sessionValue = `{ "type": e.type, "eventId": e.eventId, "timestamp": e.timestamp, "sessionType": e.sessionType, "data": IIF(IS_OBJECT(e.data), { "durationMs": e.data.durationMs, "totalTimeSec": e.data.totalTimeSec, "survivalTimeSec": e.data.survivalTimeSec, "won": e.data.won, "winner": e.data.winner, "result": e.data.result, "ignored": e.data.ignored }, e.data) }`;
const liveSessions = `ARRAY(SELECT VALUE ${sessionValue} FROM e IN c.analytics WHERE e.type = 'session') AS analytics`;

async function readArchivedPractice(container, windows) {
    const merged = new Map();
    for (const {id, from, to} of windows) {
        if (!Number.isFinite(+new Date(from)) || !Number.isFinite(+new Date(to)) || +new Date(to) < +new Date(from)) continue;
        const value = merged.get(id);
        merged.set(id, {id, from:value && +new Date(value.from) < +new Date(from) ? value.from : from,
            to:value && +new Date(value.to) > +new Date(to) ? value.to : to});
    }
    const values = [...merged.values()], result = new Map(values.map(w => [w.id, []]));
    // One bounded query per 20 students, rather than a round trip for every student/group.
    for (let start = 0; start < values.length; start += 20) {
        const batch = values.slice(start, start + 20), parameters = [];
        const clauses = batch.map((w,i) => {
            parameters.push({name:`@id${i}`,value:w.id}, {name:`@from${i}`,value:new Date(w.from).toISOString()}, {name:`@to${i}`,value:new Date(w.to).toISOString()});
            return `(c.studentId = @id${i} AND e.timestamp >= @from${i} AND e.timestamp <= @to${i})`;
        });
        const {resources} = await container.items.query({
            query:`SELECT c.studentId, ${sessionValue} AS event FROM c JOIN e IN c.events WHERE c.type = 'student_analytics_archive' AND e.type = 'session' AND (${clauses.join(' OR ')})`, parameters
        }, batch.length === 1 ? {partitionKey:batch[0].id} : undefined).fetchAll();
        for (const row of resources) if (result.has(row.studentId)) result.get(row.studentId).push(row.event);
    }
    return result;
}

function reportTasks(students, teacher, now) {
    const core = require('./targetReportsCore');
    return students.flatMap(student => calendar.memberships(student).filter(g => !teacher || g.teacher === teacher)
        .map(group => ({student, group, key:calendar.groupKey(group.teacher,group.classTime),
            target:core.selectTarget(student,now,calendar.groupKey(group.teacher,group.classTime))})));
}
module.exports = {liveSessions, sessionValue, readArchivedPractice, reportTasks};
