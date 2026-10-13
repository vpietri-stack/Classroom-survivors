const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');
const service = require('./shared/classCalendarService');
const core = require('./shared/classCalendarCore');

async function handler(request, context) {
    try {
        if (!validateApiKey(request)) return {status:403,body:'Forbidden.'};
        const gate = auth.requireAuth(request);
        if (gate.error) return gate.error;
        if (gate.token && !auth.isPrivileged(gate.token)) return auth.forbidden();
        const container = getContainer();
        if (request.method === 'GET') {
            const events = await service.ensureCalendar(container,request.query.get('through') || core.beijingDate(Date.now()));
            return {status:200,jsonBody:{startDate:core.START_DATE,events:events.map(({_etag,id,groupKey,teacher,classTime,startTime,endTime,studentIds,status,attendanceStarted,manual}) => ({etag:_etag,id,groupKey,teacher,classTime,startTime,endTime,studentIds,status,attendanceStarted,manual}))}};
        }
        const body = await request.json();
        if (body.action === 'edit') return {status:200,jsonBody:{success:true,event:await service.saveEvent(container,body)}};
        if (body.action === 'record' || body.action === 'cancel') return {status:200,jsonBody:await service.recordBatch(container,body,gate.token ? gate.token.sub : 'legacy')};
        return {status:400,body:'Unknown calendar action.'};
    } catch (err) {
        context.error('classCalendar failed:',err);
        return {status:err.status || 500,body:err.status ? err.message : 'Calendar request failed. Please retry.'};
    }
}
app.http('classCalendar',{route:'classCalendar',methods:['GET','POST'],authLevel:'anonymous',handler});
module.exports = {handler};
