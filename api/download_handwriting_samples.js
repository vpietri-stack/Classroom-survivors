#!/usr/bin/env node
/* download_handwriting_samples.js — pull the stored handwriting traces out of
 * Cosmos and write them to a per-letter CSV plus the raw documents.
 *
 * Run from api/:
 *   node download_handwriting_samples.js                     -> ../handwriting_samples/
 *   node download_handwriting_samples.js --out /tmp/traces   -> custom directory
 *   node download_handwriting_samples.js --limit 200
 *   node download_handwriting_samples.js --student student_andy_panyian
 *
 * Needs api/local.settings.json with COSMOS_ENDPOINT / COSMOS_KEY.
 * Output is gitignored: these are children's handwriting samples tied to a
 * student id, and the repository is public.
 *
 * The CSV is the label file for tuning. Each row is ONE judged letter: `ch` is
 * the ground truth, `ok` is what the SHIPPED geometry decided, and the p/r/mi
 * columns are the numbers behind that decision — so a candidate change to the
 * bars can be scored against the same ink without re-running a classroom.
 */
const fs = require('fs');
const path = require('path');
const { CosmosClient } = require('@azure/cosmos');

function arg(name, fallback) {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = path.resolve(__dirname, arg('out', path.join('..', 'handwriting_samples')));
const LIMIT = Number(arg('limit', '0')) || 0;
const ONLY_STUDENT = arg('student', '');

function loadSettings() {
    const p = path.join(__dirname, 'local.settings.json');
    if (!fs.existsSync(p)) {
        console.error('api/local.settings.json not found — cannot reach Cosmos.');
        process.exit(1);
    }
    const v = require(p).Values || {};
    if (!v.COSMOS_ENDPOINT || !v.COSMOS_KEY) {
        console.error('COSMOS_ENDPOINT / COSMOS_KEY missing from local.settings.json');
        process.exit(1);
    }
    return v;
}

function csvField(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// [x0,y0,x1,y1,...] -> "x0,y0 x1,y1 ..."; strokes separated by "|".
function strokesToString(strokes) {
    if (!Array.isArray(strokes)) return '';
    return strokes
        .map(s => {
            const pts = [];
            for (let i = 0; i + 1 < s.length; i += 2) pts.push(s[i] + ',' + s[i + 1]);
            return pts.join(' ');
        })
        .join('|');
}

function pointCount(strokes) {
    if (!Array.isArray(strokes)) return 0;
    return strokes.reduce((n, s) => n + (Array.isArray(s) ? Math.floor(s.length / 2) : 0), 0);
}

(async () => {
    const v = loadSettings();
    const client = new CosmosClient({ endpoint: v.COSMOS_ENDPOINT, key: v.COSMOS_KEY });
    const dbName = process.env.COSMOS_DB_NAME_OVERRIDE || 'Val-EslApp';
    const containerName = process.env.COSMOS_HANDWRITING_SAMPLES_CONTAINER || 'handwriting_samples';
    const container = client.database(dbName).container(containerName);

    fs.mkdirSync(OUT, { recursive: true });

    const q = ONLY_STUDENT
        ? { query: 'SELECT * FROM c WHERE c.studentId = @sid ORDER BY c.capturedAt', parameters: [{ name: '@sid', value: ONLY_STUDENT }] }
        : { query: 'SELECT * FROM c ORDER BY c.capturedAt' };
    const { resources } = await container.items.query(q, { maxItemCount: 500 }).fetchAll();
    if (!resources.length) {
        console.log('No traces stored yet in ' + dbName + '/' + containerName + '.');
        console.log('Capture opens when the HANDWRITING_SAMPLE_IDS app setting is set (`*` = every student).');
        return;
    }
    const docs = LIMIT ? resources.slice(0, LIMIT) : resources;

    const COLS = ['studentId', 'student', 'capturedAt', 'capturedAtIso', 'word', 'pos', 'ch', 'ok', 'att',
        'gui', 'rev', 'ms', 'p', 'r', 'mi', 'wr', 'hr', 'gc', 'st', 'mn', 'ov', 'points', 'strokes',
        'book', 'unit', 'mode', 'engine', 'size', 'pen', 'tol', 'boxPx', 'dpr', 'ua'];
    const lines = [COLS.join(',')];
    const jsonl = [];

    let letters = 0, accepts = 0, firstTry = 0, reveals = 0;
    const perStudent = new Map();
    const perLetter = new Map();

    for (const d of docs) {
        jsonl.push(JSON.stringify(d));
        const list = Array.isArray(d.letters) ? d.letters : [];
        const n = perStudent.get(d.studentId) || 0;
        perStudent.set(d.studentId, n + list.length);
        list.forEach((l, i) => {
            letters++;
            if (l.ok) accepts++;
            if (l.ok && l.att === 1) firstTry++;
            if (l.rev) reveals++;
            const key = String(l.ch || '?');
            const t = perLetter.get(key) || { tries: 0, ok: 0, rev: 0 };
            t.tries++;
            if (l.ok) t.ok++;
            if (l.rev) t.rev++;
            perLetter.set(key, t);

            lines.push([
                d.studentId, d.student, d.capturedAt,
                d.capturedAt ? new Date(d.capturedAt).toISOString() : '',
                d.word, i, l.ch, l.ok, l.att, l.gui, l.rev, l.ms,
                l.p, l.r, l.mi, l.wr, l.hr, l.gc, l.st, l.mn, l.ov,
                pointCount(l.s), strokesToString(l.s),
                d.book, d.unit, d.mode, d.engine, d.size, d.pen, d.tol, d.boxPx, d.dpr, d.ua
            ].map(csvField).join(','));
        });
    }

    fs.writeFileSync(path.join(OUT, 'manifest.csv'), lines.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'words.jsonl'), jsonl.join('\n') + '\n');

    console.log(`Word documents in Cosmos : ${resources.length}`);
    console.log(`Written to ${path.relative(process.cwd(), OUT) || OUT}`);
    console.log(`  manifest.csv           : ${lines.length - 1} letter rows`);
    console.log(`  words.jsonl            : ${docs.length} documents`);
    console.log(`\nLetters judged           : ${letters}`);
    console.log(`  accepted               : ${accepts} (${letters ? Math.round(accepts / letters * 100) : 0}%)`);
    console.log(`  …of those on try 1     : ${firstTry} (${accepts ? Math.round(firstTry / accepts * 100) : 0}% of accepts, ${letters ? Math.round(firstTry / letters * 100) : 0}% of all)`);
    console.log(`  revealed (gave up)     : ${reveals}`);

    // The actionable table: which letters the shipped geometry refuses most.
    console.log(`\nPer target letter (tries / accepted / revealed / refuse rate):`);
    [...perLetter.entries()]
        .sort((a, b) => (b[1].rev / b[1].tries) - (a[1].rev / a[1].tries) || b[1].tries - a[1].tries)
        .slice(0, 30)
        .forEach(([ch, t]) => {
            const refused = t.tries - t.ok;
            console.log(`  ${ch.padEnd(2)} ${String(t.tries).padStart(5)} ${String(t.ok).padStart(6)} ${String(t.rev).padStart(6)}   ${Math.round(refused / t.tries * 100)}%`);
        });

    console.log(`\nPer student (letters):`);
    [...perStudent.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, n]) => console.log(`  ${String(n).padStart(5)}  ${id}`));

    console.log(`\nNOTE: this directory contains children's handwriting tied to a student id. It is`);
    console.log(`      gitignored — never commit it, and delete it when the tuning work is done.`);
})().catch(e => { console.error('Download failed:', e.message); process.exit(1); });
