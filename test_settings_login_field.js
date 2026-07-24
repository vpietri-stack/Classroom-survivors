// Focused verification for "show student login in Settings tab" feature.
// No external deps. Loads the REAL admin_dashboard.js in one VM blob with the
// cross-file globals it shares with teacher_dashboard.js (allStudents,
// currentStudent, isBM) stubbed — isAdmin/showStatus are declared by
// admin_dashboard.js itself, so they are NOT stubbed (would collide).
// Test body is appended into the same blob to see top-level `let currentStudent`.
//
// Run: node test_settings_login_field.js

const fs = require('fs');
const vm = require('vm');

const els = {};
function mkEl(id) {
  return { id, value: '', checked: false, className: '', type: 'text',
    classList: { add(){}, remove(){}, contains(){ return false; } },
    _text: '', set textContent(v){ this._text = v; }, get textContent(){ return this._text; } };
}
function getEl(id){ return els[id] || (els[id] = mkEl(id)); }

const context = {
  document: { getElementById: getEl, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
  navigator: { clipboard: { writeText: (t) => { context.__clipboard = t; return Promise.resolve(); } } },
  localStorage: { getItem: () => null },
  window: {}, console, apiFetch: () => Promise.resolve({ ok:true, json: async()=>({}) }),
  fetch: () => Promise.resolve({ ok:true, json: async()=>({}) }),
  setTimeout: () => {}, Math, JSON, Date, Promise,
  __pass: 0, __fail: 0,
  report(name, cond){ if (cond){ context.__pass++; console.log('  PASS', name); } else { context.__fail++; console.log('  FAIL', name); } },
};
vm.createContext(context);

const driver = `
// cross-file globals normally provided by teacher_dashboard.js
var allStudents = [];
var currentStudent = null;
var isBM = false;
// content constants (teaching_content.js) consumed by the populate*Select helpers
var AVAILABLE_CONTENT = {};

${fs.readFileSync(__dirname + '/admin_dashboard.js', 'utf8')}

(function runTests(){
  currentStudent = { login: 'aaron_huangruoxuan', fullName: 'Aaron', teacher: 'Val',
                     classTime: 'Thu 18:10', book:'PU1', unit:'5', page:'63', needsPasswordChange:false };
  populateSettingsTab();
  var loginEl = document.getElementById('settingsLogin');
  report('login field populated from student.login', loginEl && loginEl.value === 'aaron_huangruoxuan');

  copyLogin();
  report('copyLogin copies login to clipboard', __clipboard === 'aaron_huangruoxuan');

  currentStudent = { login: '', fullName: 'X' };
  try { populateSettingsTab(); report('empty login does not throw', document.getElementById('settingsLogin').value === ''); }
  catch(e){ report('empty login does not throw', false); }
})();
`;

vm.runInContext(driver, context);
const ok = context.__fail === 0;
console.log(`\n${ok ? 'ALL PASSED' : 'FAILURES'}: ${context.__pass} passed, ${context.__fail} failed`);
process.exit(ok ? 0 : 1);
