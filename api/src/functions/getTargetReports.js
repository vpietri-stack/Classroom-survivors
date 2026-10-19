const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');
const core = require('./shared/targetReportsCore');
const calendar = require('./shared/classCalendarCore');
const {liveSessions, readArchivedPractice, reportTasks} = require('./shared/practiceReads');

async function buildReports(container, teacher, now = Date.now()) {
    // Export rows contain no credentials, account IDs or exercise payloads.
    const {resources:students}=await container.items.query({
        query:`SELECT c.id, c.fullName, c.name, c.login, c.avatar, c.teacher, c.classTime, c.classGroups, c.targets, ${liveSessions} FROM c WHERE (c.teacher = @teacher OR ARRAY_CONTAINS(c.classGroups, @membership, true)) AND (c.role = 'student' OR NOT IS_DEFINED(c.role)) AND NOT IS_DEFINED(c.type)`,
        parameters:[{name:'@teacher',value:teacher},{name:'@membership',value:{teacher}}]
    }).fetchAll();
    const tasks=reportTasks(students,teacher,now);
    const archived=await readArchivedPractice(container,tasks.filter(t=>t.target && +new Date(t.target.startTime)<=now)
        .map(t=>({id:t.student.id,from:t.target.startTime,to:new Date(Math.min(now,+new Date(t.target.endTime))).toISOString()})));
    const updates=new Map();
    const rows=tasks.map(({student,group,key,target})=>{
        const row=core.row({...student,...group},target,[...(student.analytics || []),...(archived.get(student.id) || [])],now);
        if (!updates.has(student.id)) updates.set(student.id,{id:student.id,groupProgress:[]});
        updates.get(student.id).groupProgress.push({key,target,completed:row.completed});
        return row;
    });
    return {teacher,generatedAt:new Date(now).toISOString(),groups:core.groups(rows),progressUpdates:[...updates.values()]};
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
