/* One report snapshot supplies both the PNG and the WeChat message. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./classCalendarCore'));
    else root.TargetReportsCore = factory(root.ClassCalendarCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(calendar) {
    'use strict';
    const closings = Object.freeze([
        '记得！每天练一点，比偶尔一次练很多更好！',
        '每天一点点，进步看得见！别等到最后一天才集中练习哦！',
        '练习不用一次做很多，每天坚持一点就很棒！',
        '把练习分到每天，让进步成为习惯！',
        '今天练一点，明天再练一点，慢慢积累就是大进步！',
        '每天给英语留一点时间，比偶尔突击更好哦！',
        '不用一口气完成所有练习，每天一点点，轻松向目标前进！',
        '小练习，大积累！每天坚持一点，比攒到一起做更好！',
        '记得每天来练一练！少量、经常，比偶尔一次练很多更好！',
        '让英语成为每天的小习惯，而不是最后一天的大任务！'
    ]);
    function pickClosing(random = Math.random) { return closings[Math.floor(random() * closings.length)]; }
    function selectTarget(student, now) {
        const targets = (student.targets || []).filter(t => Number.isFinite(+new Date(t.startTime)) && Number.isFinite(+new Date(t.endTime)) && Number.isFinite(Number(t.targetSessions)));
        return targets.find(t => +new Date(t.startTime) <= now && +new Date(t.endTime) >= now)
            || targets.filter(t => +new Date(t.endTime) < now).sort((a,b) => +new Date(b.endTime)-+new Date(a.endTime))[0]
            || targets.filter(t => +new Date(t.startTime) > now).sort((a,b) => +new Date(a.startTime)-+new Date(b.startTime))[0] || null;
    }
    function row(student, target, events, now) {
        return { name: student.fullName || student.name || student.login || 'Student', avatar: student.avatar || '👤', teacher: student.teacher || '', classTime: student.classTime || '',
            completed: target ? (+new Date(target.startTime) > now ? 0 : calendar.countPractice(events, target, now)) : null,
            goal: target ? Number(target.targetSessions) : null, startTime: target ? target.startTime : null, endTime: target ? target.endTime : null };
    }
    function groups(rows) {
        const map = new Map();
        for (const row of rows) {
            const key = calendar.groupKey(row.teacher, row.classTime);
            if (!map.has(key)) map.set(key, {teacher:row.teacher,classTime:row.classTime,rows:[]});
            map.get(key).rows.push(row);
        }
        return [...map.values()].sort((a,b) => {
            const sa=calendar.parseClassTime(a.classTime), sb=calendar.parseClassTime(b.classTime);
            const rank=s=>s ? ((s.day+6)%7)*1440+s.hour*60+s.minute : Infinity;
            return rank(sa)-rank(sb) || a.classTime.localeCompare(b.classTime);
        }).map(g => ({...g, rows:g.rows.sort((a,b) => (b.completed ?? -Infinity)-(a.completed ?? -Infinity) || a.name.localeCompare(b.name))}));
    }
    function date(value) { return calendar.beijingDate(value).replace(/-/g,'/'); }
    function period(row) { return row.startTime ? `${date(row.startTime)} - ${date(row.endTime)}` : '未设置目标'; }
    function message(group) {
        const periods = new Map();
        for (const row of group.rows) {
            const key=period(row);
            if (!periods.has(key)) periods.set(key,[]);
            periods.get(key).push(row);
        }
        const sections=[...periods.entries()].sort((a,b)=>(+new Date(b[1][0].startTime) || 0)-(+new Date(a[1][0].startTime) || 0)).map(([range,rows],i)=> range + (i===0 ? '\n\n打卡记录:\n（一周内累计完成10次练习，下次课的课堂积分翻倍）' : '') + '\n\n' + rows.map(r=>`${r.name} ${r.goal===null ? '未设置目标' : `${r.completed}/${r.goal}`}`).join('\n'));
        return sections.join('\n\n') + '\n\n' + (group.closing || closings[0]);
    }
    return {selectTarget,row,groups,date,period,message,closings,pickClosing};
});
