#!/usr/bin/env node
/* download_speech_samples.js — pull the consented-student research recordings
 * out of Cosmos and write them to local WAV files plus a manifest.
 *
 * Run from api/:
 *   node download_speech_samples.js                     -> ../speech_samples/
 *   node download_speech_samples.js --out /tmp/samples  -> custom directory
 *   node download_speech_samples.js --limit 50
 *   node download_speech_samples.js --student student_andy_panyian
 *
 * Needs api/local.settings.json with COSMOS_ENDPOINT / COSMOS_KEY.
 * Output is gitignored: these are children's voices and must never be committed.
 *
 * The manifest is the label file for offline experiments — target is the ground
 * truth, transcript/pass/accuracy are what the SHIPPED scorer decided, so a
 * candidate model or scoring change can be compared against the same audio.
 */
const fs = require('fs');
const path = require('path');
const { CosmosClient } = require('@azure/cosmos');

function arg(name, fallback) {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = path.resolve(__dirname, arg('out', path.join('..', 'speech_samples')));
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

function slug(s, n = 40) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, n) || 'untitled';
}

function csvField(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

(async () => {
    const v = loadSettings();
    const client = new CosmosClient({ endpoint: v.COSMOS_ENDPOINT, key: v.COSMOS_KEY });
    const dbName = process.env.COSMOS_DB_NAME_OVERRIDE || 'Val-EslApp';
    const containerName = process.env.COSMOS_SPEECH_SAMPLES_CONTAINER || 'speech_samples';
    const container = client.database(dbName).container(containerName);

    const wavDir = path.join(OUT, 'wav');
    fs.mkdirSync(wavDir, { recursive: true });

    const q = ONLY_STUDENT
        ? { query: 'SELECT * FROM c WHERE c.studentId = @sid ORDER BY c.capturedAt', parameters: [{ name: '@sid', value: ONLY_STUDENT }] }
        : { query: 'SELECT * FROM c ORDER BY c.capturedAt' };
    const { resources } = await container.items.query(q, { maxItemCount: 200 }).fetchAll();
    if (!resources.length) {
        console.log('No samples stored yet in ' + dbName + '/' + containerName + '.');
        console.log('Capture opens when the SPEECH_SAMPLE_CONSENTED_IDS app setting is populated.');
        return;
    }
    const rows = LIMIT ? resources.slice(0, LIMIT) : resources;

    const COLS = ['file', 'id', 'studentId', 'student', 'capturedAt', 'capturedAtIso', 'target', 'transcript',
        'pass', 'accuracy', 'phoneticRatio', 'attempt', 'book', 'mode', 'audioMs', 'durMs', 'peak',
        'sampleRate', 'transcribeMs', 'blobBytes', 'details', 'ua'];
    const lines = [COLS.join(',')];

    let written = 0, skipped = 0, totalBytes = 0;
    const perStudent = new Map();
    for (const r of rows) {
        if (!r.wavBase64) { skipped++; continue; }
        let buf;
        try { buf = Buffer.from(String(r.wavBase64), 'base64'); } catch (_) { skipped++; continue; }
        if (buf.length < 44 || buf.toString('latin1', 0, 4) !== 'RIFF') { skipped++; continue; }

        const n = perStudent.get(r.studentId) || 0;
        perStudent.set(r.studentId, n + 1);
        const fname = `${slug(r.studentId, 34)}__${String(n).padStart(3, '0')}__${slug(r.target, 34)}.wav`;
        fs.writeFileSync(path.join(wavDir, fname), buf);
        written++; totalBytes += buf.length;

        lines.push([
            fname, r.id, r.studentId, r.student, r.capturedAt,
            r.capturedAt ? new Date(r.capturedAt).toISOString() : '',
            r.target, r.transcript, r.pass, r.accuracy, r.phoneticRatio, r.attempt, r.book, r.mode,
            r.audioMs, r.durMs, r.peak, r.sampleRate, r.transcribeMs, buf.length, r.details, r.ua
        ].map(csvField).join(','));
    }

    fs.writeFileSync(path.join(OUT, 'manifest.csv'), lines.join('\n') + '\n');

    console.log(`Samples in Cosmos      : ${resources.length}`);
    console.log(`Written to ${path.relative(process.cwd(), OUT) || OUT}`);
    console.log(`  WAV files            : ${written}  (${(totalBytes / 1048576).toFixed(1)} MB)`);
    console.log(`  skipped (no/invalid) : ${skipped}`);
    console.log(`  manifest.csv         : ${lines.length - 1} rows`);
    console.log(`\nPer student:`);
    [...perStudent.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, n]) => console.log(`  ${String(n).padStart(4)}  ${id}`));
    console.log(`\nNOTE: this directory contains children's voice recordings. It is gitignored —`);
    console.log(`      never commit it, and delete it once the calibration work is done.`);
})().catch(e => { console.error('Download failed:', e.message); process.exit(1); });
