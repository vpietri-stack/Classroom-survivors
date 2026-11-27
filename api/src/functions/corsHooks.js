const { app } = require('@azure/functions');
const { isAllowedOrigin, withCors } = require('./shared/cors');

app.hook.preInvocation((context) => {
    if (context.invocationContext?.options?.trigger?.type !== 'httpTrigger') return;
    const request = context.inputs?.[0];
    const origin = request?.headers.get('Origin');
    if (!origin || request.method === 'OPTIONS' || isAllowedOrigin(origin)) return;

    // The page's no-referrer policy can make a text/plain sendBeacon origin
    // opaque. Keep that unload flush on the existing analytics auth path.
    const opaqueAnalyticsBeacon = origin === 'null' &&
        context.invocationContext.functionName === 'saveAnalytics' &&
        request.method === 'POST' &&
        /^text\/plain(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '');
    if (opaqueAnalyticsBeacon) return;

    context.functionHandler = async () => ({ status: 403, body: 'Forbidden.' });
});

app.hook.postInvocation((context) => {
    if (context.invocationContext?.options?.trigger?.type !== 'httpTrigger') return;
    const request = context.inputs?.[0];
    if (!request || !context.result) return;
    context.result = withCors(request, context.result);
});
