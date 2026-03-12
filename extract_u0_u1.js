const fs = require('fs');

const transContent = fs.readFileSync('translations.js', 'utf8');
const existingKeys = new Set();
const keyRegex = /^\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*:/gm;
let match;
while ((match = keyRegex.exec(transContent)) !== null) {
    try {
        let key = eval(match[1]);
        existingKeys.add(String(key));
    } catch(e) {}
}

const pu1Content = fs.readFileSync('content_pu1.js', 'utf8');

// Unit 0 starts at "0": { and ends where "1": { starts.
// Unit 1 starts at "1": { and ends where "2": { starts.
const unit0Start = pu1Content.indexOf('"0": {');
const unit1Start = pu1Content.indexOf('"1": {');
const unit2Start = pu1Content.indexOf('"2": {');

const unit0Text = pu1Content.substring(unit0Start, unit1Start);
const unit1Text = pu1Content.substring(unit1Start, unit2Start);

const combinedText = unit0Text + unit1Text;

const missing = new Set();
const stringRegex = /(["'])(?:(?=(\\?))\2.)*?\1/g;

let m;
while ((m = stringRegex.exec(combinedText)) !== null) {
    try {
        let s = eval(m[0]);
        if (s) {
            s = String(s).trim();
            if (s.length > 1 && 
                !existingKeys.has(s) && 
                !['sentences', 'vocab', 'sentencePairs', 'a', 'b', 'title', 'unit', 'page'].includes(s) &&
                !/^\d+$/.test(s)
            ) {
                missing.add(s);
            }
        }
    } catch(e) {}
}

const finalMissing = Array.from(missing).sort();
console.log("PU1 Unit 0 & 1 Missing Count:", finalMissing.length);
console.log(JSON.stringify(finalMissing, null, 2));
