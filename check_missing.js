const fs = require('fs');


let tStr = fs.readFileSync('translations.js', 'utf8');
let m = tStr.match(/const LOCAL_TRANSLATIONS = \{([\s\S]*?)\};/);
if(m) {
    let objText = "({" + m[1] + "})";
    let obj = eval(objText);
    
    let cStr = fs.readFileSync('content_think0.js', 'utf8');
    let contentMatch = cStr.match(/TEACHING_CONTENT\["Think0"\] = ([\s\S]*?)AVAILABLE_CONTENT/);
    if (contentMatch) {
         let contentText = contentMatch[1].trim();
         if (contentText.endsWith(';')) contentText = contentText.slice(0, -1);
         let cObj = eval("(" + contentText + ")");
         
         const vocab = cObj['0']['11'].vocab;
         const sentences = cObj['0']['11'].sentences;
         const pairs = cObj['0']['11'].sentencePairs;
         
         let missing = [];
         let res = {};
         vocab.forEach(v => { if(!obj[v]) { missing.push(v); res[v] = ""; } });
         sentences.forEach(s => { if(!obj[s]) { missing.push(s); res[s] = ""; } });
         pairs.forEach(p => { 
             if(!obj[p.a]) { missing.push(p.a); res[p.a] = ""; }
             if(!obj[p.b]) { missing.push(p.b); res[p.b] = ""; }
         });
         
         fs.writeFileSync('missing.json', JSON.stringify(res, null, 2));
    }
}
