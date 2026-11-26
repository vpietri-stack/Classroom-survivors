// Verify the actual menu markup and gate without a CDN or the Phaser engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const html = read('index.html');
const config = read('config.js');
const towerDefense = read('tower_defense.js');

function checkTarget(url, enabled, loadConfig = true) {
    const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    const { window } = dom;
    const { document } = window;
    const button = document.getElementById('towerDefenseBtn');
    let clicks = 0;
    button.addEventListener('click', () => clicks++);
    assert.equal(button.disabled, true, 'First render must disable Tower Defense');
    button.click();
    assert.equal(clicks, 0, 'First render must block clicks');

    const menuGate = document.getElementById('game-selection-gates').textContent;
    window.eval((loadConfig ? config : '') + '\n' + menuGate);
    assert.equal(button.disabled, !enabled, url);
    assert.equal(Boolean(button.querySelector('.td-coming-soon')), !enabled, url);
    button.click();
    assert.equal(clicks, enabled ? 1 : 0, url);

    if (!enabled) {
        window.Phaser = { Scene: function () {} };
        window.registerScene = () => {};
        window.activeGameMode = null;
        window.eval((loadConfig ? config : '') + '\n' + towerDefense + '\ntriggerTowerDefense();');
        assert.equal(window.activeGameMode, null, 'Disabled targets must block direct launches');
    }
    window.close();
}

const live = 'https://vpietri-stack.github.io/Classroom-survivors/';
const preview = 'https://vpietri-stack.github.io/Classroom-survivors-preview/';
checkTarget(live + 'index.html', false);
checkTarget(live + '?td=1', false);
checkTarget(live, false, false);
checkTarget('https://banban.quest/', false);
checkTarget(preview + 'index.html', true);
checkTarget(preview + '?td=0', false);
checkTarget('http://localhost:8080/index.html?td=1', true);
checkTarget('file:///D:/coding/index.html', true);
console.log('Tower Defense menu and launch gates passed on all 8 targets.');
