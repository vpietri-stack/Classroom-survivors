const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const core=require('./api/src/functions/shared/targetReportsCore');
const now=Date.parse('2026-10-13T12:00:00+08:00');
const target={startTime:'2026-10-11T10:00:00Z',endTime:'2026-10-18T08:30:00Z',targetSessions:10};
const students=['Student A','Student B','Student C'].map((fullName,i)=>({id:'s'+i,fullName,teacher:'Teacher A',classTime:i===2?'Sun 16:30':'Sun 10:40',avatar:'🐱',role:'student',targets:[i===1?{...target,startTime:'2026-09-13T10:00:00Z',targetSessions:50}:target],analytics:[],password:'PRIVATE'}));
const groups=core.groups(students.map((s,i)=>({...core.row(s,s.targets[0],[],now),completed:i===1?20:0})));
(async()=>{
    const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];let fail=true;
        page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(()=>{
            localStorage.setItem('savedUsers',JSON.stringify([{id:'admin-test',name:'Test admin',role:'admin'}]));localStorage.setItem('activeUserId','admin-test');
            window.copied=[];
            Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>copied.push(text),write:async items=>{const blob=await items[0].getType('image/png');copied.push({type:blob.type,size:blob.size});}}});
        });
        await page.route('**/*',async route=>{
            const url=new URL(route.request().url()),send=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
            if(url.pathname.endsWith('/login')) return send({id:'admin-test',role:'admin'});
            if(url.pathname.endsWith('/getStudents')) return send(students);
            if(url.pathname.endsWith('/classCalendar')) return send({events:[]});
            if(url.pathname.endsWith('/getTargetReports')) {
                assert.equal(url.searchParams.get('teacher'),'Teacher A');
                if(fail){fail=false;return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Test fetch failed'})});}
                return send({teacher:'Teacher A',generatedAt:new Date(now).toISOString(),groups});
            }
            if(url.pathname.endsWith('/app-config.json')) return send({APP_API_KEY:''});
            if(url.hostname!=='reports.test') return route.abort();
            const local=path.join(__dirname,decodeURIComponent(url.pathname.slice(1)));
            if(!fs.existsSync(local)) return route.fulfill({status:404,body:''});
            return route.fulfill({contentType:local.endsWith('.html')?'text/html':local.endsWith('.css')?'text/css':local.endsWith('.js')?'text/javascript':'application/json',body:fs.readFileSync(local)});
        });
        await page.goto('https://reports.test/teacher_dashboard.html');
        await page.locator('#filterTeacher').selectOption('Teacher A');
        await page.evaluate(()=>{const pick=TargetReportsCore.pickClosing;window.closingDraws=0;TargetReportsCore.pickClosing=()=>pick(()=>(window.closingDraws++%10+0.5)/10);});
        await page.getByRole('button',{name:'Export Target Reports',exact:true}).click();
        assert.equal(await page.locator('#targetReportTeacher').inputValue(),'Teacher A');
        await page.getByRole('button',{name:'Generate reports',exact:true}).click();
        await page.waitForFunction(()=>document.getElementById('targetReportStatus').textContent==='Test fetch failed');
        assert(await page.locator('#generateTargetReports').isEnabled());
        await page.getByRole('button',{name:'Generate reports',exact:true}).click();
        await page.waitForSelector('#targetReportPreview:not(.hidden)');
        assert.equal(await page.locator('#targetReportGroup option').count(),2);
        const message=await page.locator('#targetReportMessage').inputValue();assert(message.includes('Student B 20/50'));assert(message.includes('Student A 0/10'));assert(!message.includes('PRIVATE'));
        assert(message.endsWith(core.closings[0]));
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
        await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.querySelector('.report-columns').getBoundingClientRect().width<390),true);
        await page.screenshot({path:'screenshot_target_reports_mobile.png',fullPage:true});
        assert.deepEqual(errors,[]);
        console.log('PASS: Chrome target report generation, retry, PNG/text copy, edited messages, group navigation, ZIP/PNG download and mobile layout');
    }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
