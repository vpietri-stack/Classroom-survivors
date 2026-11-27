const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function values(pathname, search = '', hostname = 'vpietri-stack.github.io') {
    const context = { location: { hostname, pathname, search, protocol: 'https:' }, URLSearchParams };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('config.js', 'utf8'), context);
    return { ...vm.runInContext(`({
        api: API_BASE_URL, speech: SPEECH_PRACTICE_ENABLED, study: STUDY_RESUME_ENABLED,
        game: GAME_RESUME_ENABLED, mixed: NON_SPELLING_ENABLED, td: TD_ENABLED, threeD: THREE_TD_ENABLED
    })`, context) };
}

const production = values('/Classroom-survivors/');
const preview = values('/Classroom-survivors-preview/');
const banban = values('/', '', 'banban.quest');
assert.equal(production.api, 'https://brave-bush-0438ab000.7.azurestaticapps.net/api');
assert.equal(preview.api, 'https://brave-bush-0438ab000-1.eastasia.7.azurestaticapps.net/api');
assert.deepEqual(banban, production);
assert.deepEqual(values('/index.html', '', 'banban.quest'), production);
assert.deepEqual(values('/teacher_dashboard.html', '', 'banban.quest'), production);
assert.deepEqual(values('/Classroom-survivors-preview/', '', 'banban.quest'), production);
for (const site of [production, preview, banban]) {
    for (const key of ['speech', 'study', 'game', 'mixed']) assert.equal(site[key], true, key);
}
assert.equal(production.td, false);
assert.equal(production.threeD, false);
assert.equal(values('/Classroom-survivors/', '?resume=0').study, false);
assert.equal(values('/Classroom-survivors/', '?gameResume=0').game, false);
assert.equal(values('/', '?resume=0', 'banban.quest').study, false);
assert.equal(values('/', '?gameResume=0', 'banban.quest').game, false);
assert.equal(values('/unrelated/', '?resume=1&gameResume=1').study, false);
assert.equal(values('/', '', 'banban.quest.example').study, false);

console.log('Production, custom-domain, and preview release gates preserve API routing and feature isolation.');
