const fs = require('fs');

const inputFile = 'teaching_content.js';
const code = fs.readFileSync(inputFile, 'utf8');

// 1. Extract TEACHING_CONTENT block
const tcStart = code.indexOf('const TEACHING_CONTENT = {') + 'const TEACHING_CONTENT = {'.length;
let braceCount = 1;
let tcEnd = tcStart;
for (let i = tcStart; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    if (code[i] === '}') braceCount--;
    if (braceCount === 0) {
        tcEnd = i;
        break;
    }
}
const tcBody = code.substring(tcStart, tcEnd);

// 2. Extract AVAILABLE_CONTENT block
const acStart = code.indexOf('const AVAILABLE_CONTENT = {') + 'const AVAILABLE_CONTENT = {'.length;
braceCount = 1;
let acEnd = acStart;
for (let i = acStart; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    if (code[i] === '}') braceCount--;
    if (braceCount === 0) {
        acEnd = i;
        break;
    }
}
const acBody = code.substring(acStart, acEnd);

// Helper to extract top-level keys safely
function extractBookBlocks(bodyStr) {
    const blocks = {};
    const books = ['PU1', 'PU2', 'PU3', 'Think1'];

    for (const book of books) {
        const regexStr = "([\"'])" + book + "\\1\\s*:\\s*\\{";
        const regex = new RegExp(regexStr);
        const match = regex.exec(bodyStr);

        if (match) {
            const startIndex = match.index + match[0].length - 1; // index of the opening {
            let bCount = 1;
            let endIndex = startIndex + 1;
            while (endIndex < bodyStr.length && bCount > 0) {
                if (bodyStr[endIndex] === '{') bCount++;
                if (bodyStr[endIndex] === '}') bCount--;
                endIndex++;
            }
            blocks[book] = match[0] + bodyStr.substring(startIndex + 1, endIndex);
        }
    }
    return blocks;
}

const teachingBlocks = extractBookBlocks(tcBody);
const availableBlocks = extractBookBlocks(acBody);

const books = ['PU1', 'PU2', 'PU3', 'Think1'];

// 3. Write individual files
for (const book of books) {
    if (!teachingBlocks[book] || !availableBlocks[book]) {
        console.warn(`Missing blocks for ${book}`);
        continue;
    }

    // We want the output to be:
    // TEACHING_CONTENT["PU1"] = { ... };
    // AVAILABLE_CONTENT["PU1"] = { ... };

    let tcStr = teachingBlocks[book].trim();
    // Use regex to capture everything after the first {
    const tcMatch = tcStr.match(/^(?:["']?[^"']+["']?)\s*:\s*(\{[\s\S]*)/);

    let acStr = availableBlocks[book].trim();
    const acMatch = acStr.match(/^(?:["']?[^"']+["']?)\s*:\s*(\{[\s\S]*)/);

    if (tcMatch && acMatch) {
        const fileContent = "TEACHING_CONTENT[\"" + book + "\"] = " + tcMatch[1] + ";\n\nAVAILABLE_CONTENT[\"" + book + "\"] = " + acMatch[1] + ";\n";
        fs.writeFileSync("content_" + book.toLowerCase() + ".js", fileContent);
        console.log("Created content_" + book.toLowerCase() + ".js");
    } else {
        console.warn("Failed to parse block for " + book);
    }
}

// 4. Create new teaching_content.js
let REST_OF_FILE = code.substring(acEnd + 1);

// Clean up any trailing comma or semicolon right after the AVAILABLE_CONTENT block
if (REST_OF_FILE.trim().startsWith(';')) {
    REST_OF_FILE = REST_OF_FILE.replace(/^\s*;/, '');
}

// Update BOOK_SERIES in REST_OF_FILE
let newRestOfFile = REST_OF_FILE.replace(
    /"PU2":\s*\["PU1",\s*"PU2"\]/,
    '"PU2": ["PU2"]'
);
newRestOfFile = newRestOfFile.replace(
    /"PU3":\s*\["PU1",\s*"PU2",\s*"PU3"\]/,
    '"PU3": ["PU3"]'
);

const newMainContent = "const TEACHING_CONTENT = {};\nconst AVAILABLE_CONTENT = {};\n" + newRestOfFile;
fs.writeFileSync('teaching_content.js', newMainContent);
console.log('Updated teaching_content.js');
