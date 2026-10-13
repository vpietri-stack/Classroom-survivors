const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');
const core = require('./shared/targetReportsCore');

async function buildReports(container, teacher, now = Date.now()) {
    // Project only report data; never return passwords, IDs, or exercise payloads.
    const {resources:students}=await container.items.query({
        query:"SELECT c.id, c.fullName, c.name, c.login, c.avatar, c.teacher, c.classTime, c.targets, ARRAY(SELECT VALUE e FROM e IN c.analytics WHERE e.type = 'session') AS analytics FROM c WHERE c.teacher = @teacher AND (c.role = 'student' OR NOT IS_DEFINED(c.role)) AND NOT IS_DEFINED(c.type)",
        parameters:[{name:'@teacher',value:teacher}]
    }).fetchAll();
    const rows=new Array(students.length);
    let cursor=0;
    async function worker() {
        while (cursor<students.length) {
            const index=cursor++, student=students[index], target=core.selectTarget(student,now);
            let archived=[];
            if (target && +new Date(target.startTime)<=now) {
                const {resources}=await container.items.query({
                    query:"SELECT VALUE e FROM c JOIN e IN c.events WHERE c.type = 'student_analytics_archive' AND c.studentId = @id AND e.type = 'session' AND e.timestamp >= @from AND e.timestamp <= @to",
                    parameters:[{name:'@id',value:student.id},{name:'@from',value:new Date(target.startTime).toISOString()},{name:'@to',value:new Date(Math.min(now,+new Date(target.endTime))).toISOString()}]
                },{partitionKey:student.id}).fetchAll();
                archived=resources;
            }
            rows[index]=core.row(student,target,[...(student.analytics || []),...archived],now);
        }
    }
    await Promise.all(Array.from({length:Math.min(3,students.length)},worker));
    return {teacher,generatedAt:new Date(now).toISOString(),groups:core.groups(rows)};
}
async function handler(request,context) {
    if (!validateApiKey(request)) return {status:403,body:'Forbidden.'};
    const {token}=auth.requireAuth(request);
    if ((!token && auth.enforceAuth()) || (token && !auth.isPrivileged(token,['BM','admin']))) return auth.unauthorized();
    const teacher=(request.query.get('teacher') || '').trim();
    if (!teacher || teacher.length>120) return {status:400,jsonBody:{error:'Select a teacher.'}};
    try { return {status:200,headers:{'Cache-Control':'no-store'},jsonBody:await buildReports(getContainer(),teacher)}; }
    catch(err) {context.error('Target report failed:',err);return {status:500,jsonBody:{error:'Could not load complete target data. Please retry.'}};}
}
app.http('getTargetReports',{methods:['GET'],authLevel:'anonymous',handler});
module.exports={buildReports,handler};
