// Local browser smoke test with an isolated, in-memory API; never contacts production.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const core = require('./api/src/functions/shared/classCalendarCore');
const students = ['Student A','Student B','Student C'].map((fullName,i) => ({id:'test'+i,fullName,login:'test'+i,avatar:'🐱',role:'student',teacher:'Teacher A',classTime:'Sun 16:30',analytics:[],targets:[]}));
const events = core.occurrences({teacher:'Teacher A',classTime:'Sun 16:30',studentIds:students.map(s=>s.id)},'2026-10-12','2026-11-30').map((e,i)=>({...e,id:'class_'+String(i).padStart(32,'0'),etag:'1'}));
(async()=>{
    const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:1440,height:1080}});
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.clock.setFixedTime(new Date('2026-10-19T12:00:00+08:00'));
        await page.addInitScript(()=>{
            localStorage.setItem('savedUsers',JSON.stringify([{id:'test-admin',name:'Test admin',role:'admin'}]));
            localStorage.setItem('activeUserId','test-admin');
        });
        await page.route('**/*',async route=>{
            const url=new URL(route.request().url());
            const send = body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
            if (url.pathname.endsWith('/login')) return send({id:'test-admin',role:'admin'});
            if (url.pathname.endsWith('/getStudents')) return send(students);
            if (url.pathname.endsWith('/classCalendar')) {
                if (route.request().method()==='GET') return send({events});
                const body=route.request().postDataJSON();
                const event=events.find(e=>e.id===body.eventId);
                if (body.action==='record') {
                    event.attendanceStarted=true;
                    const results=body.studentIds.map(id=>{
                        const s=students.find(s=>s.id===id);
                        s.attendance=[...(s.attendance || []),{classId:event.id,startTime:event.startTime,endTime:event.endTime,classTime:event.classTime,status:body.status}];
                        s.targets=core.updateTargets(s,event,body.status,events.find(e=>e.startTime>event.endTime),[]);
                        return {studentId:id,success:true,attendance:s.attendance,targets:s.targets};
                    });
                    return send({success:true,results});
                }
                return send({success:true});
            }
            if (url.pathname.endsWith('/app-config.json')) return send({APP_API_KEY:''});
            if (url.hostname!=='calendar.test') return route.abort();
            const local=path.join(__dirname,decodeURIComponent(url.pathname.slice(1)));
            if (!fs.existsSync(local)) return route.fulfill({status:404,body:''});
            const contentType=local.endsWith('.html')?'text/html':local.endsWith('.css')?'text/css':local.endsWith('.js')?'text/javascript':'application/json';
            return route.fulfill({contentType,body:fs.readFileSync(local)});
        });
        await page.goto('http://calendar.test/teacher_dashboard.html');
        await page.waitForSelector('#studentsTableBody tr');
        await page.getByRole('button',{name:'Class Calendar',exact:true}).click();
        await page.waitForSelector('.calendar-event');
        assert.equal(await page.locator('.calendar-event').count(),2);
        await page.screenshot({path:'screenshot_admin_calendar.png',fullPage:true});
        await page.getByRole('button',{name:/Check attendance/}).click();
        await page.waitForSelector('#attendanceChecklist input');
        assert.equal(await page.locator('#attendanceChecklist input:checked').count(),3);
        await page.locator('#attendanceChecklist input').last().uncheck();
        await page.getByRole('button',{name:'Attended the class',exact:true}).click();
        await page.waitForFunction(()=>document.querySelectorAll('#attendanceChecklist input').length===1);
        assert.equal(await page.locator('#attendanceChecklist input:checked').count(),0);
        await page.locator('#attendanceChecklist input').check();
        await page.getByRole('button',{name:'Missed the class',exact:true}).click();
        await page.waitForFunction(()=>document.querySelectorAll('#attendanceChecklist input').length===0);
        await page.getByRole('button',{name:'Close attendance'}).click();
        assert.equal(await page.locator('#studentsTableBody').getByText('100%',{exact:true}).count(),2);
        assert.equal(await page.locator('#studentsTableBody').getByText('0%',{exact:true}).count(),1);
        await page.locator('#studentsTableBody tr').first().click();
        await page.getByRole('button',{name:'Attendance',exact:true}).click();
        assert((await page.locator('#studentAttendanceSummary').textContent()).includes('100%'));
        await page.setViewportSize({width:390,height:844});
        assert(await page.locator('#tabAttendance').isVisible());
        assert.deepEqual(errors,[]);
        console.log('PASS: Chrome calendar, checked/unchecked batch attendance, removal, rates, profile and mobile viewport');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
