const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const functionsDir = path.join(__dirname, 'api', 'src', 'functions');
const hooks = {};
const app = {
    hook: {
        preInvocation(handler) { hooks.before = handler; },
        postInvocation(handler) { hooks.after = handler; }
    }
};
vm.runInNewContext(fs.readFileSync(path.join(functionsDir, 'corsHooks.js'), 'utf8'), {
    require(name) {
        return name === '@azure/functions' ? { app } : require(path.join(functionsDir, name));
    }
});

async function invoke({ origin, method = 'POST', functionName = 'login', contentType = 'application/json' }) {
    const headers = new Headers({ 'Content-Type': contentType });
    if (origin !== undefined) headers.set('Origin', origin);
    let called = false;
    const context = {
        inputs: [{ headers, method }],
        invocationContext: { functionName, options: { trigger: { type: 'httpTrigger' } } },
        functionHandler: async () => {
            called = true;
            return { status: 401 };
        }
    };
    hooks.before(context);
    context.result = await context.functionHandler();
    hooks.after(context);
    return { called, status: context.result.status, allowOrigin: context.result.headers['Access-Control-Allow-Origin'] };
}

async function main() {
    const config = require('./staticwebapp.config.json');
    const [preflight] = config.routes;
    assert.equal(preflight.route, '/api/*');
    assert.equal(preflight.headers['Access-Control-Allow-Origin'], '*');
    assert.match(preflight.headers['Access-Control-Allow-Headers'], /X-Auth-Token/);
    assert.ok(!preflight.headers['Access-Control-Allow-Credentials']);
    assert.notEqual(config.globalHeaders['Access-Control-Allow-Origin'], '*');

    for (const origin of ['https://banban.quest', 'https://vpietri-stack.github.io', 'http://localhost:7074']) {
        assert.deepEqual(await invoke({ origin }), { called: true, status: 401, allowOrigin: origin });
    }
    assert.deepEqual(await invoke({}), { called: true, status: 401, allowOrigin: undefined });
    for (const origin of ['https://banban.quest.example', 'http://banban.quest', 'null']) {
        assert.deepEqual(await invoke({ origin }), { called: false, status: 403, allowOrigin: undefined });
    }
    assert.deepEqual(await invoke({
        origin: 'null', functionName: 'saveAnalytics', contentType: 'text/plain;charset=UTF-8'
    }), { called: true, status: 401, allowOrigin: undefined });
    for (const request of [
        { origin: 'null', functionName: 'saveAnalytics' },
        { origin: 'null', contentType: 'text/plain' },
        { origin: 'https://banban.quest.example', functionName: 'saveAnalytics', contentType: 'text/plain' }
    ]) {
        assert.deepEqual(await invoke(request), { called: false, status: 403, allowOrigin: undefined });
    }

    console.log('Azure API path policy, origin enforcement, and analytics beacon path passed.');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
