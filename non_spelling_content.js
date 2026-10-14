// Shared curriculum and SR selection for the mixed non-spelling round.
(() => {
    'use strict';
    const catalog = {
        missing: [
            { id: 'M1', sentences: ['I washed my hands ___ I ate lunch.', 'I ate lunch ___ I washed my hands.'], answers: ['before', 'after'] },
            { id: 'M2', sentences: ['He put on his socks ___ he put on his shoes.', 'He put on his shoes ___ he put on his socks.'], answers: ['before', 'after'] },
            { id: 'M3', sentences: ['We bought tickets ___ we went into the cinema.', 'We went into the cinema ___ we bought tickets.'], answers: ['before', 'after'] },
            { id: 'M4', sentences: ['She dried her hair ___ she had a shower.', 'She had a shower ___ she dried her hair.'], answers: ['after', 'before'] },
            { id: 'M5', sentences: ['I cleaned my teeth ___ I went to bed.', 'I laughed ___ I heard the funny joke.'], answers: ['before', 'when'] },
            { id: 'M6', sentences: ['He had breakfast ___ he got dressed.', 'I waved ___ I saw my friend.'], answers: ['after', 'when'] }
        ],
        fix: [
            { id: 'F1', sentence: 'I washed my hands after I ate lunch.', wrongWord: 'after', answer: 'before' },
            { id: 'F2', sentence: 'He put on his shoes before he put on his socks.', wrongWord: 'before', answer: 'after' },
            { id: 'F3', sentence: 'We bought tickets after we went into the cinema.', wrongWord: 'after', answer: 'before' },
            { id: 'F4', sentence: 'She dried her hair before she had a shower.', wrongWord: 'before', answer: 'after' },
            { id: 'F5', sentence: 'I laughed before I heard the funny joke.', wrongWord: 'before', answer: 'when' },
            { id: 'F6', sentence: 'I waved before I saw my friend.', wrongWord: 'before', answer: 'when' },
            { id: 'F7', sentence: 'He put on his socks when he put on his shoes.', wrongWord: 'when', answer: 'before' },
            { id: 'F8', sentence: 'She dried her hair when she had a shower.', wrongWord: 'when', answer: 'after' }
        ]
    };

    // Approved Unit 1 boards remain grouped under the existing page 16 entry.
    const unit1Catalog = {
        missing: [
            { id: 'M1', sentences: ["It's 7:30. It's half ___ seven.", "It's twelve o'clock at night. It's ___."], answers: ['past', 'midnight'] },
            { id: 'M2', sentences: ["I have breakfast ___ seven o'clock.", 'We practise ___ Mondays.'], answers: ['at', 'on'] },
            { id: 'M3', sentences: ['___ do you live? In Russia.', "___ are you running? Because I'm late."], answers: ['where', 'why'] },
            { id: 'M4', sentences: ['___ helps you with your homework? My brother.', '___ many acrobats are there? Four.'], answers: ['who', 'how'] },
            { id: 'M5', sentences: ['She is ___ on one leg.', 'They are ___ up as clowns.'], answers: ['hopping', 'dressing'] },
            { id: 'M7', sentences: ['When I ___ four, I could hop.', 'When we ___ six, we could skip.'], answers: ['was', 'were'] },
            { id: 'M8', sentences: ['I ___ hop on one leg when I was four.', "I couldn't ___ a bike when I was two."], answers: ['could', 'ride'] },
            { id: 'M11', sentences: ['Anastasia practises ___ day.', 'She performs ___ stage.'], answers: ['every', 'on'] },
            { id: 'M12', sentences: ['The clowns ___ dancing.', 'The boy ___ clapping.'], answers: ['are', 'is'] },
            { id: 'M13', sentences: ['___ is your favourite sport? Tennis.', '___ do you practise? On Saturdays.'], answers: ['what', 'when'] },
            { id: 'M14', sentences: ['___ bag is yours: the red one or the blue one? The red one.', "___ bag is this? It's Lily's."], answers: ['which', 'whose'] },
            { id: 'M15', sentences: ["___ old is your brother? He's ten.", '___ is your teacher? Mr Friendly.'], answers: ['how', 'who'] },
            { id: 'M16', sentences: ['___ are my shoes? Under the bed.', '___ do acrobats practise? Because they want to improve.'], answers: ['where', 'why'] },
            { id: 'M17', sentences: ['I ___ five when I could ride a bike.', 'My brothers ___ seven when they could climb trees.'], answers: ['was', 'were'] },
            { id: 'M18', sentences: ['He ___ three when he could hop.', 'They ___ six when they could skip.'], answers: ['was', 'were'] },
            { id: 'M19', sentences: ['I ___ ride a bike when I was two,', 'but I ___ do it now.'], answers: ["couldn't", 'can'] },
            { id: 'M20', sentences: ['My grandma ___ do gymnastics when she was eighteen,', 'but she ___ do it anymore.'], answers: ['could', "can't"] },
            { id: 'M21', sentences: ["I couldn't ___ in the swimming pool when I was two.", 'I could ___ a bike when I was six.'], answers: ['swim', 'ride'] },
            { id: 'M22', sentences: ['I ___ swim when I was two,', 'but after lots of practice I ___ swim now.'], answers: ["couldn't", 'can'] },
            { id: 'M23', sentences: ['My grandpa ___ climb trees when he was young,', 'but he ___ climb them anymore.'], answers: ['could', "can't"] }
        ],
        fix: [
            { id: 'F1', sentence: "It's 7:30. It's half to seven.", wrongWord: 'to', answer: 'past' },
            { id: 'F2', sentence: "It's twelve o'clock at night. It's midday.", wrongWord: 'midday', answer: 'midnight' },
            { id: 'F3', sentence: 'When do you live? In Russia.', wrongWord: 'when', answer: 'where' },
            { id: 'F4', sentence: "Who are you running? Because I'm late.", wrongWord: 'who', answer: 'why' },
            { id: 'F5', sentence: 'The acrobats is practising.', wrongWord: 'is', answer: 'are' },
            { id: 'F6', sentence: 'The clown is climb a ladder.', wrongWord: 'climb', answer: 'climbing' },
            { id: 'F7', sentence: 'I were four when I could hop on one leg.', wrongWord: 'were', answer: 'was' },
            { id: 'F8', sentence: 'Could you swimming when you were five?', wrongWord: 'swimming', answer: 'swim' },
            { id: 'F11', sentence: 'Anastasia practises every days.', wrongWord: 'days', answer: 'day' },
            { id: 'F12', sentence: 'There are thirteen clown in the circus.', wrongWord: 'clown', answer: 'clowns' },
            { id: 'F13', sentence: 'Where colour is your bag? Blue.', wrongWord: 'where', answer: 'what' },
            { id: 'F14', sentence: "Who's bag is this? It's Lily's.", wrongWord: "who's", answer: 'whose' },
            { id: 'F15', sentence: 'Why many clowns are there? Three.', wrongWord: 'why', answer: 'how' },
            { id: 'F16', sentence: 'Who do you practise? On Saturdays.', wrongWord: 'who', answer: 'when' },
            { id: 'F17', sentence: 'We was six when we could skip.', wrongWord: 'was', answer: 'were' },
            { id: 'F18', sentence: 'He were five when he could swim.', wrongWord: 'were', answer: 'was' },
            { id: 'F19', sentence: 'You is very good at climbing.', wrongWord: 'is', answer: 'are' },
            { id: 'F20', sentence: 'She are dressing up as a clown.', wrongWord: 'are', answer: 'is' },
            { id: 'F21', sentence: "I can't ride a bike when I was two, but I can do it now.", wrongWord: "can't", answer: "couldn't" },
            { id: 'F22', sentence: "My grandma could do gymnastics when she was eighteen, but she couldn't do it anymore now.", wrongWord: "couldn't", answer: "can't" },
            { id: 'F23', sentence: "I couldn't swim when I was two, but after lots of practice I could swim now.", wrongWord: 'could', answer: 'can' },
            { id: 'F24', sentence: "My grandpa can climb trees when he was young, but he can't climb them anymore.", wrongWord: 'can', answer: 'could' }
        ]
    };
    const unit2Catalog = {
        missing: [
            { id: 'M1', sentences: ["She's the woman ___ makes the noodles.", 'This is the sauce ___ we put on pancakes.'], answers: ['who', 'which'] },
            { id: 'M2', sentences: ['This is the café ___ we have breakfast.', 'These are the pancakes ___ we ate.'], answers: ['where', 'which'] },
            { id: 'M3', sentences: ["He's the man ___ taught me to swim.", "That's the pool ___ I learned to swim."], answers: ['who', 'where'] },
            { id: 'M4', sentences: ['This is the woman ___ works in the café.', 'This is the camera ___ I use to take photos.', 'This is the café ___ we eat.'], answers: ['who', 'which', 'where'] },
            { id: 'M5', sentences: ['This is the restaurant ___ we ate noodles.', 'This is the woman ___ cooked them.', 'These are the noodles ___ she cooked.'], answers: ['where', 'who', 'which'] },
            { id: 'M6', sentences: ['This is the photo ___ I took yesterday.', 'This is the boy ___ took the photo.'], answers: ['which', 'who'] },
            { id: 'M7', sentences: ['Yesterday, Dad ___ our car to town.', 'Last night, I ___ an email to Grandma.'], answers: ['drove', 'wrote'] },
            { id: 'M8', sentences: ['Last year, she ___ English at my school.', 'Yesterday, Dad ___ me a milkshake.'], answers: ['taught', 'gave'] },
            { id: 'M9', sentences: ['We ___ a film at the cinema yesterday.', 'I ___ a photo with my camera yesterday.'], answers: ['saw', 'took'] },
            { id: 'M10', sentences: ['They ___ a tree house last summer.', 'My grandma ___ up in a small village.'], answers: ['built', 'grew'] },
            { id: 'M11', sentences: ['We ___ noodles for lunch yesterday.', 'Grandpa ___ me a story last night.'], answers: ['had', 'told'] },
            { id: 'M12', sentences: ['___ you see the film yesterday?', '___ your sister like pancakes now?'], answers: ['did', 'does'] },
            { id: 'M13', sentences: ["We didn't ___ a tree house yesterday.", 'We ___ one last summer.'], answers: ['build', 'built'] },
            { id: 'M14', sentences: ["She didn't ___ the email yesterday.", 'She ___ it this morning.'], answers: ['write', 'wrote'] },
            { id: 'M15', sentences: ['___ we finished lunch, we went to the funfair.', 'This is the funfair ___ we went after lunch.'], answers: ['when', 'where'] },
            { id: 'M16', sentences: ['When the bus ___, we got on it.', 'When we ___ lunch, we went to the funfair.'], answers: ['arrived', 'finished'] }
        ],
        fix: [
            { id: 'F1', sentence: "She's the woman which makes the noodles.", wrongWord: 'which', answer: 'who' },
            { id: 'F2', sentence: 'This is the café which we have breakfast.', wrongWord: 'which', answer: 'where' },
            { id: 'F3', sentence: 'This is the camera where I use to take photos.', wrongWord: 'where', answer: 'which' },
            { id: 'F4', sentence: "He's the teacher where helped me with my homework.", wrongWord: 'where', answer: 'who' },
            { id: 'F5', sentence: "That's the restaurant who sells pancakes.", wrongWord: 'who', answer: 'which' },
            { id: 'F6', sentence: 'This is the kitchen who my grandma cooks.', wrongWord: 'who', answer: 'where' },
            { id: 'F7', sentence: 'Yesterday, Dad drive our car to town.', wrongWord: 'drive', answer: 'drove' },
            { id: 'F8', sentence: 'She writed an email last night.', wrongWord: 'writed', answer: 'wrote' },
            { id: 'F9', sentence: "He's the teacher who teaches me English last year.", wrongWord: 'teaches', answer: 'taught' },
            { id: 'F10', sentence: 'He gived me a bowl of noodles yesterday.', wrongWord: 'gived', answer: 'gave' },
            { id: 'F11', sentence: 'This is the tree house which they build last summer.', wrongWord: 'build', answer: 'built' },
            { id: 'F12', sentence: "We didn't saw the film yesterday.", wrongWord: 'saw', answer: 'see' },
            { id: 'F13', sentence: 'Did she took a photo?', wrongWord: 'took', answer: 'take' },
            { id: 'F14', sentence: "My dad didn't drove to work yesterday.", wrongWord: 'drove', answer: 'drive' },
            { id: 'F15', sentence: 'We were happy who the bus arrived.', wrongWord: 'who', answer: 'when' },
            { id: 'F16', sentence: 'When we finished lunch yesterday, we go to the funfair.', wrongWord: 'go', answer: 'went' },
            { id: 'F17', sentence: 'We have noodles for lunch yesterday.', wrongWord: 'have', answer: 'had' },
            { id: 'F18', sentence: 'Mum taked a photo yesterday.', wrongWord: 'taked', answer: 'took' },
            { id: 'F19', sentence: 'My grandma grows up in this village when she was a child.', wrongWord: 'grows', answer: 'grew' },
            { id: 'F20', sentence: 'Grandpa telled me a story last night.', wrongWord: 'telled', answer: 'told' }
        ]
    };
    const unit3Catalog = {
        missing: [
            { id: 'M1', sentences: ['Jenny is ___ than Jim.', 'Jenny is the ___ of the three children.'], answers: ['taller', 'tallest'] },
            { id: 'M2', sentences: ['Ivan is the ___ of all the acrobats.', 'Ivan is ___ than Jim.'], answers: ['strongest', 'stronger'] },
            { id: 'M3', sentences: ['My sister runs ___ than me.', 'She is the ___ runner in our whole school.'], answers: ['faster', 'fastest'] },
            { id: 'M4', sentences: ['This is the ___ of the three boxes.', 'This box is ___ than that one.'], answers: ['biggest', 'bigger'] },
            { id: 'M5', sentences: ['This mouse is ___ than that mouse.', 'This is the ___ of the three mice.'], answers: ['smaller', 'smallest'] },
            { id: 'M6', sentences: ['This is the ___ dangerous of all these sports.', 'This sport is ___ dangerous than tennis.'], answers: ['most', 'more'] },
            { id: 'M7', sentences: ['My drawing is ___ than yours.', 'This is the ___ of all my drawings.'], answers: ['better', 'best'] },
            { id: 'M8', sentences: ['This is the ___ of the three films.', 'This film is ___ than that one.'], answers: ['worst', 'worse'] },
            { id: 'M9', sentences: ['Jim is as tall ___ Jenny.', 'Ivan is taller ___ Jim.'], answers: ['as', 'than'] },
            { id: 'M10', sentences: ['Jenny is taller than Jim, so Jim is ___ as tall as Jenny.', "I'm ___ tall as my brother."], answers: ['not', 'as'] },
            { id: 'M11', sentences: ['I want ___ play football.', 'She ___ to play tennis.'], answers: ['to', 'wants'] },
            { id: 'M12', sentences: ['He ___ to see a doctor.', 'We need ___ do our homework.'], answers: ['needs', 'to'] },
            { id: 'M13', sentences: ['I ___ to go to the party.', 'My sister ___ to go too.'], answers: ['want', 'wants'] },
            { id: 'M14', sentences: ['Tom ___ to finish his homework.', 'They ___ to finish theirs.'], answers: ['needs', 'need'] },
            { id: 'M15', sentences: ['Your arm bends at your ___.', 'Your leg bends at your ___.'], answers: ['elbow', 'knee'] },
            { id: 'M16', sentences: ['We wear shoes on our ___.', 'We wear gloves on our ___.'], answers: ['feet', 'hands'] },
            { id: 'M17', sentences: ['Ivan is ___ strongest man in the circus.', 'Ivan is stronger ___ Jim.'], answers: ['the', 'than'] },
            { id: 'M18', sentences: ['Jenny is taller ___ Jim.', 'Jenny is ___ tallest of the three children.'], answers: ['than', 'the'] },
            { id: 'M19', sentences: ['Jim is ___ tall as Jenny.', 'Ivan is ___ strongest of all the acrobats.'], answers: ['as', 'the'] },
            { id: 'M20', sentences: ['My bag is heavier ___ yours.', "Your bag isn't as heavy ___ mine."], answers: ['than', 'as'] },
            { id: 'M21', sentences: ['This is ___ biggest of the three boxes.', 'This box is bigger ___ that one.', 'This box is ___ big as yours.'], answers: ['the', 'than', 'as'] },
            { id: 'M22', sentences: ['My brother is ___ tall ___ me.', 'My sister is taller ___ me.', 'She is ___ tallest of the three of us.'], answers: ['as', 'as', 'than', 'the'] }
        ],
        fix: [
            { id: 'F1', sentence: 'Jenny is tallest than Jim.', wrongWord: 'tallest', answer: 'taller' },
            { id: 'F2', sentence: 'Ivan is the stronger of all the acrobats.', wrongWord: 'stronger', answer: 'strongest' },
            { id: 'F3', sentence: 'This box is big than that one.', wrongWord: 'big', answer: 'bigger' },
            { id: 'F4', sentence: 'This is the smaller of all the boxes.', wrongWord: 'smaller', answer: 'smallest' },
            { id: 'F5', sentence: 'This animal is most dangerous than that one.', wrongWord: 'most', answer: 'more' },
            { id: 'F6', sentence: 'This is the more beautiful of all the flowers.', wrongWord: 'more', answer: 'most' },
            { id: 'F7', sentence: 'Jim is as tall than Jenny.', wrongWord: 'than', answer: 'as' },
            { id: 'F8', sentence: "I'm not than strong as Ivan.", wrongWord: 'than', answer: 'as' },
            { id: 'F9', sentence: 'My drawing is good than yours.', wrongWord: 'good', answer: 'better' },
            { id: 'F10', sentence: 'This is the worse of all my drawings.', wrongWord: 'worse', answer: 'worst' },
            { id: 'F11', sentence: 'I want to playing football.', wrongWord: 'playing', answer: 'play' },
            { id: 'F12', sentence: 'She needs to resting her ankle.', wrongWord: 'resting', answer: 'rest' },
            { id: 'F13', sentence: 'He want to go to the party.', wrongWord: 'want', answer: 'wants' },
            { id: 'F14', sentence: 'They needs to do their homework.', wrongWord: 'needs', answer: 'need' },
            { id: 'F15', sentence: 'I need for see a doctor.', wrongWord: 'for', answer: 'to' },
            { id: 'F16', sentence: "She doesn't wants to go to the party.", wrongWord: 'wants', answer: 'want' },
            { id: 'F17', sentence: 'I hurt both my knee.', wrongWord: 'knee', answer: 'knees' },
            { id: 'F18', sentence: 'My fingers hurts.', wrongWord: 'hurts', answer: 'hurt' },
            { id: 'F19', sentence: "I've got a sore throats.", wrongWord: 'throats', answer: 'throat' },
            { id: 'F20', sentence: "I've got a headache, but I wants to play football.", wrongWord: 'wants', answer: 'want' },
            { id: 'F21', sentence: 'Ivan is than strongest man in the circus.', wrongWord: 'than', answer: 'the' },
            { id: 'F22', sentence: 'Jenny is taller the Jim.', wrongWord: 'the', answer: 'than' },
            { id: 'F23', sentence: 'Jim is the tall as Jenny.', wrongWord: 'the', answer: 'as' },
            { id: 'F24', sentence: 'My bag is as heavy than yours.', wrongWord: 'than', answer: 'as' },
            { id: 'F25', sentence: 'This is as biggest of the three boxes.', wrongWord: 'as', answer: 'the' },
            { id: 'F26', sentence: 'This box is bigger as that one.', wrongWord: 'as', answer: 'than' },
            // F27 duplicated F8 and was explicitly excluded by the teacher.
            { id: 'F28', sentence: 'This is the most dangerous of all the sports. That sport is more dangerous the swimming.', wrongWord: 'the', wrongIndex: 14, answer: 'than' }
        ]
    };
    const unit4Catalog = {
        missing: [
            {"id": "M1", "sentences": ["She's a ___ singer.", "She sings ___."], "answers": ["beautiful", "beautifully"], "prefixes": ["b", "b"]},
            {"id": "M2", "sentences": ["He speaks more ___ than me.", "He's a ___ boy."], "answers": ["quietly", "quiet"], "prefixes": ["q", "q"]},
            {"id": "M3", "sentences": ["She's a ___ climber.", "She climbs more ___ than me."], "answers": ["careful", "carefully"], "prefixes": ["c", "c"]},
            {"id": "M4", "sentences": ["He's a ___ walker.", "He walks more ___ than me."], "answers": ["slow", "slowly"], "prefixes": ["s", "s"]},
            {"id": "M5", "sentences": ["She runs more ___ than me.", "She's a ___ runner."], "answers": ["quickly", "quick"], "prefixes": ["q", "q"]},
            {"id": "M6", "sentences": ["He's a ___ footballer.", "He plays football ___."], "answers": ["good", "well"], "prefixes": ["g", "w"]},
            {"id": "M7", "sentences": ["He's a very ___ runner.", "He runs ___ than me."], "answers": ["fast", "faster"], "prefixes": ["f", "f"]},
            {"id": "M8", "sentences": ["He works ___ than me.", "He's a very ___ worker."], "answers": ["harder", "hard"], "prefixes": ["h", "h"]},
            {"id": "M9", "sentences": ["She sings ___ beautifully than me.", "He runs more quickly ___ me."], "answers": ["more", "than"]},
            {"id": "M10", "sentences": ["Jim climbs ___ than Tom.", "Tom works more ___ than Jim."], "answers": ["better", "carefully"], "prefixes": ["b", "c"]},
            {"id": "M11", "sentences": ["We played very ___ today.", "They played ___ than us."], "answers": ["well", "worse"], "prefixes": ["w", "w"]},
            {"id": "M12", "sentences": ["I didn't ___ the ball yesterday.", "My brother ___ it."], "answers": ["catch", "caught"], "prefixes": ["c", "c"]},
            {"id": "M13", "sentences": ["I didn't ___ the ball.", "My sister ___ it."], "answers": ["throw", "threw"], "prefixes": ["t", "t"]},
            {"id": "M14", "sentences": ["Birds can ___ high in the sky.", "Yesterday, they ___ over our house."], "answers": ["fly", "flew"]},
            {"id": "M15", "sentences": ["I can ___ new songs quickly.", "Last year, I ___ to play the piano."], "answers": ["learn", "learnt"], "prefixes": ["l", "l"]},
            {"id": "M16", "sentences": ["My sister dances as beautifully ___ my mum.", "I dance more slowly ___ my brother."], "answers": ["as", "than"]}
        ],
        fix: [
            {"id": "F1", "sentence": "She sings beautiful.", "wrongWord": "beautiful", "answer": "beautifully"},
            {"id": "F2", "sentence": "He is a quietly boy.", "wrongWord": "quietly", "answer": "quiet"},
            {"id": "F3", "sentence": "She's a loudly singer.", "wrongWord": "loudly", "answer": "loud"},
            {"id": "F4", "sentence": "He is a slowly walker.", "wrongWord": "slowly", "answer": "slow"},
            {"id": "F5", "sentence": "He's a quickly runner.", "wrongWord": "quickly", "answer": "quick"},
            {"id": "F6", "sentence": "He is a carefully driver.", "wrongWord": "carefully", "answer": "careful"},
            {"id": "F7", "sentence": "She plays tennis good.", "wrongWord": "good", "answer": "well"},
            {"id": "F8", "sentence": "He runs fastly.", "wrongWord": "fastly", "answer": "fast"},
            {"id": "F9", "sentence": "He works hard than me.", "wrongWord": "hard", "answer": "harder"},
            {"id": "F10", "sentence": "He can run more fast than me.", "wrongWord": "fast", "answer": "quickly"},
            {"id": "F11", "sentence": "She climbs more careful than me.", "wrongWord": "careful", "answer": "carefully"},
            {"id": "F12", "sentence": "She sings more beautiful than me.", "wrongWord": "beautiful", "answer": "beautifully"},
            {"id": "F13", "sentence": "He plays football well than me.", "wrongWord": "well", "answer": "better"},
            {"id": "F14", "sentence": "She dances more beautifully then me.", "wrongWord": "then", "answer": "than"},
            {"id": "F15", "sentence": "He can run quickly than me.", "wrongWord": "quickly", "answer": "faster"},
            {"id": "F16", "sentence": "They play tennis badly than us.", "wrongWord": "badly", "answer": "worse"},
            {"id": "F17", "sentence": "We didn't caught any fish.", "wrongWord": "caught", "answer": "catch"},
            {"id": "F18", "sentence": "Did she threw the ball?", "wrongWord": "threw", "answer": "throw"},
            {"id": "F19", "sentence": "The birds flyed over the lake yesterday.", "wrongWord": "flyed", "answer": "flew"},
            {"id": "F20", "sentence": "We learn to dance last week.", "wrongWord": "learn", "answer": "learnt"}
        ]
    };
    const unit5Catalogs = {
        57: {
            missing: [
                {"id": "M1", "sentences": ["Her shirt has stripes. It's ___.", "His hat has spots. It's ___."], "answers": ["striped", "spotted"], "prefixes": ["s", "s"]},
                {"id": "M2", "sentences": ["Her spotted dress has yellow ___.", "His striped trousers have blue ___."], "answers": ["spots", "stripes"], "prefixes": ["s", "s"]},
                {"id": "M3", "sentences": ["This blue is very pale. It's ___ blue.", "This blue is almost black. It's ___ blue."], "answers": ["light", "dark"], "prefixes": ["l", "d"]}
            ],
            fix: [
                {"id": "F1", "sentence": "He's wearing a stripes shirt.", "wrongWord": "stripes", "answer": "striped"},
                {"id": "F2", "sentence": "Her dress has white spotted.", "wrongWord": "spotted", "answer": "spots"},
                {"id": "F3", "sentence": "She's wear a bright orange jacket.", "wrongWord": "wear", "answer": "wearing"},
                {"id": "F4", "sentence": "His trousers is dark blue.", "wrongWord": "is", "answer": "are"}
            ]
        },
        59: {
            missing: [
                {"id": "M4", "sentences": ["The helmet ___ made of gold.", "The wings ___ made of paper."], "answers": ["is", "are"]},
                {"id": "M5", "sentences": ["What ___ your watch made of?", "What ___ these bowls made of?"], "answers": ["is", "are"]},
                {"id": "M6", "sentences": ["The boots are ___ of rubber.", "The diary is made ___ paper."], "answers": ["made", "of"]},
                {"id": "M7", "sentences": ["This book has pages made of ___.", "These boots are made of ___."], "answers": ["paper", "rubber"], "prefixes": ["p", "r"]}
            ],
            fix: [
                {"id": "F5", "sentence": "The helmet are made of gold.", "wrongWord": "are", "answer": "is"},
                {"id": "F6", "sentence": "The wings is made of paper.", "wrongWord": "is", "answer": "are"},
                {"id": "F7", "sentence": "The boots are make of rubber.", "wrongWord": "make", "answer": "made"},
                {"id": "F8", "sentence": "The diary is made for paper.", "wrongWord": "for", "answer": "of"},
                {"id": "F9", "sentence": "What does your watch made of?", "wrongWord": "does", "answer": "is"},
                {"id": "F10", "sentence": "What is the bowls made of?", "wrongWord": "is", "answer": "are"}
            ]
        },
        66: {
            missing: [
                {"id": "M8", "sentences": ["This table is made of ___.", "This warm scarf is made of ___."], "answers": ["wood", "wool"], "prefixes": ["w", "w"]},
                {"id": "M9", "sentences": ["We can see through this window. It's made of ___.", "These scissors are made of ___."], "answers": ["glass", "metal"], "prefixes": ["g", "m"]},
                {"id": "M10", "sentences": ["We read books made of ___.", "Let's make a crown from brown ___."], "answers": ["paper", "card"], "prefixes": ["p", "c"]},
                {"id": "M11", "sentences": ["___ we make some props?", "___ paint the sky blue."], "answers": ["shall", "let's"], "prefixes": ["s", "l"]},
                {"id": "M12", "sentences": ["We ___ use yellow plastic for the sun.", "What ___ we use for the clouds?"], "answers": ["could", "shall"], "prefixes": ["c", "s"]},
                {"id": "M13", "sentences": ["Let's ___ a crown.", "We could ___ silver card."], "answers": ["make", "use"], "prefixes": ["m", "u"]},
                {"id": "M14", "sentences": ["Shall we ___ some costumes?", "Let's ___ them bright colours."], "answers": ["design", "paint"], "prefixes": ["d", "p"]},
                {"id": "M15", "sentences": ["This ruler bends easily. It is ___.", "This wooden table doesn't bend. It is ___."], "answers": ["flexible", "rigid"], "prefixes": ["f", "r"]},
                {"id": "M16", "sentences": ["This box is hard to lift. It's ___.", "This empty paper bag is easy to lift. It's ___."], "answers": ["heavy", "light"], "prefixes": ["h", "l"]}
            ],
            fix: [
                {"id": "F11", "sentence": "Shall we making some props?", "wrongWord": "making", "answer": "make"},
                {"id": "F12", "sentence": "Let's paints the sky blue.", "wrongWord": "paints", "answer": "paint"},
                {"id": "F13", "sentence": "We could using blue paper.", "wrongWord": "using", "answer": "use"},
                {"id": "F14", "sentence": "What shall we used for the clouds?", "wrongWord": "used", "answer": "use"},
                {"id": "F15", "sentence": "Shall we designs some costumes?", "wrongWord": "designs", "answer": "design"},
                {"id": "F16", "sentence": "We could went to the cinema.", "wrongWord": "went", "answer": "go"},
                {"id": "F17", "sentence": "Let's buying some silver card.", "wrongWord": "buying", "answer": "buy"},
                {"id": "F18", "sentence": "Gold is very heavily.", "wrongWord": "heavily", "answer": "heavy"},
                {"id": "F19", "sentence": "This ruler bends easily. It is rigid.", "wrongWord": "rigid", "answer": "flexible"},
                {"id": "F20", "sentence": "This stone doesn't feel smooth. It feels roughly.", "wrongWord": "roughly", "answer": "rough"}
            ]
        }
    };
    const unit6Catalogs = {
        69: {
            missing: [
                {"id": "M1", "sentences": ["We learn about countries and maps in ___.", "We learn about the past in ___."], "answers": ["geography", "history"], "prefixes": ["g", "h"]},
                {"id": "M2", "sentences": ["We work with numbers in ___.", "We sing and play instruments in ___."], "answers": ["maths", "music"], "prefixes": ["m", "m"]},
                {"id": "M3", "sentences": ["We draw and paint in ___.", "We do experiments in ___."], "answers": ["art", "science"], "prefixes": ["a", "s"]},
                {"id": "M4", "sentences": ["We've got geography ___ nine o'clock.", "We've got science ___ Monday."], "answers": ["at", "on"]},
                {"id": "M5", "sentences": ["We've got art ___ the morning.", "Lunch starts ___ half past twelve."], "answers": ["in", "at"]},
                {"id": "M6", "sentences": ["Maths is at nine, ___ our ten o'clock break.", "Art is at eleven, ___ our ten o'clock break."], "answers": ["before", "after"]}
            ],
            fix: [
                {"id": "F1", "sentence": "We've got science in nine o'clock.", "wrongWord": "in", "answer": "at"},
                {"id": "F2", "sentence": "We've got history at Monday.", "wrongWord": "at", "answer": "on"},
                {"id": "F3", "sentence": "We've got art on the morning.", "wrongWord": "on", "answer": "in"},
                {"id": "F4", "sentence": "Break starts at half to ten.", "wrongWord": "to", "answer": "past"},
                {"id": "F5", "sentence": "She's got two maths class today.", "wrongWord": "class", "answer": "classes"},
                {"id": "F6", "sentence": "What have they get at nine o'clock?", "wrongWord": "get", "answer": "got"}
            ]
        },
        71: {
            missing: [
                {"id": "M7", "sentences": ["You ___ listen carefully to your teacher.", "You ___ copy in exams."], "answers": ["should", "shouldn't"], "prefixes": ["s", "s"]},
                {"id": "M8", "sentences": ["Your friend needs help. You ___ help her.", "You've got an exam tomorrow. You ___ go to bed late."], "answers": ["should", "shouldn't"], "prefixes": ["s", "s"]},
                {"id": "M9", "sentences": ["You ___ talk when the teacher is speaking.", "You ___ put your hand up to ask a question."], "answers": ["shouldn't", "should"], "prefixes": ["s", "s"]},
                {"id": "M10", "sentences": ["You should ___ carefully to your teacher.", "You should ___ your homework before you play."], "answers": ["listen", "finish"], "prefixes": ["l", "f"]}
            ],
            fix: [
                {"id": "F7", "sentence": "You shouldn't listen carefully to your teacher.", "wrongWord": "shouldn't", "answer": "should"},
                {"id": "F8", "sentence": "You should copy other students' answers in exams.", "wrongWord": "should", "answer": "shouldn't"},
                {"id": "F9", "sentence": "You should goes to bed early before an exam.", "wrongWord": "goes", "answer": "go"},
                {"id": "F10", "sentence": "You shouldn't eating in class.", "wrongWord": "eating", "answer": "eat"},
                {"id": "F11", "sentence": "She should finishes her homework before she plays.", "wrongWord": "finishes", "answer": "finish"},
                {"id": "F12", "sentence": "Should we helps our friends?", "wrongWord": "helps", "answer": "help"}
            ]
        },
        73: {
            missing: [
                {"id": "M11", "sentences": ["You should ___ the guitar every day to get good.", "I'm good at ___ the guitar."], "answers": ["play", "playing"], "prefixes": ["p", "p"]},
                {"id": "M12", "sentences": ["She's good at ___ pictures.", "She can ___ very well."], "answers": ["drawing", "draw"], "prefixes": ["d", "d"]},
                {"id": "M13", "sentences": ["I can ___ across the pool.", "I'm good at ___."], "answers": ["swim", "swimming"], "prefixes": ["s", "s"]},
                {"id": "M14", "sentences": ["She's good ___ maths.", "We should listen ___ our teacher."], "answers": ["at", "to"]},
                {"id": "M15", "sentences": ["Katy is good at ___ poems.", "She should ___ one for the project."], "answers": ["writing", "write"], "prefixes": ["w", "w"]},
                {"id": "M16", "sentences": ["He's good at ___ photos.", "He can ___ a photo for our project."], "answers": ["taking", "take"], "prefixes": ["t", "t"]},
                {"id": "M17", "sentences": ["Use a ___ to find what a word means.", "We can find information on this ___."], "answers": ["dictionary", "website"], "prefixes": ["d", "w"]},
                {"id": "M18", "sentences": ["Use ___ to cut the paper.", "Use ___ to stick it together."], "answers": ["scissors", "glue"], "prefixes": ["s", "g"]},
                {"id": "M19", "sentences": ["This portable computer is a ___.", "The pictures appear on its ___."], "answers": ["laptop", "screen"], "prefixes": ["l", "s"]},
                {"id": "M20", "sentences": ["This ___ helps me learn English on my phone.", "I carry my books on my back in a ___."], "answers": ["app", "rucksack"], "prefixes": ["a", "r"]},
                {"id": "M21", "sentences": ["What's the ___ password? I want to go online.", "We can find information on the ___."], "answers": ["wifi", "internet"], "prefixes": ["w", "i"]},
                {"id": "M22", "sentences": ["A ___ has pages we can visit on the Internet.", "An online ___ tells us what words mean."], "answers": ["website", "dictionary"], "prefixes": ["w", "d"]},
                {"id": "M23", "sentences": ["We read an e-book on a ___.", "We turn the pages of a paper ___."], "answers": ["screen", "book"], "prefixes": ["s", "b"]},
                {"id": "M24", "sentences": ["Use scissors to ___ the paper.", "Use glue to ___ the pieces together."], "answers": ["cut", "stick"], "prefixes": ["c", "s"]},
                {"id": "M25", "sentences": ["On a computer, CTRL + C makes a ___ of the selected text.", "You can then use CTRL + V to ___ it where you want."], "answers": ["copy", "paste"], "prefixes": ["c", "p"]},
                {"id": "M26", "sentences": ["Put unwanted paper in the ___.", "Keep the paper you need in your ___."], "answers": ["bin", "rucksack"], "prefixes": ["b", "r"]}
            ],
            fix: [
                {"id": "F13", "sentence": "She's good in maths.", "wrongWord": "in", "answer": "at"},
                {"id": "F14", "sentence": "I'm good at draw pictures.", "wrongWord": "draw", "answer": "drawing"},
                {"id": "F15", "sentence": "He's good at swim.", "wrongWord": "swim", "answer": "swimming"},
                {"id": "F16", "sentence": "They're good at take photos.", "wrongWord": "take", "answer": "taking"},
                {"id": "F17", "sentence": "Katy is good at write poems.", "wrongWord": "write", "answer": "writing"},
                {"id": "F18", "sentence": "She is good at plays the guitar.", "wrongWord": "plays", "answer": "playing"},
                {"id": "F19", "sentence": "I can swimming, and I'm good at it.", "wrongWord": "swimming", "answer": "swim"},
                {"id": "F20", "sentence": "He should practising every day to get better at music.", "wrongWord": "practising", "answer": "practise"},
                {"id": "F21", "sentence": "You should use a online dictionary.", "wrongWord": "a", "answer": "an"},
                {"id": "F22", "sentence": "The bin is in the laptop screen.", "wrongWord": "in", "answer": "on"},
                {"id": "F23", "sentence": "I use my dictionary to go on the Internet and do my homework. It's a small computer.", "wrongWord": "dictionary", "answer": "laptop"},
                {"id": "F24", "sentence": "This app help me learn English.", "wrongWord": "help", "answer": "helps"},
                {"id": "F25", "sentence": "I've got three useful glues on my laptop.", "wrongWord": "glues", "answer": "apps"},
                {"id": "F26", "sentence": "We can find information in the Internet.", "wrongWord": "in", "answer": "on"},
                {"id": "F27", "sentence": "This laptop can connect to hifi.", "wrongWord": "hifi", "answer": "wifi"},
                {"id": "F28", "sentence": "The words appear in the screen.", "wrongWord": "in", "answer": "on"},
                {"id": "F29", "sentence": "This website have lots of information about animals.", "wrongWord": "have", "answer": "has"},
                {"id": "F30", "sentence": "I use an online bin to check new words.", "wrongWord": "bin", "answer": "dictionary"},
                {"id": "F31", "sentence": "My rucksack have two big pockets.", "wrongWord": "have", "answer": "has"},
                {"id": "F32", "sentence": "You can reads an e-book on your laptop.", "wrongWord": "reads", "answer": "read"},
                {"id": "F33", "sentence": "Use scissors to cutting the paper.", "wrongWord": "cutting", "answer": "cut"},
                {"id": "F34", "sentence": "You should past the copied text into your project.", "wrongWord": "past", "answer": "paste"}
            ]
        }
    };
    const pageCatalogs = { 'PU3:1:16': unit1Catalog, 'PU3:2:28': unit2Catalog, 'PU3:3:40': unit3Catalog, 'PU3:4:54': unit4Catalog, 'PU3:5:57': unit5Catalogs[57], 'PU3:5:59': unit5Catalogs[59], 'PU3:5:66': unit5Catalogs[66], 'PU3:6:69': unit6Catalogs[69], 'PU3:6:71': unit6Catalogs[71], 'PU3:6:73': unit6Catalogs[73], 'PU3:9:109': catalog };

    function normalize() {
        if (typeof TEACHING_CONTENT === 'undefined') return;
        for (const book of Object.keys(TEACHING_CONTENT)) {
            for (const unit of Object.keys(TEACHING_CONTENT[book])) {
                for (const page of Object.keys(TEACHING_CONTENT[book][unit])) {
                    const content = TEACHING_CONTENT[book][unit][page];
                    if (Array.isArray(content.nonSpellingExercises)) continue;
                    // Retain the legacy arrays for existing readers and SR identities.
                    content.nonSpellingExercises = [
                        ...(content.sentences || []).map(sentence => ({ type: 'sentence-scramble', sentence })),
                        ...((content.sentencePairs || []).length ? [{ type: 'sentence-match', pairs: content.sentencePairs }] : [])
                    ];
                    const authored = pageCatalogs[[book, unit, page].join(':')];
                    if (authored) {
                        content.nonSpellingExercises.push(
                            ...authored.missing.map(item => ({ ...item, type: 'missing-word' })),
                            ...authored.fix.map(item => ({ ...item, type: 'find-fix' }))
                        );
                    }
                }
            }
        }
    }

    function typedKey(item, page) {
        return ['non-spelling', item.type, page.book, page.unit, page.page, item.id].join(':').toLowerCase();
    }

    function buildPool(book, unit, page, options = {}) {
        normalize();
        const pages = getSortedPagesForBook(book);
        const activeIndex = pages.findIndex(p => p.book === book && String(p.unit) === String(unit) && String(p.page) === String(page));
        if (activeIndex < 0) return { entries: [], activeIndex };
        const state = options.srState || (typeof authActiveUser !== 'undefined' && authActiveUser && authActiveUser.srState) || {};
        const session = options.session === undefined ? getCurrentSession() : options.session;
        const seen = new Set();
        const seenPairs = new Set();
        const entries = [];
        const priority = (key, bucket) => getSRPriority(key, state[bucket] || {}, session, options.failures, options.successes);
        const add = (item, p, key, bucket, status, varietyEligible = true) => {
            const identity = item.type + ':' + key;
            if (seen.has(identity)) return;
            seen.add(identity);
            const weight = Math.pow(.2, Math.abs(p.absIndex - activeIndex));
            entries.push({ item: { ...item, book: p.book, unit: p.unit, page: p.page, key, srType: bucket }, key, pageAbsIndex: p.absIndex,
                priority: status || priority(key, bucket), score: Math.random() * weight, varietyEligible });
        };
        for (const p of pages.slice(0, activeIndex + 1).reverse()) {
            const content = TEACHING_CONTENT[p.book][p.unit][p.page];
            for (const item of content.nonSpellingExercises || []) {
                if (item.type === 'sentence-scramble') {
                    const sentence = Array.isArray(item.sentence) ? item.sentence[0] : item.sentence;
                    if (typeof sentence === 'string' && sentence.trim()) add(item, p, itemKey(item.sentence), 'sentences');
                } else if (item.type === 'missing-word' || item.type === 'find-fix') {
                    add(item, p, typedKey(item, p), 'sentences');
                } else if (item.type === 'sentence-match') {
                    const pairs = (item.pairs || []).filter(pair => {
                        const key = itemKey(pair);
                        if (!pair.a || !pair.b || seenPairs.has(key)) return false;
                        seenPairs.add(key);
                        return true;
                    }).map(pair => ({ pair, priority: priority(itemKey(pair), 'sentencePairs'), tie: Math.random() }));
                    const eligible = pairs.filter(p => p.priority.group !== 4).sort((a, b) => a.priority.group - b.priority.group || b.tie - a.tie);
                    const cooldown = pairs.filter(p => p.priority.group === 4).sort((a, b) => a.priority.dueAfterSession - b.priority.dueAfterSession);
                    const size = Math.min(3, pairs.length);
                    if (!size) continue;
                    const addBoard = selected => {
                        const boardPairs = selected.map(p => p.pair);
                        const cooling = selected.filter(p => p.priority.group === 4);
                        const pickable = selected.filter(p => p.priority.group !== 4);
                        const status = pickable.length
                            ? pickable.reduce((best, p) => p.priority.group < best.group ? p.priority : best, pickable[0].priority)
                            : { group: 4, dueAfterSession: Math.max(...cooling.map(p => p.priority.dueAfterSession)) };
                        add({ type: 'sentence-match', pairs: boardPairs }, p, boardPairs.map(itemKey).sort().join(' || '), 'sentencePairs', status, cooling.length === 0);
                    };
                    while (eligible.length >= size) addBoard(eligible.splice(0, size));
                    // Serve a due pair even if its board needs cooldown partners.
                    // Such a board may win on SR, but cannot be pulled just for variety.
                    const remaining = [...eligible, ...cooldown];
                    while (remaining.length >= size) addBoard(remaining.splice(0, size));
                }
            }
        }
        return { entries, activeIndex };
    }

    function select(book, unit, page, count = 5, options = {}) {
        const { entries } = buildPool(book, unit, page, options);
        const compare = (a, b) => a.priority.group - b.priority.group || b.score - a.score;
        let eligible = entries.filter(e => e.priority.group !== 4).sort(compare);
        const cooldown = entries.filter(e => e.priority.group === 4)
            .sort((a, b) => a.priority.dueAfterSession - b.priority.dueAfterSession || b.score - a.score);
        if (options.avoidKey && eligible.some(e => e.key !== options.avoidKey)) eligible = eligible.filter(e => e.key !== options.avoidKey);
        const picked = pickWithNewQuota(eligible, count);
        if (count > 1) {
            const varietyPool = eligible.filter(e => e.varietyEligible);
            const targetTypes = Math.min(3, new Set(varietyPool.map(e => e.item.type)).size, count);
            for (const candidate of varietyPool) {
                if (new Set(picked.map(e => e.item.type)).size >= targetTypes) break;
                if (picked.some(e => e.item.type === candidate.item.type)) continue;
                let replaceIndex = -1;
                for (let i = picked.length - 1; i >= 0; i--) {
                    if (picked.filter(p => p.item.type === picked[i].item.type).length > 1) { replaceIndex = i; break; }
                }
                if (replaceIndex >= 0) picked.splice(replaceIndex, 1, candidate);
            }
        }
        const used = new Set(picked.map(e => e.item.type + ':' + e.key));
        for (const entry of cooldown) {
            if (picked.length >= count) break;
            const identity = entry.item.type + ':' + entry.key;
            if (!used.has(identity)) { picked.push(entry); used.add(identity); }
        }
        return shuffleArray(picked).map(e => e.item);
    }
    window.NonSpellingContent = { catalog, normalize, buildPool, select, typedKey };
    normalize();
})();
