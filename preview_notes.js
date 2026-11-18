(function () {
    'use strict';
    const core = window.PreviewNotesState;
    if (!core) return; // A missing optional note asset must not break login.
    let viewer = null, opening = null, pendingLogin = null, loginReady = false;
    const BOOK_LABELS = {
        PU1: 'Power Up 1',
        PU2: 'Power Up 2',
        PU3: 'Power Up 3',
        Think0: 'Think S',
        Think1: 'Think 1',
        Think2: 'Think 2'
    };
    const BOOK_ORDER = ['PU1', 'PU2', 'PU3', 'Think0', 'Think1', 'Think2'];
    const UNIT_TITLES = {
        PU1: {
            1: { en: 'Our new school', zh: '我们的新学校' },
            2: { en: 'All about us', zh: '关于我们' },
            3: { en: 'Fun on the farm', zh: '农场的乐趣' },
            4: { en: 'Food with friends', zh: '与朋友共享美食' },
            5: { en: 'Happy birthday!', zh: '生日快乐！' },
            6: { en: 'A day out', zh: '外出的一天' },
            7: { en: 'Let’s play!', zh: '一起来玩吧！' },
            8: { en: 'At home', zh: '在家里' },
            9: { en: 'Happy holidays', zh: '快乐假期' }
        },
        PU2: {
            1: { en: 'A day on the farm', zh: '农场的一天' },
            2: { en: 'My week', zh: '我的一周' },
            3: { en: 'Party time!', zh: '派对时间！' },
            4: { en: 'The family at home', zh: '在家的家人' },
            5: { en: 'Animal world', zh: '动物世界' },
            6: { en: 'Our weather', zh: '我们的天气' },
            7: { en: 'Let’s cook!', zh: '一起来做饭！' },
            8: { en: 'Around town', zh: '在城镇周围' },
            9: { en: 'A big change', zh: '大变化' }
        },
        PU3: {
            1: { en: 'Practice time', zh: '练习时间' },
            2: { en: 'What’s for breakfast?', zh: '早餐吃什么？' },
            3: { en: 'A healthy body', zh: '健康的身体' },
            4: { en: 'Fun in the jungle', zh: '丛林之乐' },
            5: { en: 'Behind the scenes', zh: '幕后故事' },
            6: { en: 'Classroom stars', zh: '课堂之星' },
            7: { en: 'When I grow up …', zh: '当我长大后……' },
            8: { en: 'City break', zh: '城市短途游' },
            9: { en: 'Let’s travel!', zh: '去旅行吧！' }
        },
        Think0: {
            1: { en: 'All together', zh: '欢聚一堂' },
            2: { en: 'I’m excited', zh: '我很兴奋' },
            3: { en: 'Family time', zh: '家庭时光' },
            4: { en: 'City life', zh: '城市生活' },
            5: { en: 'Free time', zh: '空闲时间' },
            6: { en: 'Best friends', zh: '最好的朋友' },
            7: { en: 'Living for sport', zh: '热爱运动' },
            8: { en: 'Feel the rhythm', zh: '感受节奏' },
            9: { en: 'Who’s hungry?', zh: '谁饿了？' },
            10: { en: 'Big successes', zh: '巨大的成功' },
            11: { en: 'The animal world', zh: '动物世界' },
            12: { en: 'Moving about', zh: '出行方式' }
        }
    };
    const NOTE_THUMBS = {
        'pu1-u5-p59': [{ label: 'PB p.59', src: 'images/notes_thumbs/pu1-u5-p59-pb-p59.webp' }, { label: 'AB p.59', src: 'images/notes_thumbs/pu1-u5-p59-ab-p59.webp' }],
        'pu1-u5-p61': [{ label: 'PB p.60', src: 'images/notes_thumbs/pu1-u5-p61-pb-p60.webp' }, { label: 'PB p.61', src: 'images/notes_thumbs/pu1-u5-p61-pb-p61.webp' }, { label: 'AB p.60', src: 'images/notes_thumbs/pu1-u5-p61-ab-p60.webp' }, { label: 'AB p.61', src: 'images/notes_thumbs/pu1-u5-p61-ab-p61.webp' }],
        'pu1-u7-p85': [{ label: 'PB p.85', src: 'images/notes_thumbs/pu1-u7-p85-pb-p85.webp' }, { label: 'AB p.85', src: 'images/notes_thumbs/pu1-u7-p85-ab-p85.webp' }],
        'pu1-u7-p87': [{ label: 'PB p.86', src: 'images/notes_thumbs/pu1-u7-p87-pb-p86.webp' }, { label: 'PB p.87', src: 'images/notes_thumbs/pu1-u7-p87-pb-p87.webp' }, { label: 'AB p.86', src: 'images/notes_thumbs/pu1-u7-p87-ab-p86.webp' }, { label: 'AB p.87', src: 'images/notes_thumbs/pu1-u7-p87-ab-p87.webp' }],
        'pu2-u1-p14': [{ label: 'PB p.14', src: 'images/notes_thumbs/pu2-u1-p14-pb-p14.webp' }, { label: 'PB p.15', src: 'images/notes_thumbs/pu2-u1-p14-pb-p15.webp' }, { label: 'AB p.14', src: 'images/notes_thumbs/pu2-u1-p14-ab-p14.webp' }, { label: 'AB p.15', src: 'images/notes_thumbs/pu2-u1-p14-ab-p15.webp' }],
        'pu2-u5-p59': [{ label: 'PB p.59', src: 'images/notes_thumbs/pu2-u5-p59-pb-p59.webp' }, { label: 'AB p.59', src: 'images/notes_thumbs/pu2-u5-p59-ab-p59.webp' }],
        'pu2-u5-p60': [{ label: 'PB p.60', src: 'images/notes_thumbs/pu2-u5-p60-pb-p60.webp' }, { label: 'PB p.61', src: 'images/notes_thumbs/pu2-u5-p60-pb-p61.webp' }, { label: 'AB p.60', src: 'images/notes_thumbs/pu2-u5-p60-ab-p60.webp' }, { label: 'AB p.61', src: 'images/notes_thumbs/pu2-u5-p60-ab-p61.webp' }],
        'pu2-u8-p95': [{ label: 'PB p.95', src: 'images/notes_thumbs/pu2-u8-p95-pb-p95.webp' }, { label: 'AB p.95', src: 'images/notes_thumbs/pu2-u8-p95-ab-p95.webp' }],
        'pu3-u1-p14': [{ label: 'PB p.14', src: 'images/notes_thumbs/pu3-u1-p14-pb-p14.webp' }, { label: 'PB p.15', src: 'images/notes_thumbs/pu3-u1-p14-pb-p15.webp' }, { label: 'AB p.14', src: 'images/notes_thumbs/pu3-u1-p14-ab-p14.webp' }, { label: 'AB p.15', src: 'images/notes_thumbs/pu3-u1-p14-ab-p15.webp' }],
        'pu3-u2-p19': [{ label: 'PB p.19', src: 'images/notes_thumbs/pu3-u2-p19-pb-p19.webp' }, { label: 'AB p.19', src: 'images/notes_thumbs/pu3-u2-p19-ab-p19.webp' }],
        'pu3-u3-p31': [{ label: 'PB p.31', src: 'images/notes_thumbs/pu3-u3-p31-pb-p31.webp' }, { label: 'AB p.31', src: 'images/notes_thumbs/pu3-u3-p31-ab-p31.webp' }],
        'pu3-u3-p35': [{ label: 'PB p.34', src: 'images/notes_thumbs/pu3-u3-p35-pb-p34.webp' }, { label: 'PB p.35', src: 'images/notes_thumbs/pu3-u3-p35-pb-p35.webp' }, { label: 'AB p.34', src: 'images/notes_thumbs/pu3-u3-p35-ab-p34.webp' }, { label: 'AB p.35', src: 'images/notes_thumbs/pu3-u3-p35-ab-p35.webp' }],
        'pu3-u3-p36': [{ label: 'PB p.36', src: 'images/notes_thumbs/pu3-u3-p36-pb-p36.webp' }, { label: 'AB p.36', src: 'images/notes_thumbs/pu3-u3-p36-ab-p36.webp' }],
        'pu3-u8-p97': [{ label: 'PB p.97', src: 'images/notes_thumbs/pu3-u8-p97-pb-p97.webp' }, { label: 'AB p.97', src: 'images/notes_thumbs/pu3-u8-p97-ab-p97.webp' }],
        'pu3-u8-p99': [{ label: 'PB p.98', src: 'images/notes_thumbs/pu3-u8-p99-pb-p98.webp' }, { label: 'PB p.99', src: 'images/notes_thumbs/pu3-u8-p99-pb-p99.webp' }, { label: 'AB p.98', src: 'images/notes_thumbs/pu3-u8-p99-ab-p98.webp' }, { label: 'AB p.99', src: 'images/notes_thumbs/pu3-u8-p99-ab-p99.webp' }],
        'pu3-u9-p111': [{ label: 'PB p.111', src: 'images/notes_thumbs/pu3-u9-p111-pb-p111.webp' }, { label: 'AB p.111', src: 'images/notes_thumbs/pu3-u9-p111-ab-p111.webp' }],
        'pu3-u9-p112': [{ label: 'PB p.112', src: 'images/notes_thumbs/pu3-u9-p112-pb-p112.webp' }, { label: 'PB p.113', src: 'images/notes_thumbs/pu3-u9-p112-pb-p113.webp' }, { label: 'AB p.112', src: 'images/notes_thumbs/pu3-u9-p112-ab-p112.webp' }, { label: 'AB p.113', src: 'images/notes_thumbs/pu3-u9-p112-ab-p113.webp' }],
        'pu3-u9-p114': [{ label: 'PB p.114', src: 'images/notes_thumbs/pu3-u9-p114-pb-p114.webp' }, { label: 'PB p.115', src: 'images/notes_thumbs/pu3-u9-p114-pb-p115.webp' }, { label: 'AB p.114', src: 'images/notes_thumbs/pu3-u9-p114-ab-p114.webp' }, { label: 'AB p.115', src: 'images/notes_thumbs/pu3-u9-p114-ab-p115.webp' }],
        'think0-u4-p44': [{ label: 'SB p.44', src: 'images/notes_thumbs/think0-u4-p44-sb-p44.webp' }],
        'think0-u4-wb41': [{ label: 'WB p.41', src: 'images/notes_thumbs/think0-u4-wb41-wb-p41.webp' }]
    };

    function enabled() {
        const host = location.hostname;
        return /^\/Classroom-survivors(?:-preview)?(?:\/|$)/i.test(location.pathname)
            || location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
    }
    const user = () => typeof authActiveUser === 'undefined' ? null : authActiveUser;
    function remapPlacement(placement) {
        if (!enabled() || !placement) return placement;
        if (placement.book === 'PU1' && String(placement.unit) === '7'
            && String(placement.page) === '84') placement.page = '85';
        if (placement.book === 'PU1' && String(placement.unit) === '5'
            && String(placement.page) === '60') placement.page = '61';
        if (placement.book === 'PU3' && String(placement.unit) === '8'
            && String(placement.page) === '98') placement.page = '99';
        return placement;
    }
    const isStudent = student => student && !['teacher', 'BM', 'admin'].includes(student.role);
    const key = student => 'csPreviewNotes:' + (/Classroom-survivors-preview/i.test(location.pathname) ? 'preview:' : /^\/Classroom-survivors(?:\/|$)/i.test(location.pathname) ? 'production:' : 'local:') + student.id;
    function bookLabel(book) {
        const raw = String(book || '');
        if (BOOK_LABELS[raw]) return BOOK_LABELS[raw];
        const pu = raw.match(/^PU(\d+)$/i);
        if (pu) return 'Power Up ' + pu[1];
        const think = raw.match(/^Think(\d+)$/i);
        if (think) return think[1] === '0' ? 'Think S' : 'Think ' + think[1];
        return raw;
    }
    function unitMeta(book, unit) {
        return (UNIT_TITLES[String(book || '')] || {})[String(unit || '')] || null;
    }
    function unitHeadingText(book, unit) {
        const meta = unitMeta(book, unit);
        return meta ? 'Unit ' + unit + ' · ' + meta.en : 'Unit ' + unit;
    }
    function noteThumbs(note) {
        return Array.isArray(note.thumbs) ? note.thumbs : (NOTE_THUMBS[note.id] || []);
    }
    function compareBooks(a, b) {
        const ia = BOOK_ORDER.indexOf(a), ib = BOOK_ORDER.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return String(a).localeCompare(String(b), undefined, { numeric: true });
    }
    function compareUnits(a, b) {
        return String(a).localeCompare(String(b), undefined, { numeric: true });
    }
    function pageSortKey(page) {
        const raw = String(page || '');
        const num = raw.match(/^(\d+)/);
        if (num) return [0, parseInt(num[1], 10), raw];
        const anyNum = raw.match(/(\d+)/);
        return [1, anyNum ? parseInt(anyNum[1], 10) : 0, raw];
    }
    function compareNotes(a, b) {
        const ka = pageSortKey(a.page), kb = pageSortKey(b.page);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        if (ka[1] !== kb[1]) return ka[1] - kb[1];
        return ka[2].localeCompare(kb[2], undefined, { numeric: true }) || a.id.localeCompare(b.id);
    }
    function buildCatalogTree() {
        const bookMap = new Map();
        for (const note of core.catalog) {
            let bookEntry = bookMap.get(note.book);
            if (!bookEntry) {
                bookEntry = { book: note.book, label: bookLabel(note.book), unitMap: new Map() };
                bookMap.set(note.book, bookEntry);
            }
            const unitKey = String(note.unit);
            let unitNotes = bookEntry.unitMap.get(unitKey);
            if (!unitNotes) {
                unitNotes = [];
                bookEntry.unitMap.set(unitKey, unitNotes);
            }
            unitNotes.push(note);
        }
        const books = Array.from(bookMap.values())
            .sort((a, b) => compareBooks(a.book, b.book))
            .map(entry => {
                const units = Array.from(entry.unitMap.entries())
                    .sort(([ua], [ub]) => compareUnits(ua, ub))
                    .map(([unit, notes]) => ({
                        unit,
                        notes: notes.slice().sort(compareNotes)
                    }));
                const noteCount = units.reduce((sum, u) => sum + u.notes.length, 0);
                return { book: entry.book, label: entry.label, units, noteCount };
            });
        return { books };
    }
    function currentAssignment(student) {
        const fallback = typeof selectedClassContent !== 'undefined' ? selectedClassContent : null;
        const source = (student && student.book && student.unit)
            ? student
            : (fallback && fallback.book && fallback.unit ? fallback : null);
        if (!source) return null;
        const placement = remapPlacement({
            book: String(source.book),
            unit: String(source.unit),
            page: source.page != null ? String(source.page) : ''
        });
        return { ...placement, note: placement.page ? core.atPage(placement) || null : null };
    }
    function progress(student) {
        if (!student || !core) return {};
        let cached = {};
        try { cached = JSON.parse(localStorage.getItem(key(student)) || '{}'); } catch (_) {}
        return core.merge(student.previewNotes, cached, core.fromEvents(student.analytics));
    }
    function complete(student, id) { return !!progress(student)[id]; }
    function blocksAdvance(student, page) {
        if (!enabled() || typeof isTestMode !== 'undefined' && isTestMode || !isStudent(student)) return false;
        const note = core.atPage(page);
        return !!note && !complete(student, note.id);
    }
    function close() {
        opening = null;
        if (viewer) {
            try { viewer.querySelector('iframe')?.contentWindow?.NotesSpeech?.dispose(); } catch (_) {} viewer.remove(); viewer = null;
        }
        document.body.classList.remove('preview-notes-open');
    }
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function shell(title, actions = []) {
        close();
        const overlay = el('section'); overlay.id = 'preview-notes-overlay';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', title);
        const header = el('header'), heading = el('h2', '', title), controls = el('div', 'preview-notes-header-actions');
        actions.forEach(item => {
            const btn = el('button', item.className || '', item.label);
            btn.type = 'button'; btn.onclick = item.onClick;
            controls.append(btn);
        });
        const back = el('button', 'preview-notes-close-btn', '返回主界面'); back.type = 'button'; back.onclick = close;
        controls.append(back);
        header.append(heading, controls); overlay.append(header); document.body.append(overlay);
        document.body.classList.add('preview-notes-open'); viewer = overlay; back.focus();
        return overlay;
    }
    function openNote(id, review, returnView) {
        const student = user(), note = core.find(id);
        if (!enabled() || !isStudent(student) || !note) return;
        if (!review && (!core.atPage(student) || core.atPage(student).id !== id)) return;
        const actions = returnView
            ? [{ label: '← 返回目录', className: 'preview-notes-back-btn', onClick: () => openLibrary(returnView) }]
            : [];
        const overlay = shell(note.title + ' · 预习笔记', actions);
        const request = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        const frame = document.createElement('iframe'); frame.title = note.title + ' 点读预习'; frame.allow = 'autoplay; microphone';
        opening = { id, review: !!review, owner: student.id, request, frame };
        const url = new URL(note.reader, location.href);
        url.searchParams.set('embed', '1'); url.searchParams.set('mode', review ? 'review' : 'intro'); url.searchParams.set('request', request);
        url.searchParams.set('v', '2026-11-05m'); frame.src = url.href; overlay.append(frame);
    }
    function makeShortcutButton(assignment, unitNotes) {
        const btn = el('button', 'preview-notes-shortcut-btn');
        btn.type = 'button';
        const top = el('span', 'preview-notes-shortcut-top');
        top.append(el('span', 'preview-notes-badge badge-current', '当前单元'));
        const meta = unitMeta(assignment.book, assignment.unit);
        const unitDesc = meta ? ' · ' + meta.en + '（' + meta.zh + '）' : '';
        top.append(el('span', 'preview-notes-shortcut-title', '回到当前单元：' + bookLabel(assignment.book) + ' · Unit ' + assignment.unit + unitDesc));
        const sub = el('span', 'preview-notes-shortcut-sub', '一键直达正在学习的单元（共 ' + unitNotes.length + ' 篇笔记）');
        btn.append(top, sub);
        btn.onclick = () => openLibrary({ view: 'unit', book: assignment.book, unit: assignment.unit });
        return btn;
    }
    function openLibrary(options) {
        const student = user();
        if (!enabled() || !isStudent(student)) return;
        const tree = buildCatalogTree();
        const done = progress(student);
        const current = core.atPage(student);
        const assignment = currentAssignment(student);
        const assignedBookEntry = assignment ? tree.books.find(b => b.book === assignment.book) : null;
        const assignedUnitEntry = assignedBookEntry ? assignedBookEntry.units.find(u => u.unit === assignment.unit) : null;
        const hasAssignedUnit = !!(assignedUnitEntry && assignedUnitEntry.notes.length);

        let view = options && options.view;
        let book = options && options.book;
        let unit = options && options.unit != null ? String(options.unit) : undefined;
        if (!view) {
            if (hasAssignedUnit) { view = 'unit'; book = assignedBookEntry.book; unit = assignedUnitEntry.unit; }
            else { view = 'books'; }
        }
        const selectedBook = book ? tree.books.find(b => b.book === book) : null;
        if ((view === 'book' || view === 'unit') && !selectedBook) view = 'books';
        const selectedUnit = view === 'unit' && selectedBook ? selectedBook.units.find(u => u.unit === unit) : null;
        if (view === 'unit' && !selectedUnit) view = selectedBook ? 'book' : 'books';

        const headerTitle = view === 'unit'
            ? '预习笔记 · ' + selectedBook.label + ' · Unit ' + selectedUnit.unit
            : view === 'book'
                ? '预习笔记 · ' + selectedBook.label
                : '预习笔记 · 全部教材';
        const overlay = shell(headerTitle);
        const scroll = el('div', 'preview-notes-scroll');
        const list = el('div', 'preview-notes-library');

        if (!tree.books.length) {
            list.append(el('p', 'preview-notes-empty', '暂时还没有可查看的预习笔记。'));
            scroll.append(list); overlay.append(scroll);
            return;
        }

        if (view === 'books') {
            if (hasAssignedUnit) list.append(makeShortcutButton(assignment, assignedUnitEntry.notes));
            const intro = el('div', 'preview-notes-section-head');
            intro.append(el('h3', '', '请选择教材'));
            intro.append(el('p', '', '先选教材，再选单元，就能查看全部预习笔记。'));
            list.append(intro);

            const grid = el('div', 'preview-notes-grid');
            tree.books.forEach(entry => {
                const isCurrentBook = !!(assignment && assignment.book === entry.book);
                const doneCount = entry.units.reduce((sum, u) => sum + u.notes.filter(n => done[n.id]).length, 0);
                const btn = el('button', 'preview-notes-card preview-notes-book-card' + (isCurrentBook ? ' is-current' : ''));
                btn.type = 'button';
                btn.dataset.book = entry.book;
                const main = el('div', 'preview-notes-card-main');
                const titleRow = el('div', 'preview-notes-card-title-row');
                titleRow.append(el('span', 'preview-notes-card-title', entry.label));
                if (isCurrentBook) titleRow.append(el('span', 'preview-notes-badge badge-current', '当前教材'));
                const metaText = entry.units.length + ' 个单元 · ' + entry.noteCount + ' 篇笔记'
                    + (doneCount ? ' · 已预习 ' + doneCount + ' 篇' : '');
                main.append(titleRow, el('span', 'preview-notes-card-meta', metaText));
                btn.append(main, el('span', 'preview-notes-chevron', '›'));
                btn.onclick = () => openLibrary({ view: 'book', book: entry.book });
                grid.append(btn);
            });
            list.append(grid);
        } else if (view === 'book') {
            const nav = el('div', 'preview-notes-nav');
            const backBooks = el('button', 'preview-notes-nav-btn', '← 全部教材');
            backBooks.type = 'button';
            backBooks.onclick = () => openLibrary({ view: 'books' });
            nav.append(backBooks);
            if (hasAssignedUnit && assignment.book !== selectedBook.book) {
                const jump = el('button', 'preview-notes-nav-btn preview-notes-nav-jump', '回到当前单元');
                jump.type = 'button';
                jump.onclick = () => openLibrary({ view: 'unit', book: assignment.book, unit: assignment.unit });
                nav.append(jump);
            }
            list.append(nav);

            const intro = el('div', 'preview-notes-section-head');
            intro.append(el('h3', '', selectedBook.label + ' · 请选择单元'));
            intro.append(el('p', '', '点击对应单元，查看该单元的预习笔记。'));
            list.append(intro);

            const grid = el('div', 'preview-notes-grid');
            selectedBook.units.forEach(u => {
                const isCurrentUnit = !!(assignment && assignment.book === selectedBook.book && assignment.unit === u.unit);
                const doneCount = u.notes.filter(n => done[n.id]).length;
                const uMeta = unitMeta(selectedBook.book, u.unit);
                const btn = el('button', 'preview-notes-card preview-notes-unit-card' + (isCurrentUnit ? ' is-current' : ''));
                btn.type = 'button';
                btn.dataset.unit = u.unit;
                const main = el('div', 'preview-notes-card-main');
                const titleRow = el('div', 'preview-notes-card-title-row');
                titleRow.append(el('span', 'preview-notes-card-title', unitHeadingText(selectedBook.book, u.unit)));
                if (isCurrentUnit) titleRow.append(el('span', 'preview-notes-badge badge-current', '当前单元'));
                const unitZh = uMeta ? '第 ' + u.unit + ' 单元：' + uMeta.zh + ' · ' : '第 ' + u.unit + ' 单元 · ';
                const metaText = unitZh + u.notes.length + ' 篇笔记' + (doneCount ? ' · 已预习 ' + doneCount + '/' + u.notes.length : '');
                main.append(titleRow, el('span', 'preview-notes-card-meta', metaText));
                btn.append(main, el('span', 'preview-notes-chevron', '›'));
                btn.onclick = () => openLibrary({ view: 'unit', book: selectedBook.book, unit: u.unit });
                grid.append(btn);
            });
            list.append(grid);
        } else {
            const isAssignedUnitView = !!(assignment && assignment.book === selectedBook.book && assignment.unit === selectedUnit.unit);
            const nav = el('div', 'preview-notes-nav');
            const backBook = el('button', 'preview-notes-nav-btn', '← 本教材其他单元');
            backBook.type = 'button';
            backBook.onclick = () => openLibrary({ view: 'book', book: selectedBook.book });
            const allBooks = el('button', 'preview-notes-nav-btn', '📚 全部教材');
            allBooks.type = 'button';
            allBooks.onclick = () => openLibrary({ view: 'books' });
            nav.append(backBook, allBooks);
            if (hasAssignedUnit && !isAssignedUnitView) {
                const jump = el('button', 'preview-notes-nav-btn preview-notes-nav-jump', '回到当前单元');
                jump.type = 'button';
                jump.onclick = () => openLibrary({ view: 'unit', book: assignment.book, unit: assignment.unit });
                nav.append(jump);
            }
            list.append(nav);

            const intro = el('div', 'preview-notes-section-head');
            const titleLine = el('div', 'preview-notes-card-title-row');
            const uMeta = unitMeta(selectedBook.book, selectedUnit.unit);
            const unitTitleFull = uMeta
                ? selectedBook.label + ' · Unit ' + selectedUnit.unit + ' · ' + uMeta.en + '（第 ' + selectedUnit.unit + ' 单元：' + uMeta.zh + '）'
                : selectedBook.label + ' · 第 ' + selectedUnit.unit + ' 单元 (Unit ' + selectedUnit.unit + ')';
            titleLine.append(el('h3', '', unitTitleFull));
            if (isAssignedUnitView) titleLine.append(el('span', 'preview-notes-badge badge-current', '当前单元'));
            intro.append(titleLine);
            intro.append(el('p', '', '共 ' + selectedUnit.notes.length + ' 篇预习笔记，对照课本页码和缩略图点击即可点读。'));
            list.append(intro);

            const noteList = el('div', 'preview-notes-note-list');
            selectedUnit.notes.forEach(note => {
                const isDone = !!done[note.id];
                const isCurrentPage = !!(current && current.id === note.id);
                const canStartStudy = isCurrentPage && !isDone;
                const thumbs = noteThumbs(note);
                const button = el('button', 'preview-notes-card preview-notes-note-card'
                    + (isCurrentPage ? ' is-current' : '')
                    + (isDone ? ' is-done' : ''));
                button.type = 'button';
                button.dataset.noteId = note.id;

                const topRow = el('div', 'preview-notes-note-top');
                const main = el('div', 'preview-notes-card-main');
                main.append(el('span', 'preview-notes-note-title', note.title));
                const badges = el('div', 'preview-notes-badges');
                if (isCurrentPage) badges.append(el('span', 'preview-notes-badge badge-current', '当前学习'));
                if (isDone) {
                    badges.append(el('span', 'preview-notes-badge badge-done', '✓ 已预习'));
                    badges.append(el('span', 'preview-notes-action', '再看一遍'));
                } else if (canStartStudy) {
                    badges.append(el('span', 'preview-notes-action action-primary', '开始预习'));
                } else {
                    badges.append(el('span', 'preview-notes-action', '点读查看'));
                }
                topRow.append(main, badges);
                button.append(topRow);

                if (thumbs.length) {
                    const strip = el('div', 'preview-notes-thumbs');
                    let prevPrefix = null;
                    thumbs.forEach(item => {
                        const prefix = String(item.label || '').split(/\s+/)[0];
                        if (prevPrefix && prefix && prefix !== prevPrefix) {
                            strip.append(el('span', 'preview-notes-thumb-sep', ''));
                        }
                        prevPrefix = prefix;
                        const fig = el('div', 'preview-notes-thumb');
                        const img = document.createElement('img');
                        img.src = item.src;
                        img.alt = item.label;
                        img.loading = 'lazy';
                        img.decoding = 'async';
                        fig.append(img, el('span', 'preview-notes-thumb-label', item.label));
                        strip.append(fig);
                    });
                    button.append(strip);
                }

                button.onclick = () => openNote(note.id, !canStartStudy, { view: 'unit', book: selectedBook.book, unit: selectedUnit.unit });
                noteList.append(button);
            });
            list.append(noteList);
        }

        scroll.append(list);
        overlay.append(scroll);
    }
    function continueLogin() {
        loginReady = true;
        onMainMenu();
    }
    function onMainMenu() {
        if (!loginReady || !pendingLogin || user() !== pendingLogin) return;
        if (document.getElementById('startScreen')?.classList.contains('hidden')
            || document.getElementById('step-greeting')?.classList.contains('hidden')
            || document.getElementById('study-resume-dialog') || document.getElementById('game-resume-dialog')
            || window.StudyRecovery?.active() || window.GameRecovery?.active()) return;
        const student = pendingLogin;
        pendingLogin = null;
        const note = core.atPage(student);
        if (note && !complete(student, note.id)) openNote(note.id, false);
    }
    function onLogin({ defer = false } = {}) {
        close(); const student = user(), button = document.getElementById('preview-notes-button');
        const active = enabled() && isStudent(student) && !(typeof isTestMode !== 'undefined' && isTestMode);
        if (button) button.classList.toggle('hidden', !active);
        pendingLogin = active ? student : null; loginReady = !defer;
        if (!active) return;
        student.previewNotes = progress(student);
        const note = core.atPage(student);
        if (note?.id === 'think0-u4-p44' && window.ThinkParks) ThinkParks.prefetchAudio('words');
        onMainMenu();
    }
    function prepareStudy(id) {
        const student = user(), note = core.find(id);
        if (!enabled() || !isStudent(student) || !note || !core.atPage(student) || core.atPage(student).id !== id) return null;
        if (!selectedClassContent || !core.atPage(selectedClassContent) || core.atPage(selectedClassContent).id !== id) return null;
        const article = window.ArticleStudy?.get(id);
        if (article) {
            return { words: article.words.slice(0, 5).map(word => word[0]), exercises: null,
                context: { id: note.id, owner: student.id, book: note.book, unit: note.unit, page: note.page, version: note.version } };
        }
        const content = TEACHING_CONTENT[note.book]?.[note.unit]?.[note.page];
        const words = shuffleArray(Array.from(new Set(content?.vocab || []))).slice(0, 5);
        const exercises = NonSpellingContent.selectPage(note.book, note.unit, note.page, 5);
        if (words.length !== 5 || exercises.length !== 5) { showStudyNotice('这一页的学习内容暂时没有准备好，请稍后再试。'); return null; }
        return { words, exercises, context: { id: note.id, owner: student.id, book: note.book, unit: note.unit, page: note.page, version: note.version } };
    }
    function completeStudy() {
        const student = user(), state = typeof STUDY_STATE === 'undefined' ? null : STUDY_STATE, context = state && state.previewNote;
        const article = window.ArticleStudy?.get(context?.id);
        if (article) {
            if (!student || context.owner !== student.id || !state.active
                || state.parks?.set !== article.setCount - 1 || state.currentSentenceIndex !== article.exerciseCount) return null;
            const { owner, ...marker } = context;
            return { ...marker, wordCount: article.words.length, exerciseCount: article.exerciseCount };
        }
        if (!context || !student || context.owner !== student.id || !state.active || state.words.length !== 5
            || !state.nonSpellingExercises || state.nonSpellingExercises.length !== 5 || state.currentNonSpellingIndex !== 5) return null;
        const { owner, ...marker } = context;
        return { ...marker, wordCount: 5, exerciseCount: 5 };
    }
    function markComplete(marker) {
        const student = user(); if (!student || !marker) return;
        const event = { type: 'session', sessionType: 'study', timestamp: new Date().toISOString(), data: { previewNote: marker } };
        student.previewNotes = core.merge(progress(student), core.fromEvents([event]));
        const button = document.getElementById('preview-notes-button');
        if (button) button.classList.remove('hidden');
        try { localStorage.setItem(key(student), JSON.stringify(student.previewNotes)); } catch (_) {}
        if (typeof saveActiveUserToCache === 'function') saveActiveUserToCache();
        if (typeof checkAndAdvancePageIfAllOnCooldown === 'function') checkAndAdvancePageIfAllOnCooldown();
    }
    window.addEventListener('message', event => {
        const current = opening, student = user();
        if (!current || !student || current.owner !== student.id || event.source !== current.frame.contentWindow
            || event.origin !== location.origin || event.data?.request !== current.request) return;
        if (event.data.action === 'close-note') close();
        if (event.data.action === 'start-note-study' && !current.review) {
            if (initStudyMode({ previewNoteId: current.id })) close();
            else current.frame.contentWindow.postMessage({ action: 'note-study-error', request: current.request }, location.origin);
        }
    });
    window.PreviewNotes = { isReader: frame => !!opening && opening.frame.contentWindow === frame && user()?.id === opening.owner, onLogin, continueLogin, onMainMenu, close, openLibrary, openNote, blocksAdvance, prepareStudy, completeStudy, markComplete, enabled, remapPlacement, bookLabel, unitMeta, buildCatalogTree };
})();
