const crypto = require('crypto');
const {liveSessions} = require('./practiceReads');
const calendar = require('./classCalendarCore');
const reports = require('./targetReportsCore');
const snapshots = new WeakMap();
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields = 'c.id, c.login, c.fullName, c.avatar, c.role, c.teacher, c.classTime, c.classGroups, c.book, c.unit, c.page, c.needsPasswordChange, c.targets, c.attendance, c.geo';
function compactStudent(student, now = Date.now()) {
    const {analytics, targets, ...metadata} = student;
    const days = new Map(), seen = new Set();
    for (const e of analytics || []) {
        if (typeof e.timestamp !== 'string' || !Number.isFinite(+new Date(e.timestamp))) continue;
        const key=e.eventId || `${e.type}:${e.sessionType}:${e.timestamp}`;
        if (seen.has(key)) continue; seen.add(key);
        const day=e.timestamp.slice(0,10);
        if (!days.has(day)) days.set(day,[day,0,0,0]);
        const row=days.get(day);row[1]++;
        if (e.sessionType==='study') {row[2]++;row[3]+=Number(e.data?.durationMs) || 0;}
    }
    const chosen = [...new Set(calendar.memberships(student).map(g=>reports.selectTarget(student,now,calendar.groupKey(g.teacher,g.classTime))).filter(Boolean))];
    const targetCounts = Object.fromEntries(chosen.map(t=>[calendar.targetCountKey(t),calendar.countPractice(analytics,t,now)]));
    return {...metadata,targets:chosen,targetCounts,sessionDays:[...days.values()].sort((a,b)=>a[0].localeCompare(b[0])),_summary:true};
}

async function dashboardData(container, {secure = false, since = ''} = {}) {
    const {resources} = await container.items.query(`SELECT ${fields}${secure ? ', c.password' : ''}, ${liveSessions} FROM c WHERE (c.role = 'student' OR NOT IS_DEFINED(c.role)) AND (NOT IS_DEFINED(c.type) OR c.type <> 'student_analytics_archive')`).fetchAll();
    const students = resources.map(s => compactStudent(s)).sort((a,b) => a.id.localeCompare(b.id));
    const hashes = new Map(students.map(s => [s.id, digest(s)])), revision = digest([...hashes]);
    if (revision === since) return {status:304, headers:{'Cache-Control':'private, no-store'}};
    let cache = snapshots.get(container);
    if (!cache) {cache = new Map(); snapshots.set(container, cache);}
    const previous = cache.get(`${secure}:${since}`);
    const data = {revision, full:!previous, students:previous ? students.filter(s => previous.get(s.id) !== hashes.get(s.id)) : students,
        removed:previous ? [...previous.keys()].filter(id => !hashes.has(id)) : []};
    cache.set(`${secure}:${revision}`, hashes);
    while (cache.size > 12) cache.delete(cache.keys().next().value);
    return {status:200, headers:{'Cache-Control':'private, no-store'}, jsonBody:data};
}
module.exports = {dashboardData, compactStudent};
