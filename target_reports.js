/* Admin target exports: review and forward one class at a time. */
let targetReportState = {groups:[],index:0,generatedAt:'',busy:false,run:0};
function reportElement(id) {return document.getElementById(id);}
function reportStatus(text) {reportElement('targetReportStatus').textContent=text;}
function openTargetReports() {
    if (!isAdmin) return;
    if (!reportElement('targetReportsModal')) {
        const modal=document.createElement('div');
        modal.id='targetReportsModal'; modal.className='modal-overlay hidden';
        modal.innerHTML=`<section class="modal-box report-modal" role="dialog" aria-modal="true" aria-labelledby="targetReportTitle">
            <div class="modal-header"><h2 id="targetReportTitle">Export Target Reports</h2><button class="modal-close" onclick="closeTargetReports()" aria-label="Close target reports">×</button></div>
            <div class="report-body"><div class="report-toolbar"><label>Teacher <select id="targetReportTeacher" class="filter-select" onchange="clearTargetReports()"></select></label><button id="generateTargetReports" class="dash-action-btn primary" onclick="generateTargetReports()">Generate reports</button><button id="downloadTargetReports" class="dash-action-btn" onclick="downloadTargetReports()" disabled>Download all (ZIP)</button></div>
            <p>Fresh target data for all this teacher’s groups. Copy the image, paste it into WeChat, then copy and paste the message.</p>
            <p id="targetReportStatus" role="status" aria-live="polite"></p>
            <div id="targetReportPreview" class="hidden"><div class="report-navigation"><button id="previousTargetReport" class="dash-action-btn" onclick="moveTargetReport(-1)">← Previous group</button><label>Group <select id="targetReportGroup" class="filter-select" onchange="selectTargetReport(this.value)"></select></label><button id="nextTargetReport" class="dash-action-btn" onclick="moveTargetReport(1)">Next group →</button></div>
                <h3 id="targetReportGroupTitle"></h3><div class="report-columns"><div><div class="report-image-wrap"><canvas id="targetReportCanvas" aria-label="Group target report image"></canvas></div><div class="report-actions"><button class="dash-action-btn primary" onclick="copyTargetReportImage()">Copy Image</button><button class="dash-action-btn" onclick="downloadTargetReportImage()">Download PNG</button></div></div>
                <div><label for="targetReportMessage">WeChat message · editable before copying</label><textarea id="targetReportMessage" rows="14"></textarea><div class="report-actions"><button class="dash-action-btn primary" onclick="copyTargetReportMessage()">Copy Message</button><button class="dash-action-btn" onclick="downloadTargetReportMessage()">Download text</button></div></div></div>
                <p class="report-help">The image and message show the same counts. Different target periods are listed separately. Groups without a class time appear as “Unassigned class” for review.</p>
            </div></div></section>`;
        document.body.appendChild(modal);
    }
    const select=reportElement('targetReportTeacher'); select.replaceChildren();
    select.add(new Option('Select a teacher',''));
    [...new Set(allStudents.map(s=>s.teacher).filter(Boolean))].sort().forEach(t=>select.add(new Option(t,t)));
    select.value=reportElement('filterTeacher').value;
    reportElement('targetReportsModal').classList.remove('hidden'); clearTargetReports();
    select.focus();
}
function closeTargetReports() {targetReportState.run++; targetReportState.busy=false;reportElement('targetReportsModal').classList.add('hidden');}
function clearTargetReports() {
    targetReportState.run++;targetReportState.groups=[]; targetReportState.busy=false;
    reportElement('generateTargetReports').disabled=false;
    reportElement('generateTargetReports').textContent='Generate reports';
    reportElement('targetReportPreview').classList.add('hidden');reportElement('downloadTargetReports').disabled=true;
    reportStatus('Select a teacher and generate reports.');
}
async function generateTargetReports() {
    if (targetReportState.busy) return;
    const teacher=reportElement('targetReportTeacher').value;
    if (!teacher) return reportStatus('Select a teacher first.');
    clearTargetReports(); const run=targetReportState.run;
    targetReportState.busy=true;const button=reportElement('generateTargetReports');button.disabled=true;button.textContent='Generating…';
    reportStatus('Loading current targets and archived practice sessions…');
    try {
        const res=await apiFetch(`${API_BASE}/getTargetReports?teacher=${encodeURIComponent(teacher)}`);
        const data=await res.json();if (!res.ok) throw new Error(data.error || 'Could not generate reports.');
        if (run!==targetReportState.run) return;
        targetReportState.groups=data.groups;targetReportState.generatedAt=data.generatedAt;targetReportState.index=0;
        if (!data.groups.length) return reportStatus('No student groups found for this teacher.');
        const select=reportElement('targetReportGroup');select.replaceChildren();
        data.groups.forEach((g,i)=>select.add(new Option(g.classTime || 'Unassigned class',String(i))));
        reportElement('targetReportPreview').classList.remove('hidden');reportElement('downloadTargetReports').disabled=false;
        renderTargetReport();
        reportStatus(`${data.groups.length} groups ready · Updated ${new Date(data.generatedAt).toLocaleString('en-GB',{timeZone:'Asia/Shanghai'})} (Beijing time)`);
    } catch(err) {if(run===targetReportState.run) reportStatus(err.message);}
    finally {if(run===targetReportState.run) {targetReportState.busy=false;button.disabled=false;button.textContent='Generate reports';}}
}
function selectTargetReport(index) {saveTargetReportMessage();targetReportState.index=Number(index);renderTargetReport();}
function moveTargetReport(delta) {selectTargetReport(targetReportState.index+delta);}
function saveTargetReportMessage() {const g=targetReportState.groups[targetReportState.index];if(g) g.draftMessage=reportElement('targetReportMessage').value;}
function renderTargetReport() {
    const {groups,index}=targetReportState,g=groups[index];if(!g) return;
    reportElement('targetReportGroup').value=String(index);
    reportElement('targetReportGroupTitle').textContent=`${g.teacher} · ${g.classTime || 'Unassigned class'} · Group ${index+1} of ${groups.length}`;
    reportElement('previousTargetReport').disabled=index===0;reportElement('nextTargetReport').disabled=index===groups.length-1;
    reportElement('targetReportMessage').value=g.draftMessage ?? TargetReportsCore.message(g);
    drawTargetReport(reportElement('targetReportCanvas'),g);
}
function drawTargetReport(canvas,group) {
    const width=1100, rowHeight=76, header=106, height=header+group.rows.length*rowHeight+28;
    canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);
    ctx.fillStyle='#191c27';ctx.fillRect(0,0,width,height);
    ctx.font='600 22px Inter, Arial, sans-serif';ctx.fillStyle='#e7e9f2';ctx.fillText(`${group.teacher} · ${group.classTime || 'Unassigned class'}`,26,36);
    ctx.fillStyle='#212537';ctx.fillRect(0,54,width,52);ctx.fillStyle='#94a3bc';ctx.font='600 16px Inter, Arial, sans-serif';
    const columns=[26,325,450,620,765];['STUDENT','TEACHER','CLASS TIME','TARGET','PERIOD (BEIJING)'].forEach((label,i)=>ctx.fillText(label,columns[i],86));
    function fit(text,x,y,maxWidth) {let size=19;do {ctx.font=`500 ${size}px Inter, Arial, sans-serif`;if(ctx.measureText(text).width<=maxWidth) break;} while(--size>11);ctx.fillText(text,x,y,maxWidth);}
    group.rows.forEach((r,i)=>{
        const top=header+i*rowHeight,y=top+44;ctx.fillStyle=i%2?'#1c1f2b':'#191c27';ctx.fillRect(0,top,width,rowHeight);
        ctx.strokeStyle='#303547';ctx.beginPath();ctx.moveTo(0,top);ctx.lineTo(width,top);ctx.stroke();
        ctx.fillStyle='#ececf5';ctx.font='26px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        // Avatar values are text only; never fetch arbitrary student-provided URLs.
        const avatar=(r.avatar || '👤');ctx.fillText(avatar.length<=12 && !avatar.includes('<') ? avatar : '👤',26,y);
        ctx.fillStyle='#8c87ff';fit(r.name,73,y,235);ctx.fillStyle='#ececf5';fit(r.teacher,325,y,112);fit(r.classTime || '—',450,y,155);
        ctx.fillStyle='#292848';ctx.fillRect(612,top+21,128,34);ctx.fillStyle='#aaa5ff';fit(r.goal===null?'—':`${r.completed}/${r.goal}`,627,y-1,108);
        ctx.fillStyle='#e2e5ef';fit(r.startTime?TargetReportsCore.date(r.startTime)+' →':'No target',765,top+32,300);
        if(r.endTime) fit(TargetReportsCore.date(r.endTime),765,top+57,300);
    });
    return canvas;
}
function targetReportFilename(group) {return `${group.teacher}-${group.classTime || 'unassigned'}-${ClassCalendarCore.beijingDate(targetReportState.generatedAt)}`.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-');}
function targetReportBlob(canvas) {return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create report image.')),'image/png'));}
function downloadReportBlob(blob,name) {const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function copyTargetReportImage() {
    try {
        if(!navigator.clipboard?.write || typeof ClipboardItem==='undefined') throw new Error('Image copying is unavailable. Use Download PNG, then attach it in WeChat.');
        await navigator.clipboard.write([new ClipboardItem({'image/png':targetReportBlob(reportElement('targetReportCanvas'))})]);
        reportStatus('Image copied. Paste it into this group’s WeChat conversation.');
    } catch(err) {reportStatus(err.message+' Use Download PNG if the browser blocks copying.');}
}
async function copyTargetReportMessage() {
    const text=reportElement('targetReportMessage');saveTargetReportMessage();
    try {
        if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(text.value);
        else {text.focus();text.select();if(!document.execCommand('copy')) throw new Error('Select the message and copy it manually.');}
        reportStatus('Message copied. Paste it below the image in WeChat.');
    } catch(err) {text.focus();text.select();reportStatus('Copy blocked. The message is selected; press Ctrl+C or use your device’s Copy command.');}
}
async function downloadTargetReportImage() {try {const g=targetReportState.groups[targetReportState.index];downloadReportBlob(await targetReportBlob(reportElement('targetReportCanvas')),targetReportFilename(g)+'.png');reportStatus('PNG downloaded. Attach it to this group in WeChat.');} catch(err){reportStatus(err.message);}}
function downloadTargetReportMessage() {saveTargetReportMessage();const g=targetReportState.groups[targetReportState.index];downloadReportBlob(new Blob([g.draftMessage],{type:'text/plain;charset=utf-8'}),targetReportFilename(g)+'.txt');}
async function downloadTargetReports() {
    if(targetReportState.busy) return;saveTargetReportMessage();targetReportState.busy=true;
    const groups=targetReportState.groups.slice(), generatedAt=targetReportState.generatedAt,run=targetReportState.run;
    const button=reportElement('downloadTargetReports');button.disabled=true;reportStatus('Preparing PNG and text files for every group…');
    try {
        const files=[];
        for(let i=0;i<groups.length;i++) {
            const g=groups[i],prefix=String(i+1).padStart(2,'0')+'-'+targetReportFilename(g);
            const canvas=drawTargetReport(document.createElement('canvas'),g);
            files.push({name:prefix+'.png',bytes:new Uint8Array(await (await targetReportBlob(canvas)).arrayBuffer())});
            files.push({name:prefix+'.txt',bytes:new TextEncoder().encode(g.draftMessage ?? TargetReportsCore.message(g))});
        }
        downloadReportBlob(targetReportsZip(files),`target-reports-${ClassCalendarCore.beijingDate(generatedAt)}.zip`);
        if(run===targetReportState.run) reportStatus('ZIP downloaded. Each numbered group has a matching PNG and text file.');
    } catch(err){if(run===targetReportState.run) reportStatus(err.message);}
    finally{if(run===targetReportState.run){targetReportState.busy=false;button.disabled=false;}}
}
// Small stored ZIP writer, so exports need no external library or network service.
function targetReportsZip(files) {
    const parts=[],central=[];let offset=0;
    const u16=(v,n,x)=>v.setUint16(n,x,true),u32=(v,n,x)=>v.setUint32(n,x,true);
    for(const file of files) {
        const name=new TextEncoder().encode(file.name),bytes=file.bytes;let crc=0xffffffff;
        for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
        const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x800);u16(v,12,0x21);u32(v,14,crc);u32(v,18,bytes.length);u32(v,22,bytes.length);u16(v,26,name.length);h.set(name,30);parts.push(h,bytes);
        const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);u32(w,0,0x02014b50);u16(w,4,20);u16(w,6,20);u16(w,8,0x800);u16(w,14,0x21);u32(w,16,crc);u32(w,20,bytes.length);u32(w,24,bytes.length);u16(w,28,name.length);u32(w,42,offset);c.set(name,46);central.push(c);offset+=h.length+bytes.length;
    }
    const length=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);u32(v,0,0x06054b50);u16(v,8,files.length);u16(v,10,files.length);u32(v,12,length);u32(v,16,offset);
    return new Blob([...parts,...central,end],{type:'application/zip'});
}
