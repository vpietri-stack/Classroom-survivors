const { app } = require('@azure/functions');
const { withCors } = require('./shared/cors');

app.hook.postInvocation((context) => {
    if (context.invocationContext?.options?.trigger?.type !== 'httpTrigger') return;
    const request = context.inputs?.[0];
    if (!request || !context.result) return;
    context.result = withCors(request, context.result);
});
