(function (root) {
    'use strict';
    const catalog = [{"id": "pu3-u9-p114", "book": "PU3", "unit": "9", "page": "114", "version": 1, "title": "Power Up 3 · Unit 9 · 第114–115页 · The Story of Popocatepetl and Iztaccihuatl（火山传说故事）", "reader": "pu3_u9_p114_story.html", "wordCount": 21, "exerciseCount": 3},
        { id: 'pu3-u9-p111', book: 'PU3', unit: '9', page: '111', version: 1,
        title: 'Power Up 3 · Unit 9 · 第111页 · -ed / -ing adjective endings（以 -ed 和 -ing 结尾的形容词）', reader: 'interactive_notes_poc.html' },
        { id: 'pu1-u5-p59', book: 'PU1', unit: '5', page: '59', version: 1,
        title: 'Power Up 1 · Unit 5 · 第59页 · Whose …?, possessive ’s & my/your/his/her/their（物主代词与名词所有格）', reader: 'pu1_u5_p59_notes.html' },
        { id: 'pu1-u5-p61', book: 'PU1', unit: '5', page: '61', version: 1,
        title: 'Power Up 1 · Unit 5 · 第60–61页 · Extension of toys & want/wants（玩具词汇拓展与 want/wants 用法）', reader: 'pu1_u5_p61_notes.html' },
        { id: 'pu1-u7-p87', book: 'PU1', unit: '7', page: '87', version: 1,
        title: 'Power Up 1 · Unit 7 · 第86–87页 · Sports verbs & can for permission（运动动词与 can 表示请求许可）', reader: 'pu1_u7_p87_notes.html' },
        { id: 'pu1-u7-p85', book: 'PU1', unit: '7', page: '85', version: 1,
        title: 'Power Up 1 · Unit 7 · 第85页 · Present continuous（现在进行时）', reader: 'pu1_u7_p85_notes.html' },
        { id: 'pu2-u5-p59', book: 'PU2', unit: '5', page: '59', version: 1,
        title: 'Power Up 2 · Unit 5 · 第59页 · Superlative adjectives（形容词最高级）', reader: 'pu2_u5_p59_notes.html' },
        { id: 'pu2-u5-p60', book: 'PU2', unit: '5', page: '60', version: 1,
        title: 'Power Up 2 · Unit 5 · 第60–61页 · Action verbs & Prepositions: above, below, near, opposite（动作动词与方位介词）', reader: 'pu2_u5_p60_notes.html' },
        { id: 'pu2-u8-p95', book: 'PU2', unit: '8', page: '95', version: 1,
        title: 'Power Up 2 · Unit 8 · 第95页 · A day trip（一日游词汇）', reader: 'pu2_u8_p95_notes.html' },
        { id: 'pu3-u2-p19', book: 'PU3', unit: '2', page: '19', version: 1,
        title: 'Power Up 3 · Unit 2 · 第19页 · What’s for breakfast?（食物与饮品）', reader: 'pu3_u2_p19_notes.html' },
        { id: 'pu3-u8-p97', book: 'PU3', unit: '8', page: '97', version: 1,
        title: 'Power Up 3 · Unit 8 · 第97页 · Future with be going to（be going to 将来时）', reader: 'pu3_u8_p97_notes.html' },
        { id: 'pu3-u8-p99', book: 'PU3', unit: '8', page: '99', version: 1,
        title: 'Power Up 3 · Unit 8 · 第98–99页 · Places in town & Prepositions of movement（城镇地点与移动方向介词）', reader: 'pu3_u8_p99_notes.html' },
        { id: 'pu3-u3-p31', book: 'PU3', unit: '3', page: '31', version: 1,
        title: 'Power Up 3 · Unit 3 · 第31页 · A healthy body（身体部位词汇）', reader: 'pu3_u3_p31_notes.html' },
        { id: 'pu3-u3-p35', book: 'PU3', unit: '3', page: '35', version: 1,
        title: 'Power Up 3 · Unit 3 · 第34–35页 · Health problems & want/need + infinitive（健康问题与 want/need to do）', reader: 'pu3_u3_p35_notes.html' },
        { id: 'pu3-u3-p36', book: 'PU3', unit: '3', page: '36', version: 2,
        title: 'Power Up 3 · Unit 3 · 第36页 · Work your body（跨学科阅读：骨骼、关节与运动保护）', reader: 'pu3_u3_p36_story.html', wordCount: 55, exerciseCount: 5 },
        { id: 'think0-u4-wb41', book: 'Think0', unit: '4', page: 'WB-41', version: 1, wordCount: 32, exerciseCount: 3, title: 'Think Starter · Unit 4 · WB-41 · A weekend in my town（写作：我的小镇周末）', reader: 'think0_wb41.html' },
        { id: 'think0-u4-p44', book: 'Think0', unit: '4', page: '44', version: 1,
        title: 'Think Starter · Unit 4 · 第44页 · Parks around the world（世界各地的公园）', reader: 'think_parks.html', wordCount: 25, exerciseCount: 6 },
        { id: 'pu3-u9-p112', book: 'PU3', unit: '9', page: '112', version: 1,
        title: 'Power Up 3 · Unit 9 · 第112–113页 · North, south, east and west · Jasmin’s diary（方向、野外出行与 Jasmin 的日记）', reader: 'jasmins_diary.html', wordCount: 18, exerciseCount: 4 },
        { id: 'pu2-u1-p14', book: 'PU2', unit: '1', page: '14', version: 1,
        title: 'Power Up 2 · Unit 1 · 第14–15页 · The Race（诗歌故事：赛跑）', reader: 'pu2_race.html', wordCount: 14, exerciseCount: 5 },
        { id: 'pu3-u1-p14', book: 'PU3', unit: '1', page: '14', version: 1,
        title: 'Power Up 3 · Unit 1 · 第14–15页 · The Circus Child（故事阅读：马戏团的孩子）', reader: 'pu3_circus.html', wordCount: 27, exerciseCount: 4 }];
    const find = id => catalog.find(note => note.id === id);
    const atPage = page => page && catalog.find(note => note.book === page.book && note.unit === String(page.unit) && note.page === String(page.page));
    function normalize(value) {
        const result = {};
        for (const note of catalog) {
            const entry = value && value[note.id];
            if (entry && entry.version === note.version && Number.isFinite(Date.parse(entry.completedAt)))
                result[note.id] = { version: note.version, completedAt: new Date(entry.completedAt).toISOString() };
        }
        return result;
    }
    function fromEvents(events) {
        const result = {};
        for (const event of Array.isArray(events) ? events : []) {
            const marker = event && event.data && event.data.previewNote, note = marker && find(marker.id);
            if (!note || event.type !== 'session' || event.sessionType !== 'study' || marker.version !== note.version
                || marker.book !== note.book || String(marker.unit) !== note.unit || String(marker.page) !== note.page
                || marker.wordCount !== (note.wordCount || 5) || marker.exerciseCount !== (note.exerciseCount || 5) || !Number.isFinite(Date.parse(event.timestamp))) continue;
            const completedAt = new Date(event.timestamp).toISOString();
            if (!result[note.id] || completedAt < result[note.id].completedAt) result[note.id] = { version: note.version, completedAt };
        }
        return result;
    }
    function merge(...sources) {
        const result = {};
        for (const source of sources) for (const [id, entry] of Object.entries(normalize(source)))
            if (!result[id] || entry.completedAt < result[id].completedAt) result[id] = entry;
        return result;
    }
    function apply(user, events) {
        const progress = merge(user.previewNotes, fromEvents(events));
        if (Object.keys(progress).length) user.previewNotes = progress;
        return progress;
    }
    const api = { catalog, find, atPage, normalize, fromEvents, merge, apply };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PreviewNotesState = api;
})(typeof window !== 'undefined' ? window : globalThis);
