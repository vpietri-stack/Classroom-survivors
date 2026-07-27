// ============================================================
// gen_pair_images.js — propagate base images onto pair/inflection
// vocab filenames (user rule: verb pairs & inflections reuse the
// base word's picture). Re-runnable any time new base images land:
//   node gen_pair_images.js
// Handles:  "X - Y ..." hyphen pairs   -> X.png
//           "X Y" where Y inflects X   -> X.png  (regular + irregular forms)
// Only fills files that are still missing; never overwrites.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const imgDir = path.join(__dirname, 'images', 'vocab');
const fileFor = w => w.trim().toLowerCase().replace(/ /g, '-') + '.png';
const has = w => fs.existsSync(path.join(imgDir, fileFor(w)));

const files = ['content_pu1.js', 'content_pu2.js', 'content_pu3.js',
  'content_think0.js', 'content_think1.js', 'content_think2.js'];
const missing = new Set();
for (const file of files) {
  const sandbox = { TEACHING_CONTENT: {}, AVAILABLE_CONTENT: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), sandbox);
  for (const book of Object.values(sandbox.TEACHING_CONTENT))
    for (const unit of Object.values(book))
      for (const page of Object.values(unit))
        for (const item of (page.vocab || [])) {
          const w = (typeof item === 'string') ? item : (item && item.word) || '';
          if (w && w.trim() && !has(w)) missing.add(w.trim());
        }
}

const IRREG = {
  buy: ['bought'], bring: ['brought'], catch: ['caught'], teach: ['taught'],
  come: ['came'], become: ['became'], see: ['saw', 'seeing'], say: ['said'],
  go: ['went', 'going'], get: ['got', 'getting'], give: ['gave', 'giving'],
  take: ['took', 'taking'], make: ['made', 'making'], have: ['had', 'having'],
  do: ['did', 'doing'], eat: ['ate', 'eating'], drink: ['drank', 'drinking'],
  swim: ['swam', 'swimming'], run: ['ran', 'running'], sit: ['sat'],
  speak: ['spoke'], write: ['wrote'], win: ['won'], meet: ['met'],
  feel: ['felt'], find: ['found'], fly: ['flew', 'flying'], grow: ['grew'],
  know: ['knew'], leave: ['left'], lose: ['lost', 'losing'], tell: ['told'],
  think: ['thought'], send: ['sent'], sell: ['sold'], hide: ['hid', 'hiding'],
  draw: ['drew', 'drawing'], drive: ['drove', 'driving'], ride: ['rode', 'riding'],
  wear: ['wore', 'wearing'], is: ['was'], am: ['was'], are: ['were'],
  sleep: ['slept'], stand: ['stood'], hop: ['hopped', 'hopping'],
  stop: ['stopped', 'stopping'], drop: ['dropped', 'dropping'],
  cut: ['cutting'], read: ['reading'], put: ['putting'], sing: ['singing'],
  talk: ['talking'], walk: ['walking'], kick: ['kicking'], play: ['played', 'playing']
};
function isInflection(base, form) {
  base = base.toLowerCase(); form = form.toLowerCase();
  if (IRREG[base] && IRREG[base].includes(form)) return true;
  return [base + 'ed', base + 'd', base + 'ing', base + 's',
    base.slice(0, -1) + 'ing', base + base.slice(-1) + 'ed',
    base + base.slice(-1) + 'ing', base.slice(0, -1) + 'ied'].includes(form);
}

let copies = 0;
for (const word of missing) {
  if (has(word)) continue;
  let base = null;
  const hyph = word.match(/^([A-Za-z']+)\s+-\s+.+$/);
  const space = word.match(/^([A-Za-z']+)\s+([A-Za-z']+)$/);
  if (hyph) base = hyph[1];
  else if (space && isInflection(space[1], space[2])) base = space[1];
  if (base && has(base)) {
    fs.copyFileSync(path.join(imgDir, fileFor(base)), path.join(imgDir, fileFor(word)));
    console.log(fileFor(word), '<-', fileFor(base));
    copies++;
  }
}
console.log('\npair/inflection copies:', copies);
