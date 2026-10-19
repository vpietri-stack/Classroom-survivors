const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const core=require('./api/src/functions/shared/targetReportsCore');
const crypto=require('crypto');
const {compactStudent}=require('./api/src/functions/shared/dashboardData');
const calendar=require('./api/src/functions/shared/classCalendarCore');
const now=Date.parse('2026-10-13T12:00:00+08:00');
const target={startTime:'2026-10-11T10:00:00Z',endTime:'2026-10-18T08:30:00Z',targetSessions:10};
const students=['Student A','Student B','Student C'].map((fullName,i)=>({id:'s'+i,fullName,teacher:'Teacher A',classTime:i===2?'Sun 16:30':'Sun 10:40',avatar:'🐱',role:'student',targets:[i===1?{...target,startTime:'2026-09-13T10:00:00Z',targetSessions:50}:target],analytics:[],password:'PRIVATE'}));
const groups=core.groups(students.map((s,i)=>({...core.row(s,s.targets[0],[],now),completed:i===1?20:0})));
(async()=>{
    const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];let fail=true,failRefresh=false,studentFetches=0,calendarFetches=0,reportFetches=0;
        page.on('pageerror',e=>errors.push(e.message));
        const snapshots=new Map();let unchangedResponses=0,archiveFetches=0;
        await page.addInitScript(()=>{
            localStorage.setItem('savedUsers',JSON.stringify([{id:'admin-test',name:'Test admin',role:'admin'}]));localStorage.setItem('activeUserId','admin-test');
            window.copied=[];
            Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>copied.push(text),write:async items=>{const blob=await items[0].getType('image/png');copied.push({type:blob.type,size:blob.size});}}});
        });
        await page.route('**/*',async route=>{
            const url=new URL(route.request().url()),send=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
            if(url.pathname.endsWith('/login')) return send({id:'admin-test',role:'admin'});
            if(url.pathname.endsWith('/getStudents')) {
                studentFetches++;
                if(url.searchParams.has('studentId')) return send(students.filter(s=>s.id===url.searchParams.get('studentId')));
                if(failRefresh) {failRefresh=false;return route.fulfill({status:500,body:'Test refresh failed'});}
                assert.equal(url.searchParams.get('view'),'dashboard');
                const rows=students.map(s=>compactStudent(s,now)),revision=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
                if(url.searchParams.get('since')===revision) {unchangedResponses++;return route.fulfill({status:304,body:''});}
                const previous=snapshots.get(url.searchParams.get('since'));
                const changed=previous?rows.filter(s=>JSON.stringify(s)!==JSON.stringify(previous.find(p=>p.id===s.id))):rows;
                const removed=previous?previous.filter(s=>!rows.some(r=>r.id===s.id)).map(s=>s.id):[];
                snapshots.set(revision,JSON.parse(JSON.stringify(rows)));
                return send({students:changed,removed,revision,full:!previous});
            }
            if(url.pathname.endsWith('/classCalendar')) {calendarFetches++;return send({events:[]});}
            if(url.pathname.endsWith('/getStudentArchive')) {archiveFetches++;return send([]);}
            if(url.pathname.endsWith('/updateStudent')) {
                const body=route.request().postDataJSON(),student=students.find(s=>s.id===body.studentId);
                if(body.expectedTargets) assert.deepEqual(body.expectedTargets,student.targets);
                const next={...student,...body.fields};
                if(body.fields.classGroups) next.targets=student.targets.map(t=>({...t,groupKey:calendar.targetGroupKey(next,t)}));
                Object.assign(student,next);
                groups.splice(0,groups.length,...core.groups(students.flatMap(s=>calendar.memberships(s).map(g=>core.row({...s,...g},core.selectTarget(s,now,calendar.groupKey(g.teacher,g.classTime)),s.analytics,now)))));
                return send({success:true,student});
            }
            if(url.pathname.endsWith('/getTargetReports')) {
                reportFetches++;
                assert.equal(url.searchParams.get('teacher'),'Teacher A');
                if(fail){fail=false;return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Test fetch failed'})});}
                const progressUpdates=students.map(s=>({id:s.id,groupProgress:calendar.memberships(s).map(g=>({key:calendar.groupKey(g.teacher,g.classTime),target:core.selectTarget(s,now,calendar.groupKey(g.teacher,g.classTime)),completed:groups.find(group=>group.classTime===g.classTime)?.rows.find(r=>r.name===s.fullName)?.completed ?? 0}))}));
                return send({teacher:'Teacher A',generatedAt:new Date(now).toISOString(),groups,progressUpdates});
            }
            if(url.pathname.endsWith('/app-config.json')) return send({APP_API_KEY:''});
            if(url.hostname!=='reports.test') return route.abort();
            const local=path.join(__dirname,decodeURIComponent(url.pathname.slice(1)));
            if(!fs.existsSync(local)) return route.fulfill({status:404,body:''});
            return route.fulfill({contentType:local.endsWith('.html')?'text/html':local.endsWith('.css')?'text/css':local.endsWith('.js')?'text/javascript':'application/json',body:fs.readFileSync(local)});
        });
        await page.goto('https://reports.test/teacher_dashboard.html');
        await page.waitForFunction(()=>document.getElementById('dashboardRefreshStatus').textContent.startsWith('Updated'));
        await page.locator('#filterTeacher').selectOption('Teacher A');
        await page.locator('#filterClassTime').selectOption('Sun 10:40');
        await page.locator('#filterName').fill('Student A');
        await page.locator('#filterDateFrom').fill('2026-10-01');
        await page.locator('#filterDateTo').fill('2026-10-20');
        await page.evaluate(()=>sortTable('target'));
        const addPractice=()=>{students[0].analytics.push({type:'session',sessionType:'study',eventId:'refresh'+students[0].analytics.length,timestamp:new Date(now).toISOString()});groups.flatMap(g=>g.rows).find(r=>r.name==='Student A').completed++;};
        failRefresh=true;
        await page.locator('#refreshDashboardBtn').click();
        await page.waitForFunction(()=>document.getElementById('dashboardRefreshStatus').textContent.startsWith('Refresh failed'));
        assert(await page.locator('#refreshDashboardBtn').isEnabled());
        assert.equal(await page.locator('#studentsTableBody tr').count(),1);
        assert((await page.locator('#studentsTableBody').textContent()).includes('0/10'));
        addPractice();
        const beforeRefresh=studentFetches,beforeCalendar=calendarFetches;
        await page.evaluate(()=>Promise.all([refreshDashboardData(),refreshDashboardData()]));
        assert.equal(studentFetches,beforeRefresh+1);assert.equal(calendarFetches,beforeCalendar+1);
        assert((await page.locator('#studentsTableBody').textContent()).includes('1/10'));
        assert.equal(await page.locator('#filterTeacher').inputValue(),'Teacher A');
        assert.equal(await page.locator('#filterClassTime').inputValue(),'Sun 10:40');
        assert.equal(await page.locator('#filterName').inputValue(),'Student A');
        assert.equal(await page.locator('#filterDateFrom').inputValue(),'2026-10-01');
        assert.equal(await page.locator('#filterDateTo').inputValue(),'2026-10-20');
        assert.equal(await page.evaluate(()=>sortState.column),'target');
        await page.evaluate(()=>refreshDashboardData());assert(unchangedResponses>0);
        assert.equal(archiveFetches,0); // Overview/refresh never downloads any student's history.
        await page.evaluate(()=>{const pick=TargetReportsCore.pickClosing;window.closingDraws=0;TargetReportsCore.pickClosing=()=>pick(()=>(window.closingDraws++%10+0.5)/10);});
        await page.getByRole('button',{name:'Export Target Reports',exact:true}).click();
        assert.equal(await page.locator('#targetReportTeacher').inputValue(),'Teacher A');
        const beforeReports=reportFetches,beforeReportCalendar=calendarFetches;
        failRefresh=true; // Report generation must still work when an overview refresh would fail.
        addPractice();const beforeGenerate=studentFetches;
        await page.getByRole('button',{name:'Generate reports',exact:true}).click();
        await page.waitForFunction(()=>document.getElementById('targetReportStatus').textContent==='Test fetch failed');
        assert(await page.locator('#generateTargetReports').isEnabled());
        assert.equal(studentFetches,beforeGenerate);assert.equal(calendarFetches,beforeReportCalendar);
        assert.equal(reportFetches,beforeReports+1);
        addPractice();
        await page.getByRole('button',{name:'Generate reports',exact:true}).click();
        await page.waitForSelector('#targetReportPreview:not(.hidden)');
        assert.equal(await page.locator('#targetReportGroup option').count(),2);
        const message=await page.locator('#targetReportMessage').inputValue();assert(message.includes('Student B 20/50'));assert(message.includes('Student A 3/10'));assert(!message.includes('PRIVATE'));
        assert((await page.locator('#studentsTableBody').textContent()).includes('3/10'));
        assert(message.endsWith(core.closings[0]));
        failRefresh=false;
        const colours=await page.evaluate(()=>{
            const stamp=Date.parse(targetReportState.generatedAt),day=86400000;
            const rows=[1,2,5,7,null].map(remaining=>({name:'Pace fixture',teacher:'Teacher A',classTime:'Sun 10:40',avatar:'🐱',goal:remaining===null?null:10,completed:remaining===null?null:10-remaining,startTime:new Date(stamp-day).toISOString(),endTime:new Date(stamp+2*day).toISOString()}));
            const canvas=drawTargetReport(document.createElement('canvas'),{teacher:'Teacher A',classTime:'Sun 10:40',generatedAt:targetReportState.generatedAt,rows});
            return rows.map((r,i)=>Array.from(canvas.getContext('2d').getImageData(4,(106+i*76+10)*2,1,1).data).slice(0,3));
        });
        assert.deepEqual(colours,[[101,217,155],[242,210,103],[255,149,101],[255,119,127],[165,173,189]]);
        const initialImage=await page.locator('#targetReportCanvas').evaluate(c=>c.toDataURL());
        await page.clock.setFixedTime(new Date(now+86400000)); // Existing reports keep their generation-time colours.
        await page.screenshot({path:'screenshot_target_reports.png',fullPage:true});
        await page.getByRole('button',{name:'Copy Image',exact:true}).click();
        await page.waitForFunction(()=>window.copied.length===1);
        assert.equal((await page.evaluate(()=>copied[0])).type,'image/png');assert((await page.evaluate(()=>copied[0])).size>1000);
        await page.getByRole('button',{name:'Copy Message',exact:true}).click();assert.equal(await page.evaluate(()=>copied[1]),message);
        await page.locator('#targetReportMessage').fill(message+'\nExtra reminder');
        await page.getByRole('button',{name:'Next group →',exact:true}).click();assert((await page.locator('#targetReportMessage').inputValue()).includes('Student C 0/10'));
        await page.getByRole('button',{name:'← Previous group',exact:true}).click();assert((await page.locator('#targetReportMessage').inputValue()).endsWith('Extra reminder'));
        assert.equal(await page.locator('#targetReportCanvas').evaluate(c=>c.toDataURL()),initialImage);
        const zipDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download all (ZIP)',exact:true}).click();
        const zip=await zipDownload;await zip.saveAs(path.join(os.tmpdir(),'target-reports-test.zip'));
        const pngDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download PNG',exact:true}).click();
        const png=await pngDownload;await png.saveAs(path.join(os.tmpdir(),'target-reports-test.png'));
        assert.equal(await page.evaluate(()=>window.closingDraws),2); // Navigation/copy/download never rerolls.
        const zipBytes=fs.readFileSync(path.join(os.tmpdir(),'target-reports-test.zip'));
        assert(zipBytes.includes(Buffer.from(message+'\nExtra reminder','utf8')));
        assert(zipBytes.includes(Buffer.from(core.closings[1],'utf8'))); // Unopened groups retain their assigned closing in ZIP.
        await page.getByRole('button',{name:'Generate reports',exact:true}).click();
        await page.waitForFunction(()=>window.closingDraws===4);
        assert((await page.locator('#targetReportMessage').inputValue()).endsWith(core.closings[2]));
        // A single profile gains another membership and keeps two independently labelled targets.
        students.splice(0,students.length,
            {id:'selena',fullName:'Selena',role:'student',teacher:'Teacher A',classTime:'Sat 14:50',classGroups:[],avatar:'🐱',analytics:students[0].analytics,
                targets:[{...target,id:'sat',startTime:'2026-10-10T08:20:00Z',endTime:'2026-10-17T06:50:00Z',manualOffset:7},{...target,id:'sun',targetSessions:20}],password:'PRIVATE'},
            {id:'other',fullName:'Sunday classmate',role:'student',teacher:'Teacher A',classTime:'Sun 16:30',targets:[],analytics:[]});
        await page.evaluate(()=>document.getElementById('targetReportsModal').classList.add('hidden'));
        await page.locator('#filterName').fill('');await page.locator('#filterClassTime').selectOption('');
        await page.evaluate(()=>refreshDashboardData());
        await page.locator('#studentsTableBody tr').filter({hasText:'Selena'}).click();
        await page.getByRole('button',{name:'Settings',exact:true}).click();
        await page.locator('#settingsAdditionalGroup').selectOption(calendar.groupKey('Teacher A','Sun 16:30'));
        await page.getByRole('button',{name:'Add group',exact:true}).click();
        await page.getByRole('button',{name:'Save Changes',exact:true}).click();
        await page.waitForFunction(()=>document.getElementById('settingsSaveStatus').textContent.includes('Saved'));
        assert((await page.locator('#detailStudentClass').textContent()).includes('Sat 14:50 · Sun 16:30'));
        await page.getByRole('button',{name:'Targets',exact:true}).click();
        assert.equal(await page.locator('#targetsTableBody tr').count(),2);
        assert.equal(await page.locator('#targetsTableBody select').nth(0).inputValue(),calendar.groupKey('Teacher A','Sat 14:50'));
        assert.equal(await page.locator('#targetsTableBody select').nth(1).inputValue(),calendar.groupKey('Teacher A','Sun 16:30'));
        assert((await page.locator('#targetsTableBody').textContent()).includes('10 / 10'));
        assert((await page.locator('#targetsTableBody').textContent()).includes('3 / 20'));
        await page.locator('#targetsTableBody select').nth(1).selectOption(calendar.groupKey('Teacher A','Sun 16:30'));
        await page.waitForFunction(()=>document.getElementById('targetSaveStatus').textContent.includes('group saved'));
        await page.screenshot({path:'screenshot_multiple_group_targets.png',fullPage:true});
        await page.evaluate(()=>backToDashboard());
        await page.locator('#filterClassTime').selectOption('Sun 16:30');
        const selenaRow=page.locator('#studentsTableBody tr').filter({hasText:'Selena'});
        assert.equal(await selenaRow.count(),1);assert((await selenaRow.textContent()).includes('3/20'));assert(!(await selenaRow.textContent()).includes('10/10'));
        await page.getByRole('button',{name:'Export Target Reports',exact:true}).click();
        await page.getByRole('button',{name:'Generate reports',exact:true}).click();
        await page.waitForSelector('#targetReportPreview:not(.hidden)');
        assert((await page.locator('#targetReportMessage').inputValue()).includes('Selena 10/10'));
        await page.getByRole('button',{name:'Next group →',exact:true}).click();
        assert((await page.locator('#targetReportMessage').inputValue()).includes('Selena 3/20'));
        await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.querySelector('.report-columns').getBoundingClientRect().width<390),true);
        await page.screenshot({path:'screenshot_target_reports_mobile.png',fullPage:true});
        assert.deepEqual(errors,[]);
        console.log('PASS: Chrome target report generation, retry, PNG/text copy, edited messages, group navigation, ZIP/PNG download and mobile layout');
    }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
