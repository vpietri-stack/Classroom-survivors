const fs = require('fs');

// Read existing translations to avoid duplicates
const transContent = fs.readFileSync('translations.js', 'utf8');
const existingKeys = new Set();

// Robust key matching for translations.js
// We look for "key": or 'key': at the start of lines (with indentation)
const lines = transContent.split('\n');
lines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
        let keyPart = line.substring(0, colonIndex).trim();
        // It might be wrapped in quotes or not (though it should be)
        if ((keyPart.startsWith('"') && keyPart.endsWith('"')) || (keyPart.startsWith("'") && keyPart.endsWith("'"))) {
            try {
                // Remove outer quotes and handle escapes
                let key = eval(keyPart); 
                existingKeys.add(String(key));
            } catch(e) {}
        }
    }
});

let pu1Content = fs.readFileSync('content_pu1.js', 'utf8');

// Strip comments to avoid extracting strings from there
pu1Content = pu1Content.replace(/\/\/.*$/gm, '');
pu1Content = pu1Content.replace(/\/\*[\s\S]*?\*\//g, '');

const missing = new Set();

// Extract strings from content_pu1.js
// We target string literals '...' or "..."
const stringRegex = /(["'])(?:(?=(\\?))\2.)*?\1/g;
let match;
while ((match = stringRegex.exec(pu1Content)) !== null) {
    try {
        let s = eval(match[0]);
        if (s) {
            s = String(s).trim();
            // Filter:
            // 1. Length > 1
            // 2. Not already in translations
            // 3. Not a JS property name commonly used in the file
            // 4. Not a pure number
            if (s.length > 1 && 
                !existingKeys.has(s) && 
                !['sentences', 'vocab', 'sentencePairs', 'content', 'a:', 'b:', 'a', 'b', 'title', 'unit', 'page'].includes(s) &&
                !/^\d+$/.test(s)
            ) {
                missing.add(s);
            }
        }
    } catch(e) {}
}

const finalMissing = Array.from(missing).sort();
console.log("PU1 Truly Missing Count:", finalMissing.length);
fs.writeFileSync('pu1_missing_clean_v4.json', JSON.stringify(finalMissing, null, 2));
