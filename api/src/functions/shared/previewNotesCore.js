(function (root) {
    'use strict';
    const phonicsNotes = ['a', 'b', 'c', 'd'].map((letter, index) => ({
        id: letter === 'd' ? 'phonics1-u2-p5' : `phonics1-u1-p${index + 1}`, book: 'Phonics1', unit: letter === 'd' ? '2' : '1', page: letter === 'd' ? '5' : String(index + 1), version: 1,
        title: `Phonics 1 · Unit ${letter === 'd' ? 2 : 1} · Page ${letter === 'd' ? 5 : index + 1} - ${letter.toUpperCase()} ${letter}`,
        reader: `phonics1_letter_notes.html?letter=${letter}`, wordCount: 4, exerciseCount: 4
    }));
    const catalog = [...phonicsNotes, { id: 'phonics1-u1-picture-book-p4', kind: 'picture-book', storyTitle: 'The Big Bag', book: 'Phonics1', unit: '1', page: '4', version: 1, title: 'Phonics 1 · Unit 1 · Page 4 · The Big Bag（大包）', reader: 'phonics1_u1_picture_book_review.html', wordCount: 14, exerciseCount: 10 }, { id: 'pu1-u7-p88', book: 'PU1', unit: '7', page: '88', version: 1,
        title: 'Power Up 1 · Unit 7 · 第88页 · Body Power（身体的力量）', reader: 'pu1_u7_p88.html', wordCount: 21, exerciseCount: 3 },
        { id: 'pu1-u7-p90', book: 'PU1', unit: '7', page: '90', version: 1,
            title: 'Power Up 1 · Unit 7 · 第90–91页 · A good friend（一个好朋友）', reader: 'pu1_u7_p90.html', wordCount: 19, exerciseCount: 6 },
        {"id": "pu3-u9-p114", "book": "PU3", "unit": "9", "page": "114", "version": 1, "title": "Power Up 3 · Unit 9 · 第114–115页 · The Story of Popocatepetl and Iztaccihuatl（火山传说故事）", "reader": "pu3_u9_p114_story.html", "wordCount": 21, "exerciseCount": 3},
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
        { id: 'pu2-u2-p19', book: 'PU2', unit: '2', page: '19', version: 1,
        title: 'Power Up 2 · Unit 2 · 第19页 · Days of the week · before, between, after（星期名称与先后介词）', reader: 'pu2_u2_p19_notes.html' },
        { id: 'pu2-u2-p21', book: 'PU2', unit: '2', page: '21', version: 1,
        title: 'Power Up 2 · Unit 2 · 第21页 · How often? & Adverbs of frequency（频率问句与频率副词）', reader: 'pu2_u2_p21_notes.html' },
        { id: 'pu2-u5-p59', book: 'PU2', unit: '5', page: '59', version: 1,
        title: 'Power Up 2 · Unit 5 · 第59页 · Superlative adjectives（形容词最高级）', reader: 'pu2_u5_p59_notes.html' },
        { id: 'pu2-u5-p60', book: 'PU2', unit: '5', page: '60', version: 1,
        title: 'Power Up 2 · Unit 5 · 第60–61页 · Action verbs & Prepositions: above, below, near, opposite（动作动词与方位介词）', reader: 'pu2_u5_p60_notes.html' },
        { id: 'pu2-u8-p95', book: 'PU2', unit: '8', page: '95', version: 1,
        title: 'Power Up 2 · Unit 8 · 第95页 · A day trip（一日游词汇）', reader: 'pu2_u8_p95_notes.html' },
        { id: 'pu3-u1-p7', book: 'PU3', unit: '1', page: '7', version: 1,
        title: 'Power Up 3 · Unit 1 · 第7页 · Telling the time（时间表达与三餐）', reader: 'pu3_u1_p7_notes.html' },
        { id: 'pu3-u2-p19', book: 'PU3', unit: '2', page: '19', version: 1,
        title: 'Power Up 3 · Unit 2 · 第19页 · What’s for breakfast?（食物与饮品）', reader: 'pu3_u2_p19_notes.html' },
        { id: 'pu3-u2-p21', book: 'PU3', unit: '2', page: '21', version: 1,
        title: 'Power Up 3 · Unit 2 · 第21页 · Who, which and where（用 who、which、where 描述人、事物和地点）', reader: 'pu3_u2_p21_notes.html' },
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
        { id: 'pu3-u3-p38', book: 'PU3', unit: '3', page: '38', version: 1,
        title: 'Power Up 3 · Unit 3 · 第38–39页 · Too-too-moo and the Komodo Dragon（图图姆和科莫多巨蜥）', reader: 'pu3_u3_p38_story.html', wordCount: 18, exerciseCount: 4 },
        { id: 'think0-u4-wb41', book: 'Think0', unit: '4', page: 'WB-41', version: 1, wordCount: 32, exerciseCount: 3, title: 'Think Starter · Unit 4 · WB-41 · A weekend in my town（写作：我的小镇周末）', reader: 'think0_wb41.html' },
        { id: 'think0-u4-p44', book: 'Think0', unit: '4', page: '44', version: 1,
        title: 'Think Starter · Unit 4 · 第44页 · Parks around the world（世界各地的公园）', reader: 'think_parks.html', wordCount: 25, exerciseCount: 6 },
        { id: 'pu3-u9-p112', book: 'PU3', unit: '9', page: '112', version: 1,
        title: 'Power Up 3 · Unit 9 · 第112–113页 · North, south, east and west · Jasmin’s diary（方向、野外出行与 Jasmin 的日记）', reader: 'jasmins_diary.html', wordCount: 18, exerciseCount: 4 },
        { id: 'pu2-u1-p14', book: 'PU2', unit: '1', page: '14', version: 1,
        title: 'Power Up 2 · Unit 1 · 第14–15页 · The Race（诗歌故事：赛跑）', reader: 'pu2_race.html', wordCount: 14, exerciseCount: 5 },
        { id: 'pu3-u1-p9', book: 'PU3', unit: '1', page: '9', version: 1,
        title: 'Power Up 3 · Unit 1 · 第9页 · Question words（疑问词）', reader: 'pu3_u1_p9_notes.html' },
        { id: 'pu3-u1-p11', book: 'PU3', unit: '1', page: '11', version: 1,
        title: 'Power Up 3 · Unit 1 · 第10–11页 · Circus action verbs & can / could（马戏团动作与现在、过去的能力）', reader: 'pu3_u1_p11_notes.html' },
        { id: 'pu3-u1-p14', book: 'PU3', unit: '1', page: '14', version: 1,
        title: 'Power Up 3 · Unit 1 · 第14–15页 · The Circus Child（故事阅读：马戏团的孩子）', reader: 'pu3_circus.html', wordCount: 27, exerciseCount: 4 },
        { id: 'pu1-u0-p5', book: 'PU1', unit: '0', page: '5', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 0 · 第5页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u0-p5' },
        { id: 'pu1-u1-p8', book: 'PU1', unit: '1', page: '8', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 1 · 第8页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u1-p8' },
        { id: 'pu1-u2-p20', book: 'PU1', unit: '2', page: '20', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 2 · 第20页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u2-p20' },
        { id: 'pu1-u3-p32', book: 'PU1', unit: '3', page: '32', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 3 · 第32页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u3-p32' },
        { id: 'pu1-u4-p46', book: 'PU1', unit: '4', page: '46', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 4 · 第46页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u4-p46' },
        { id: 'pu1-u5-p58', book: 'PU1', unit: '5', page: '58', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 5 · 第58页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u5-p58' },
        { id: 'pu1-u6-p70', book: 'PU1', unit: '6', page: '70', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 6 · 第70页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u6-p70' },
        { id: 'pu1-u7-p84', book: 'PU1', unit: '7', page: '84', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 7 · 第84页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u7-p84' },
        { id: 'pu1-u8-p96', book: 'PU1', unit: '8', page: '96', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 8 · 第96页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u8-p96' },
        { id: 'pu1-u9-p108', book: 'PU1', unit: '9', page: '108', version: 1, libraryOnly: true,
        title: 'Power Up 1 · Unit 9 · 第108页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu1-u9-p108' },
        { id: 'pu2-u0-p5', book: 'PU2', unit: '0', page: '5', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 0 · 第5页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u0-p5' },
        { id: 'pu2-u1-p8', book: 'PU2', unit: '1', page: '8', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 1 · 第8页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u1-p8' },
        { id: 'pu2-u2-p20', book: 'PU2', unit: '2', page: '20', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 2 · 第20页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u2-p20' },
        { id: 'pu2-u3-p32', book: 'PU2', unit: '3', page: '32', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 3 · 第32页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u3-p32' },
        { id: 'pu2-u4-p46', book: 'PU2', unit: '4', page: '46', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 4 · 第46页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u4-p46' },
        { id: 'pu2-u5-p58', book: 'PU2', unit: '5', page: '58', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 5 · 第58页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u5-p58' },
        { id: 'pu2-u6-p70', book: 'PU2', unit: '6', page: '70', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 6 · 第70页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u6-p70' },
        { id: 'pu2-u7-p84', book: 'PU2', unit: '7', page: '84', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 7 · 第84页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u7-p84' },
        { id: 'pu2-u8-p96', book: 'PU2', unit: '8', page: '96', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 8 · 第96页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u8-p96' },
        { id: 'pu2-u9-p108', book: 'PU2', unit: '9', page: '108', version: 1, libraryOnly: true,
        title: 'Power Up 2 · Unit 9 · 第108页 · The Friendly Farm（友好农场故事）', reader: 'friendly_farm_notes.html?id=pu2-u9-p108' },
        { id: 'pu3-u0-p5', book: 'PU3', unit: '0', page: '5', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 0 · 第5页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u0-p5' },
        { id: 'pu3-u1-p8', book: 'PU3', unit: '1', page: '8', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 1 · 第8页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u1-p8' },
        { id: 'pu3-u2-p20', book: 'PU3', unit: '2', page: '20', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 2 · 第20页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u2-p20' },
        { id: 'pu3-u3-p32', book: 'PU3', unit: '3', page: '32', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 3 · 第32页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u3-p32' },
        { id: 'pu3-u4-p46', book: 'PU3', unit: '4', page: '46', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 4 · 第46页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u4-p46' },
        { id: 'pu3-u5-p58', book: 'PU3', unit: '5', page: '58', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 5 · 第58页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u5-p58' },
        { id: 'pu3-u6-p70', book: 'PU3', unit: '6', page: '70', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 6 · 第70页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u6-p70' },
        { id: 'pu3-u7-p84', book: 'PU3', unit: '7', page: '84', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 7 · 第84页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u7-p84' },
        { id: 'pu3-u8-p96', book: 'PU3', unit: '8', page: '96', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 8 · 第96页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u8-p96' },
        { id: 'pu3-u9-p108', book: 'PU3', unit: '9', page: '108', version: 1, libraryOnly: true,
        title: 'Power Up 3 · Unit 9 · 第108页 · Diversicus（马戏团故事）', reader: 'friendly_farm_notes.html?id=pu3-u9-p108' }];
    const find = id => catalog.find(note => note.id === id);
    const atPage = page => page && catalog.find(note => !note.libraryOnly && note.book === page.book && note.unit === String(page.unit) && note.page === String(page.page));
    function normalize(value) {
        const result = {};
        for (const note of catalog) {
            if (note.libraryOnly) continue;
            const entry = value && (value[note.id] || (note.id === 'phonics1-u2-p5' ? value['phonics1-u1-p4'] : null));
            if (entry && entry.version === note.version && Number.isFinite(Date.parse(entry.completedAt)))
                result[note.id] = { version: note.version, completedAt: new Date(entry.completedAt).toISOString() };
        }
        return result;
    }
    function fromEvents(events) {
        const result = {};
        for (const event of Array.isArray(events) ? events : []) {
            const marker = event && event.data && event.data.previewNote, note = marker && find(marker.id);
            if (!note || note.libraryOnly || event.type !== 'session' || event.sessionType !== 'study' || marker.version !== note.version
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
    // Access is independent of completion/version: a child keeps a familiar
    // story even if its exercises or preview notes are revised later.
    function mergePictureBooks(...sources) {
        const result = {};
        for (const source of sources) for (const note of catalog) {
            if (note.kind !== 'picture-book') continue;
            const entry = source && source[note.id];
            const when = entry && (entry.firstOpenedAt || entry.completedAt);
            if (!Number.isFinite(Date.parse(when))) continue;
            const firstOpenedAt = new Date(when).toISOString();
            if (!result[note.id] || firstOpenedAt < result[note.id].firstOpenedAt) result[note.id] = { firstOpenedAt };
        }
        return result;
    }
    function pictureBooksFromEvents(events) {
        const accessed = {};
        for (const event of Array.isArray(events) ? events : []) {
            if (event?.type !== 'picture-book-access' || find(event.data?.id)?.kind !== 'picture-book'
                || !Number.isFinite(Date.parse(event.timestamp))) continue;
            const firstOpenedAt = new Date(event.timestamp).toISOString();
            if (!accessed[event.data.id] || firstOpenedAt < accessed[event.data.id].firstOpenedAt) accessed[event.data.id] = { firstOpenedAt };
        }
        return mergePictureBooks(accessed, fromEvents(events));
    }
    function apply(user, events) {
        const progress = merge(user.previewNotes, fromEvents(events));
        if (Object.keys(progress).length) user.previewNotes = progress;
        const pictureBooks = mergePictureBooks(user.pictureBooks, pictureBooksFromEvents(events), progress);
        if (Object.keys(pictureBooks).length) user.pictureBooks = pictureBooks;
        return progress;
    }
    const api = { catalog, find, atPage, normalize, fromEvents, merge, apply, mergePictureBooks, pictureBooksFromEvents };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PreviewNotesState = api;
})(typeof window !== 'undefined' ? window : globalThis);
