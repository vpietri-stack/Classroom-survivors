const { app } = require('@azure/functions');
const { validateApiKey } = require('./shared/validateApiKey');
const { getContainer } = require('./shared/db');
const auth = require('./shared/auth');
const service = require('./shared/classCalendarService');
const core = require('./shared/classCalendarCore');
const crypto = require('crypto');
function publicEvent({_etag,id,groupKey,teacher,classTime,startTime,endTime,studentIds,status,attendanceStarted,attendanceComplete,manual}) {
    return {etag:_etag,id,groupKey,teacher,classTime,startTime,endTime,studentIds,status,attendanceStarted,attendanceComplete,manual};
}

async function handler(request, context) {
    try {
        if (!validateApiKey(request)) return {status:403,body:'Forbidden.'};
        const gate = auth.requireAuth(request);
        if (gate.error) return gate.error;
        if (gate.token && !auth.isPrivileged(gate.token)) return auth.forbidden();
        const container = getContainer();
        if (request.method === 'GET') {
            const through = request.query.get('through') || core.beijingDate(Date.now());
            const from = request.query.get('from') || through.slice(0,7)+'-01';
            if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(+new Date(from)) || from > through) return {status:400,body:'Choose a valid calendar range.'};
            const events = (await service.ensureCalendar(container,through,Date.now(),{from,to:through})).map(publicEvent);
            const revision = crypto.createHash('sha256').update(JSON.stringify(events)).digest('hex');
            if (request.query.get('since') === revision) return {status:304,headers:{'Cache-Control':'private, no-store'}};
            return {status:200,headers:{'Cache-Control':'private, no-store'},jsonBody:{startDate:core.START_DATE,revision,events}};
        }
        const body = await request.json();
        if (body.action === 'edit') return {status:200,jsonBody:{success:true,event:publicEvent(await service.saveEvent(container,body))}};
        if (body.action === 'record' || body.action === 'cancel') {
            const result = await service.recordBatch(container,body,gate.token ? gate.token.sub : 'legacy');
            return {status:200,jsonBody:{...result,event:publicEvent(result.event)}};
        }
        return {status:400,body:'Unknown calendar action.'};
    } catch (err) {
        context.error('classCalendar failed:',err);
        return {status:err.status || 500,body:err.status ? err.message : 'Calendar request failed. Please retry.'};
    }
}
app.http('classCalendar',{route:'classCalendar',methods:['GET','POST'],authLevel:'anonymous',handler});
module.exports = {handler};
