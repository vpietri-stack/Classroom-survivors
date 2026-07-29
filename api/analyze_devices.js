/* =========================================================================
 * analyze_devices.js — OS census report from the `type:'device'` login
 * telemetry (queueDeviceInfoEvent in frontend_auth.js, shipped 2026-07-29a).
 * Answers: which OS do students actually play on, per student and overall,
 * to decide whether an APK/EXE sideload build is worth making.
 *
 * Classification notes:
 *   - iPadOS Safari reports "Macintosh" in the UA. A Mac UA with
 *     maxTouchPoints > 1 is an iPad — counted as iOS/iPadOS.
 *   - HarmonyOS NEXT (OpenHarmony/ArkWeb) is counted separately: it cannot
 *     sideload APKs, so it matters for the APK decision.
 *   - Some Harmony tablets in desktop mode also spoof "Windows NT"; the
 *     OpenHarmony token wins over the Windows token.
 *
 * Usage (from api/, needs local.settings.json with COSMOS_ENDPOINT/KEY):
 *   node analyze_devices.js                # all device events ever logged
 *   node analyze_devices.js --days 30      # only the last N days
 * ========================================================================= */
const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');

const endpoint = config.Values.COSMOS_ENDPOINT;
const key = config.Values.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });
const container = client.database('Val-EslApp').container('Students');

const args = process.argv.slice(2);
function argVal(name, dflt) {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const DAYS = parseFloat(argVal('--days', '0')); // 0 = no time filter
const SINCE = DAYS > 0 ? Date.now() - DAYS * 86400 * 1000 : 0;

function classifyOS(ev) {
    const ua = ev.ua || '';
    const touch = ev.maxTouchPoints || 0;
    if (/OpenHarmony|ArkWeb|HarmonyOS/i.test(ua)) return 'HarmonyOS';
    if (/iPhone|iPod/i.test(ua)) return 'iOS (iPhone)';
    if (/iPad/i.test(ua)) return 'iOS (iPad)';
    // iPadOS desktop-mode Safari: Mac UA + real touchscreen = iPad.
    if (/Macintosh/i.test(ua)) return touch > 1 ? 'iOS (iPad, desktop UA)' : 'macOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows NT/i.test(ua)) return 'Windows';
    if (/X11; Linux/i.test(ua)) return /MiuiBrowser|XiaoMi/i.test(ua) ? 'Android (Xiaomi desktop UA)' : 'Linux';
    return 'Unknown';
}

// Collapse the fine-grained labels into the buckets that matter for the
// APK/EXE decision.
function bucket(os) {
    if (os.startsWith('iOS') || os === 'macOS') return 'iOS/iPadOS';
    if (os.startsWith('Android')) return 'Android (APK OK)';
    if (os === 'HarmonyOS') return 'HarmonyOS (no APK)';
    if (os === 'Windows') return 'Windows (EXE OK)';
    return 'Other';
}

function pad(s, w) { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); }

async function main() {
    console.log('Pulling students…' + (DAYS > 0 ? ` (window: last ${DAYS}d)` : ' (all time)'));
    const { resources: students } = await container.items.query({
        query: 'SELECT c.id, c.fullName, c.analytics FROM c'
    }).fetchAll();

    const rows = [];        // { name, osSet, logins, lastSeen }
    const osStudents = {};  // os -> Set(name)
    const bucketStudents = {}; // bucket -> Set(name)
    let totalEvents = 0;

    for (const s of students) {
        const evs = (s.analytics || []).filter(e =>
            e && e.type === 'device' && Date.parse(e.timestamp || 0) >= SINCE);
        if (evs.length === 0) continue;
        totalEvents += evs.length;
        const name = s.fullName || s.id;
        const osSet = new Set(evs.map(classifyOS));
        const lastSeen = evs.map(e => e.timestamp).sort().pop().slice(0, 10);
        rows.push({ name, osSet, logins: evs.length, lastSeen });
        for (const os of osSet) {
            (osStudents[os] = osStudents[os] || new Set()).add(name);
            const b = bucket(os);
            (bucketStudents[b] = bucketStudents[b] || new Set()).add(name);
        }
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`\n${rows.length} students with device events (${totalEvents} login-days logged)\n`);
    console.log(pad('Student', 14) + pad('Login-days', 12) + pad('Last seen', 12) + 'OS');
    console.log('-'.repeat(70));
    for (const r of rows) {
        console.log(pad(r.name, 14) + pad(r.logins, 12) + pad(r.lastSeen, 12) + [...r.osSet].join(', '));
    }

    console.log('\n---- Per-OS student counts (a multi-device student counts in each) ----');
    for (const [os, set] of Object.entries(osStudents).sort((a, b) => b[1].size - a[1].size)) {
        console.log(pad(os, 28) + set.size + '  (' + [...set].join(', ') + ')');
    }

    console.log('\n---- APK/EXE decision buckets ----');
    for (const [b, set] of Object.entries(bucketStudents).sort((a, b) => b[1].size - a[1].size)) {
        const pct = Math.round(100 * set.size / rows.length);
        console.log(pad(b, 22) + pad(set.size, 5) + pct + '%');
    }
}

main().catch(e => { console.error(e); process.exit(1); });
