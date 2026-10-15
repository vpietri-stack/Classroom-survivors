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
    const unit7Catalogs = {
        83: {
            missing: [
                {"id": "M1", "sentences": ["He prepares food in a restaurant kitchen. He's a ___.", "She brings meals to the customers' tables. She's a ___."], "answers": ["cook", "waiter"], "prefixes": ["c", "w"]},
                {"id": "M2", "sentences": ["He drives a bus. He's a ___.", "Her job is taking wedding photos. She's a ___."], "answers": ["driver", "photographer"], "prefixes": ["d", "p"]},
                {"id": "M3", "sentences": ["He paints pictures. He's an ___.", "She creates new clothes. She's a ___."], "answers": ["artist", "designer"], "prefixes": ["a", "d"]},
                {"id": "M4", "sentences": ["He writes news stories. He's a ___.", "She sings at concerts. She's a ___."], "answers": ["journalist", "singer"], "prefixes": ["j", "s"]},
                {"id": "M5", "sentences": ["He's an ___ in a film.", "She wants to be ___ artist."], "answers": ["actor", "an"], "prefixes": ["a", ""]}
            ],
            fix: [
                {"id": "F1", "sentence": "A waiter cooks the food in a restaurant kitchen.", "wrongWord": "waiter", "answer": "cook"},
                {"id": "F2", "sentence": "A cook brings meals to the customers' tables.", "wrongWord": "cook", "answer": "waiter"},
                {"id": "F3", "sentence": "A singer drives a bus.", "wrongWord": "singer", "answer": "driver"},
                {"id": "F4", "sentence": "His job is taking wedding photos. He's a driver.", "wrongWord": "driver", "answer": "photographer"},
                {"id": "F5", "sentence": "His job is designing clothes. He's a cook.", "wrongWord": "cook", "answer": "designer"},
                {"id": "F6", "sentence": "Her job is writing news stories. She's a waiter.", "wrongWord": "waiter", "answer": "journalist"},
                {"id": "F7", "sentence": "He's an artist who performs different characters in films.", "wrongWord": "artist", "answer": "actor"},
                {"id": "F8", "sentence": "She's a driver who sings on stage for her job.", "wrongWord": "driver", "answer": "singer"},
                {"id": "F9", "sentence": "Her job is painting pictures. She's an actor.", "wrongWord": "actor", "answer": "artist"},
                {"id": "F10", "sentence": "She wants to be a artist.", "wrongWord": "a", "answer": "an"}
            ]
        },
        85: {
            missing: [
                {"id": "M6", "sentences": ["When she ___ up, she wants to be a journalist.", "When they ___ up, they want to be artists."], "answers": ["grows", "grow"], "prefixes": ["g", "g"]},
                {"id": "M7", "sentences": ["If he ___ the competition, he gets a prize.", "If they ___ the competition, they get a prize."], "answers": ["wins", "win"], "prefixes": ["w", "w"]},
                {"id": "M8", "sentences": ["If I ___ eat breakfast, I'm hungry at ten.", "If she ___ eat breakfast, she's hungry at ten."], "answers": ["don't", "doesn't"]},
                {"id": "M9", "sentences": ["When the teacher ___ speaking, we listen.", "When the teachers ___ speaking, we listen."], "answers": ["is", "are"]},
                {"id": "M10", "sentences": ["If she ___ her homework early, she can play.", "If we ___ our homework early, we can play."], "answers": ["finishes", "finish"], "prefixes": ["f", "f"]},
                {"id": "M11", "sentences": ["If you want ___ be a cook, practise cooking.", "When she grows ___, she wants to be a journalist."], "answers": ["to", "up"]},
                {"id": "M23", "sentences": ["I might win the competition. ___ I win, I get a prize.", "I want to be a photographer ___ I grow up."], "answers": ["if", "when"]},
                {"id": "M24", "sentences": ["Our lesson finishes at four. ___ it finishes, we go home.", "I might need help. ___ I do, I ask my teacher."], "answers": ["when", "if"]},
                {"id": "M25", "sentences": ["Maybe we can buy tickets online. ___ we can, we don't need to queue.", "The show starts at seven tonight. ___ it starts, we stop talking."], "answers": ["if", "when"]},
                {"id": "M26", "sentences": ["My birthday is tomorrow. ___ I wake up, I can open my presents.", "I'm not sure I can finish today. ___ I finish, I can play outside."], "answers": ["when", "if"]}
            ],
            fix: [
                {"id": "F11", "sentence": "When she grow up, she wants to be a journalist.", "wrongWord": "grow", "answer": "grows"},
                {"id": "F12", "sentence": "If he win the competition, he gets a prize.", "wrongWord": "win", "answer": "wins"},
                {"id": "F13", "sentence": "If she don't eat breakfast, she feels hungry.", "wrongWord": "don't", "answer": "doesn't"},
                {"id": "F14", "sentence": "When the teacher are speaking, we listen.", "wrongWord": "are", "answer": "is"},
                {"id": "F15", "sentence": "If you wants to be a cook, practise cooking.", "wrongWord": "wants", "answer": "want"},
                {"id": "F16", "sentence": "When they finishes work, they go home.", "wrongWord": "finishes", "answer": "finish"},
                {"id": "F17", "sentence": "If I haven't got a pen, I asks a friend for one.", "wrongWord": "asks", "answer": "ask"},
                {"id": "F18", "sentence": "If the restaurant has a good cook, people eats there.", "wrongWord": "eats", "answer": "eat"},
                {"id": "F29", "sentence": "I might win the competition, but I might not. When I win, I get a prize.", "wrongWord": "when", "answer": "if"},
                {"id": "F30", "sentence": "Our lesson finishes at four. If it finishes, we go home.", "wrongWord": "if", "answer": "when"},
                {"id": "F31", "sentence": "I want to be a photographer if I grow up.", "wrongWord": "if", "answer": "when"},
                {"id": "F32", "sentence": "I'm not sure I can finish today. When I finish today, I can play outside.", "wrongWord": "when", "answer": "if"}
            ]
        },
        87: {
            missing: [
                {"id": "M12", "sentences": ["He helps his neighbours. He's ___.", "She laughs at people when they need help. She's ___."], "answers": ["kind", "unkind"], "prefixes": ["k", "u"]},
                {"id": "M13", "sentences": ["She smiles and says hello to everyone. She's ___.", "He won't speak to new people or say hello. He's ___."], "answers": ["friendly", "unfriendly"], "prefixes": ["f", "u"]},
                {"id": "M14", "sentences": ["She learns quickly and solves difficult problems. She's ___.", "He never wants to work. He's ___."], "answers": ["clever", "lazy"], "prefixes": ["c", "l"]},
                {"id": "M15", "sentences": ["She helps people even when it's dangerous. She's ___.", "Everyone wants to be his friend. He's ___."], "answers": ["brave", "popular"], "prefixes": ["b", "p"]},
                {"id": "M16", "sentences": ["His lessons are never boring. They're ___.", "His jokes make us laugh. He's ___."], "answers": ["interesting", "funny"], "prefixes": ["i", "f"]},
                {"id": "M17", "sentences": ["This puppy is beautiful and sweet. It's ___.", "This film makes me want to sleep. It's ___."], "answers": ["lovely", "boring"], "prefixes": ["l", "b"]},
                {"id": "M18", "sentences": ["What ___ your uncle like? He's kind.", "What ___ your uncle look like? He's tall."], "answers": ["is", "does"]},
                {"id": "M19", "sentences": ["What ___ your parents like? They're friendly.", "What ___ your parents look like? They've got dark hair."], "answers": ["are", "do"]},
                {"id": "M20", "sentences": ["What does she ___ like? She's tall and thin.", "What is she ___? She's brave."], "answers": ["look", "like"]},
                {"id": "M21", "sentences": ["He ___ like his dad. They've both got curly hair.", "They ___ like their mum. They've all got blue eyes."], "answers": ["looks", "look"], "prefixes": ["l", "l"]},
                {"id": "M22", "sentences": ["My sister ___ got long brown hair.", "My brothers ___ got short black hair."], "answers": ["has", "have"]}
            ],
            fix: [
                {"id": "F19", "sentence": "He always helps people. He's unkind.", "wrongWord": "unkind", "answer": "kind"},
                {"id": "F20", "sentence": "She smiles and says hello to everyone. She's unfriendly.", "wrongWord": "unfriendly", "answer": "friendly"},
                {"id": "F21", "sentence": "He never wants to work. He's brave.", "wrongWord": "brave", "answer": "lazy"},
                {"id": "F22", "sentence": "He helps people even when it's dangerous. He's lazy.", "wrongWord": "lazy", "answer": "brave"},
                {"id": "F23", "sentence": "Everyone wants to be her friend. She's unpopular.", "wrongWord": "unpopular", "answer": "popular"},
                {"id": "F24", "sentence": "What does your uncle like? He's kind and friendly.", "wrongWord": "does", "answer": "is"},
                {"id": "F25", "sentence": "What is your brother look like? He's tall.", "wrongWord": "is", "answer": "does"},
                {"id": "F26", "sentence": "What does your parents look like? They've got grey hair.", "wrongWord": "does", "answer": "do"},
                {"id": "F27", "sentence": "What is your parents like? They're kind.", "wrongWord": "is", "answer": "are"},
                {"id": "F28", "sentence": "He look like his dad. They've both got curly hair.", "wrongWord": "look", "answer": "looks"}
            ]
        }
    };
    const unit8Catalogs = {
        95: {
            missing: [
                {"id": "M1", "sentences": ["On a compass, N means ___.", "On a compass, S means ___."], "answers": ["north", "south"], "prefixes": ["n", "s"]},
                {"id": "M2", "sentences": ["The sun rises in the ___.", "The sun sets in the ___."], "answers": ["east", "west"], "prefixes": ["e", "w"]},
                {"id": "M3", "sentences": ["Don't turn left or right. Go ___ on.", "The opposite of left is ___."], "answers": ["straight", "right"], "prefixes": ["s", "r"]},
                {"id": "M4", "sentences": ["In China, people drive on the ___ side of the road.", "In the UK, people drive on the ___ side."], "answers": ["right", "left"], "prefixes": ["r", "l"]}
            ],
            fix: [
                {"id": "F1", "sentence": "On a compass, N means south.", "wrongWord": "south", "answer": "north"},
                {"id": "F2", "sentence": "The sun rises in the west.", "wrongWord": "west", "answer": "east"},
                {"id": "F3", "sentence": "The opposite of left is straight.", "wrongWord": "straight", "answer": "right"},
                {"id": "F4", "sentence": "In China, people drive on the left side of the road.", "wrongWord": "left", "answer": "right"}
            ]
        },
        97: {
            missing: [
                {"id": "M5", "sentences": ["I___ going to visit a museum tomorrow.", "She___ going to come with me."], "answers": ["'m", "'s"]},
                {"id": "M6", "sentences": ["We___ going to have a picnic.", "It___ going to be sunny."], "answers": ["'re", "'s"]},
                {"id": "M7", "sentences": ["We're ___ to visit a museum.", "She's going ___ take the bus."], "answers": ["going", "to"]},
                {"id": "M8", "sentences": ["___ she going to visit the museum?", "___ they going to come too?"], "answers": ["is", "are"]},
                {"id": "M9", "sentences": ["She's going to ___ a museum tomorrow.", "We're going to ___ a play at the theatre."], "answers": ["visit", "watch"], "prefixes": ["v", "w"]},
                {"id": "M11", "sentences": ["I'm staying at home. I'm ___ going to the park.", "She's staying at home too. She ___ going to the park."], "answers": ["not", "isn't"]},
                {"id": "M12", "sentences": ["I ___ the museum yesterday.", "I'm going to ___ it again tomorrow."], "answers": ["visited", "visit"], "prefixes": ["v", "v"]},
                {"id": "M13", "sentences": ["We ___ football yesterday.", "We're going to ___ again tomorrow."], "answers": ["played", "play"], "prefixes": ["p", "p"]}
            ],
            fix: [
                {"id": "F5", "sentence": "I is going to visit a museum tomorrow.", "wrongWord": "is", "answer": "am"},
                {"id": "F6", "sentence": "She are going to catch the bus.", "wrongWord": "are", "answer": "is"},
                {"id": "F7", "sentence": "They is going to play football.", "wrongWord": "is", "answer": "are"},
                {"id": "F8", "sentence": "We're go to have lunch in the park.", "wrongWord": "go", "answer": "going"},
                {"id": "F9", "sentence": "He's going for take his umbrella.", "wrongWord": "for", "answer": "to"},
                {"id": "F10", "sentence": "She's going to visiting a museum.", "wrongWord": "visiting", "answer": "visit"},
                {"id": "F11", "sentence": "What is they going to do tomorrow?", "wrongWord": "is", "answer": "are"},
                {"id": "F12", "sentence": "Are he going to take the bus?", "wrongWord": "are", "answer": "is"},
                {"id": "F13", "sentence": "They don't going to swim today.", "wrongWord": "don't", "answer": "aren't"},
                {"id": "F14", "sentence": "I'm going to took my umbrella.", "wrongWord": "took", "answer": "take"}
            ]
        },
        98: {
            missing: [
                {"id": "M14", "sentences": ["We catch a plane at the ___.", "We book a room at a ___."], "answers": ["airport", "hotel"], "prefixes": ["a", "h"]},
                {"id": "M15", "sentences": ["We go to the ___", "to get ___."], "answers": ["bank", "money"], "prefixes": ["b", "m"]},
                {"id": "M16", "sentences": ["We buy ___ at the ___ ___."], "answers": ["stamps", "post", "office"], "prefixes": ["s", "p", "o"]},
                {"id": "M17", "sentences": ["We buy medicine at the ___.", "We watch plays at the ___."], "answers": ["chemist's", "theatre"], "prefixes": ["c", "t"]},
                {"id": "M18", "sentences": ["We can see old objects at a ___.", "My brother studies engineering at ___."], "answers": ["museum", "university"], "prefixes": ["m", "u"]},
                {"id": "M19", "sentences": ["We pay for meals at a ___.", "Houses, schools and hotels are ___."], "answers": ["restaurant", "buildings"], "prefixes": ["r", "b"]}
            ],
            fix: [
                {"id": "F15", "sentence": "We catch our plane at the museum.", "wrongWord": "museum", "answer": "airport"},
                {"id": "F16", "sentence": "We get money from the theatre.", "wrongWord": "theatre", "answer": "bank"},
                {"id": "F17", "sentence": "We buy stamps at the post museum.", "wrongWord": "museum", "answer": "office"},
                {"id": "F18", "sentence": "We buy medicine at the bank.", "wrongWord": "bank", "answer": "chemist's"},
                {"id": "F19", "sentence": "We watch plays at the airport.", "wrongWord": "airport", "answer": "theatre"},
                {"id": "F20", "sentence": "We can see ancient objects in a restaurant.", "wrongWord": "restaurant", "answer": "museum"},
                {"id": "F21", "sentence": "My brother studies engineering at a hotel.", "wrongWord": "hotel", "answer": "university"},
                {"id": "F22", "sentence": "We booked a room at a bank for our holiday.", "wrongWord": "bank", "answer": "hotel"},
                {"id": "F23", "sentence": "We paid for our meal at the museum.", "wrongWord": "museum", "answer": "restaurant"},
                {"id": "F24", "sentence": "We put money on letters before we post them.", "wrongWord": "money", "answer": "stamps"}
            ]
        },
        99: {
            missing: [
                {"id": "M20", "sentences": ["He opened the door and went ___ the house.", "She left the car. She got ___ ___ it."], "answers": ["into", "out", "of"], "prefixes": ["i", "o", "o"]},
                {"id": "M21", "sentences": ["We drove ___ the tunnel.", "The bird flew ___ the roof."], "answers": ["through", "over"], "prefixes": ["t", "o"]},
                {"id": "M22", "sentences": ["Walk ___ the bridge to the other side.", "We didn't enter the bank. We walked ___ it."], "answers": ["across", "past"], "prefixes": ["a", "p"]},
                {"id": "M23", "sentences": ["Don't go through the flower bed. Walk ___ it.", "Go into the park ___ the gate."], "answers": ["round", "through"], "prefixes": ["r", "t"]},
                {"id": "M24", "sentences": ["She got out ___ the car.", "We're going ___ the hotel."], "answers": ["of", "to"]}
            ],
            fix: [
                {"id": "F25", "sentence": "Inside the tunnel, we drove over the mountain.", "wrongWord": "over", "answer": "through"},
                {"id": "F26", "sentence": "We didn't enter the bank. We walked into it and kept going.", "wrongWord": "into", "answer": "past"},
                {"id": "F27", "sentence": "She left the car. She got out to it.", "wrongWord": "to", "answer": "of"},
                {"id": "F28", "sentence": "We opened the door and walked onto the room.", "wrongWord": "onto", "answer": "into"},
                {"id": "F29", "sentence": "He used the bridge to walk through the river.", "wrongWord": "through", "answer": "across"},
                {"id": "F30", "sentence": "The bird flew through the house, high above its roof.", "wrongWord": "through", "answer": "over"},
                {"id": "F31", "sentence": "Keep outside the flower bed. Walk through it.", "wrongWord": "through", "answer": "round"},
                {"id": "F32", "sentence": "She got into of the car and walked away.", "wrongWord": "into", "answer": "out"}
            ]
        }
    };
    // Approved Unit 9 additions; page 109 retains its original catalog above.
    const unit9Catalogs = {
        "107": {
            missing: [
                {"id": "M1", "sentences": ["It's a ___ elephant.", "It's a ___ mouse."], "answers": ["huge", "little"], "prefixes": ["h", "l"]},
                {"id": "M2", "sentences": ["Everyone is shouting. The room is ___.", "Everyone is whispering. The room is ___."], "answers": ["noisy", "quiet"], "prefixes": ["n", "q"]},
                {"id": "M3", "sentences": ["There's poopoo in my soup. It tastes ___.", "This food tastes very good. It's ___."], "answers": ["horrible", "excellent"], "prefixes": ["h", "e"]},
                {"id": "M4", "sentences": ["I won the prize! I'm so ___.", "Nobody is with him. He's ___."], "answers": ["lucky", "alone"], "prefixes": ["l", "a"]},
                {"id": "M5", "sentences": ["Chinese New Year is a ___ day, when we eat ___ food."], "answers": ["special", "excellent"], "prefixes": ["s", "e"]},
                {"id": "M6", "sentences": ["\"Enormous\" means the same as ___.", "\"___\" means the same as fantastic."], "answers": ["huge", "brilliant"], "prefixes": ["h", "b"]},
                {"id": "M7", "sentences": ["The test isn't easy. It's ___.", "The teacher was happy with my work. She was ___."], "answers": ["difficult", "pleased"], "prefixes": ["d", "p"]},
                {"id": "M8", "sentences": ["There isn't any light. The room is ___.", "This animal looks very unusual. It's ___."], "answers": ["dark", "strange"], "prefixes": ["d", "s"]}
            ],
            fix: [
                {"id": "F1", "sentence": "This elephant is enormous. It's little.", "wrongWord": "little", "answer": "huge"},
                {"id": "F2", "sentence": "This mouse is very small. It's huge.", "wrongWord": "huge", "answer": "little"},
                {"id": "F3", "sentence": "Everyone is shouting. The room is quiet.", "wrongWord": "quiet", "answer": "noisy"},
                {"id": "F4", "sentence": "Nobody is with me. I'm together.", "wrongWord": "together", "answer": "alone"},
                {"id": "F5", "sentence": "This poopoo soup tastes amazing.", "wrongWord": "amazing", "answer": "horrible"},
                {"id": "F6", "sentence": "My birthday's a normal day for me!", "wrongWord": "normal", "answer": "special"},
                {"id": "F7", "sentence": "\"Enormous\" means small.", "wrongWord": "small", "answer": "huge"},
                {"id": "F8", "sentence": "\"Fantastic\" means terrible.", "wrongWord": "terrible", "answer": "brilliant"},
                {"id": "F9", "sentence": "The test was very hard. It was easy.", "wrongWord": "easy", "answer": "difficult"},
                {"id": "F10", "sentence": "The teacher was happy with my work. She was sad.", "wrongWord": "sad", "answer": "pleased"}
            ]
        },
        "110": {
            missing: [
                {"id": "M1", "sentences": ["I put on my ___ before going to bed.", "I wear ___ on my feet when I play tennis."], "answers": ["pyjamas", "trainers"], "prefixes": ["p", "t"]},
                {"id": "M2", "sentences": ["We sleep in a ___ when we go camping.", "We build ___ with sand on the beach."], "answers": ["tent", "sandcastles"], "prefixes": ["t", "s"]},
                {"id": "M3", "sentences": ["I put my clothes in a ___ before going on a trip.", "I carry my ___ on my back."], "answers": ["suitcase", "rucksack"], "prefixes": ["s", "r"]},
                {"id": "M4", "sentences": ["We sent a ___ to Grandma from our holiday.", "We put a ___ on it before posting it."], "answers": ["postcard", "stamp"], "prefixes": ["p", "s"]},
                {"id": "M5", "sentences": ["The ___ from the top of the hill was beautiful.", "The circus is travelling from city to city on a ___."], "answers": ["view", "tour"], "prefixes": ["v", "t"]},
                {"id": "M6", "sentences": ["I'm going to ___ my suitcase tonight.", "We're going on ___ tomorrow."], "answers": ["pack", "holiday"], "prefixes": ["p", "h"]},
                {"id": "M7", "sentences": ["I'll put on my ___.", "Let's make a sandcastle on the ___."], "answers": ["sunglasses", "beach"], "prefixes": ["s", "b"]},
                {"id": "M8", "sentences": ["Don't ___ to pack your trainers.", "Please ___ to put a stamp on the postcard."], "answers": ["forget", "remember"], "prefixes": ["f", "r"]}
            ],
            fix: [
                {"id": "F1", "sentence": "I wear my trainers in bed.", "wrongWord": "trainers", "answer": "pyjamas"},
                {"id": "F2", "sentence": "I put on my pyjamas before I play football.", "wrongWord": "pyjamas", "answer": "trainers"},
                {"id": "F3", "sentence": "We sleep in a stamp when we go camping.", "wrongWord": "stamp", "answer": "tent"},
                {"id": "F4", "sentence": "We use sand to make postcards on the beach.", "wrongWord": "postcards", "answer": "sandcastles"},
                {"id": "F5", "sentence": "My suitcase has shoulder straps. I carry it on my back.", "wrongWord": "suitcase", "answer": "rucksack"},
                {"id": "F6", "sentence": "I pack my holiday clothes in my postcard.", "wrongWord": "postcard", "answer": "suitcase"},
                {"id": "F7", "sentence": "Don't forget to put a tent on the postcard before you send it.", "wrongWord": "tent", "answer": "stamp"},
                {"id": "F8", "sentence": "This suitcase is a card with a holiday picture and a short message.", "wrongWord": "suitcase", "answer": "postcard"},
                {"id": "F9", "sentence": "We climbed the hill to enjoy the stamp of the sea.", "wrongWord": "stamp", "answer": "view"},
                {"id": "F10", "sentence": "The tour has finished. It's under.", "wrongWord": "under", "answer": "over"},
                {"id": "F11", "sentence": "Please forget to put a stamp on the postcard before you post it.", "wrongWord": "forget", "answer": "remember"},
                {"id": "F12", "sentence": "I need to make my suitcase before we leave for our holiday.", "wrongWord": "make", "answer": "pack"}
            ]
        },
        "111": {
            missing: [
                {"id": "M1", "sentences": ["The lesson was ___.", "I felt ___ during the lesson."], "answers": ["boring", "bored"], "prefixes": ["b", "b"]},
                {"id": "M2", "sentences": ["I'm ___ about our holiday.", "Our holiday plans sound ___."], "answers": ["excited", "exciting"], "prefixes": ["e", "e"]},
                {"id": "M3", "sentences": ["The huge dog looked ___.", "The little girl felt ___."], "answers": ["frightening", "frightened"], "prefixes": ["f", "f"]},
                {"id": "M4", "sentences": ["I'm ___ in dinosaurs.", "This dinosaur book is ___."], "answers": ["interested", "interesting"], "prefixes": ["i", "i"]},
                {"id": "M5", "sentences": ["The unexpected present was ___.", "I was ___ when I opened it."], "answers": ["surprising", "surprised"], "prefixes": ["s", "s"]},
                {"id": "M6", "sentences": ["We felt ___ after the walk.", "The long walk was ___."], "answers": ["tired", "tiring"], "prefixes": ["t", "t"]},
                {"id": "M7", "sentences": ["The news about the storm was ___.", "Dad felt ___ about our boat trip."], "answers": ["worrying", "worried"], "prefixes": ["w", "w"]},
                {"id": "M8", "sentences": ["I wasn't ___ of the dog because it was friendly.", "The huge shark in the film looked ___."], "answers": ["frightened", "frightening"], "prefixes": ["f", "f"]}
            ],
            fix: [
                {"id": "F1", "sentence": "The lesson was bored.", "wrongWord": "bored", "answer": "boring"},
                {"id": "F2", "sentence": "The lesson made me feel boring.", "wrongWord": "boring", "answer": "bored"},
                {"id": "F3", "sentence": "We're exciting about our holiday.", "wrongWord": "exciting", "answer": "excited"},
                {"id": "F4", "sentence": "The roller coaster was excited.", "wrongWord": "excited", "answer": "exciting"},
                {"id": "F5", "sentence": "The dog's loud barking was frightened.", "wrongWord": "frightened", "answer": "frightening"},
                {"id": "F6", "sentence": "She was frightening of the dog.", "wrongWord": "frightening", "answer": "frightened"},
                {"id": "F7", "sentence": "I'm interesting in dinosaurs.", "wrongWord": "interesting", "answer": "interested"},
                {"id": "F8", "sentence": "This book about dinosaurs is interested.", "wrongWord": "interested", "answer": "interesting"},
                {"id": "F9", "sentence": "I was surprising by the unexpected present.", "wrongWord": "surprising", "answer": "surprised"},
                {"id": "F10", "sentence": "The unexpected present was surprised.", "wrongWord": "surprised", "answer": "surprising"},
                {"id": "F11", "sentence": "The long walk made us feel tiring.", "wrongWord": "tiring", "answer": "tired"},
                {"id": "F12", "sentence": "The long walk was tired.", "wrongWord": "tired", "answer": "tiring"},
                {"id": "F13", "sentence": "The exam made me feel worrying.", "wrongWord": "worrying", "answer": "worried"},
                {"id": "F14", "sentence": "The news about the storm was worried.", "wrongWord": "worried", "answer": "worrying"}
            ]
        }
    };

    // PU2 Unit 1: teacher-approved boards, grouped by the existing app pages.
    const pu2Unit1Catalogs = {
        7: {
            missing: [
                {"id": "M1", "sentences": ["The cows are eating grass in the ___.", "There are lots of trees in the ___."], "answers": ["field", "forest"], "prefixes": ["f", "f"]},
                {"id": "M2", "sentences": ["Jane is fishing in the ___.", "There's a boat on the ___."], "answers": ["river", "lake"], "prefixes": ["r", "l"]},
                {"id": "M3", "sentences": ["Grandpa is driving his ___ on the farm.", "We're climbing a very high ___."], "answers": ["tractor", "mountain"], "prefixes": ["t", "m"]},
                {"id": "M4", "sentences": ["There's one red ___ on the tree.", "There are lots of brown ___ under it."], "answers": ["leaf", "leaves"], "prefixes": ["l", "l"]},
                {"id": "M5", "sentences": ["The cows are eating the green ___.", "The dog is digging a hole in the ___."], "answers": ["grass", "ground"], "prefixes": ["g", "g"]}
            ],
            fix: [
                {"id": "F1", "sentence": "Grandpa is driving his boat across the field.", "wrongWord": "boat", "answer": "tractor"},
                {"id": "F2", "sentence": "A forest is a place with lots of cars.", "wrongWord": "cars", "answer": "trees"},
                {"id": "F3", "sentence": "The cows are eating rocks in the field.", "wrongWord": "rocks", "answer": "grass"},
                {"id": "F4", "sentence": "A river is a very high place. You can climb it.", "wrongWord": "river", "answer": "mountain"},
                {"id": "F5", "sentence": "There are lots of leaf under the tree.", "wrongWord": "leaf", "answer": "leaves"}
            ]
        },
        9: {
            missing: [
                {"id": "M6", "sentences": ["A baby cat is a ___.", "A baby dog is a ___."], "answers": ["kitten", "puppy"], "prefixes": ["k", "p"]},
                {"id": "M7", "sentences": ["The kitten ___ sleeping now.", "The puppies ___ playing with a ball."], "answers": ["is", "are"]},
                {"id": "M8", "sentences": ["I ___ doing my homework now.", "We ___ cleaning our shoes."], "answers": ["am", "are"]},
                {"id": "M9", "sentences": ["___ she reading a book?", "___ the children playing outside?"], "answers": ["is", "are"]},
                {"id": "M10", "sentences": ["Mum is ___ a photo.", "Grandpa is ___ his tractor."], "answers": ["taking", "driving"], "prefixes": ["t", "d"]},
                {"id": "M11", "sentences": ["It's cold outside. I'm putting ___ my coat.", "I'm going to bed. I'm taking ___ my shoes."], "answers": ["on", "off"]}
            ],
            fix: [
                {"id": "F6", "sentence": "Mum are taking a photo now.", "wrongWord": "are", "answer": "is"},
                {"id": "F7", "sentence": "The children is playing outside.", "wrongWord": "is", "answer": "are"},
                {"id": "F8", "sentence": "I'm wash my hands now.", "wrongWord": "wash", "answer": "washing"},
                {"id": "F9", "sentence": "Grandpa is drive his tractor.", "wrongWord": "drive", "answer": "driving"},
                {"id": "F10", "sentence": "We're take off our boots.", "wrongWord": "take", "answer": "taking"},
                {"id": "F11", "sentence": "The puppy is play with a ball.", "wrongWord": "play", "answer": "playing"},
                {"id": "F12", "sentence": "Are she reading a book?", "wrongWord": "are", "answer": "is"}
            ]
        },
        10: {
            missing: [
                {"id": "M12", "sentences": ["I put ___ on my toothbrush.", "Then I clean my ___."], "answers": ["toothpaste", "teeth"], "prefixes": ["t", "t"]},
                {"id": "M13", "sentences": ["After my shower, I use a ___ to get dry.", "Then I get my school clothes and I get ___."], "answers": ["towel", "dressed"], "prefixes": ["t", "d"]},
                {"id": "M14", "sentences": ["My brother ___ up at seven every morning.", "He ___ breakfast at eight."], "answers": ["gets", "has"], "prefixes": ["g", "h"]},
                {"id": "M15", "sentences": ["My mum ___ up at seven every morning.", "My sister ___ her hands before lunch."], "answers": ["wakes", "washes"], "prefixes": ["w", "w"]},
                {"id": "M16", "sentences": ["What time ___ you get up?", "What time ___ your sister get up?"], "answers": ["do", "does"]},
                {"id": "M17", "sentences": ["___ your parents have breakfast at home?", "___ your brother have lunch at school?"], "answers": ["do", "does"]},
                {"id": "M18", "sentences": ["I get up ___ seven o'clock.", "I have a shower ___ the evening."], "answers": ["at", "in"]}
            ],
            fix: [
                {"id": "F13", "sentence": "My dad have a shower every evening.", "wrongWord": "have", "answer": "has"},
                {"id": "F14", "sentence": "I gets dressed every morning.", "wrongWord": "gets", "answer": "get"},
                {"id": "F15", "sentence": "My mum wake up at seven every day.", "wrongWord": "wake", "answer": "wakes"},
                {"id": "F16", "sentence": "My sister wash her hands before lunch every day.", "wrongWord": "wash", "answer": "washes"},
                {"id": "F17", "sentence": "What time do your brother get up?", "wrongWord": "do", "answer": "does"},
                {"id": "F18", "sentence": "Does your sister has breakfast at home?", "wrongWord": "has", "answer": "have"},
                {"id": "F19", "sentence": "I get up in seven o'clock.", "wrongWord": "in", "answer": "at"},
                {"id": "F20", "sentence": "I put a towel on my toothbrush to clean my teeth.", "wrongWord": "towel", "answer": "toothpaste"}
            ]
        },
        16: {
            missing: [
                {"id": "M19", "sentences": ["I ___ breakfast at eight every day.", "Now I'm ___ a shower."], "answers": ["have", "having"], "prefixes": ["h", "h"]},
                {"id": "M20", "sentences": ["She ___ her face every morning.", "Now she's ___ her hands."], "answers": ["washes", "washing"], "prefixes": ["w", "w"]},
                {"id": "M21", "sentences": ["They ___ in the field every day.", "Now they're ___ in the forest."], "answers": ["play", "playing"], "prefixes": ["p", "p"]},
                {"id": "M22", "sentences": ["What time ___ he get up every day?", "What ___ he doing now?"], "answers": ["does", "is"]}
            ],
            fix: [
                {"id": "F21", "sentence": "Every morning, he getting up at seven.", "wrongWord": "getting", "answer": "gets"},
                {"id": "F22", "sentence": "Mum has a shower every morning. Now she's have breakfast.", "wrongWord": "have", "answer": "having"},
                {"id": "F23", "sentence": "The children walk to school every day. Today they're ride their bikes.", "wrongWord": "ride", "answer": "riding"},
                {"id": "F24", "sentence": "Every evening, they cleaning their teeth before bed.", "wrongWord": "cleaning", "answer": "clean"}
            ]
        }
    };

    // PU2 Unit 2: approved wording and locked initials.
    const pu2Unit2Catalogs = {
        19: {
            missing: [
                {"id": "M1", "sentences": ["Sunday comes after ___.", "Sunday comes before ___."], "answers": ["saturday", "monday"]},
                {"id": "M2", "sentences": ["___ comes between Tuesday and Thursday.", "___ comes between Wednesday and Friday."], "answers": ["wednesday", "thursday"]},
                {"id": "M3", "sentences": ["Thursday comes before ___.", "Wednesday comes after ___."], "answers": ["friday", "tuesday"]},
                {"id": "M4", "sentences": ["Saturday comes before ___.", "Saturday and Sunday are the ___."], "answers": ["sunday", "weekend"]},
                {"id": "M5", "sentences": ["Monday comes ___ Tuesday.", "Tuesday comes ___ Monday."], "answers": ["before", "after"]},
                {"id": "M6", "sentences": ["Wednesday comes ___ Tuesday and Thursday.", "Friday comes ___ Saturday."], "answers": ["between", "before"]}
            ],
            fix: [
                {"id": "F1", "sentence": "Tuesday comes before Monday.", "wrongWord": "before", "answer": "after"},
                {"id": "F2", "sentence": "Wednesday comes after Thursday.", "wrongWord": "after", "answer": "before"},
                {"id": "F3", "sentence": "Friday comes between Tuesday and Thursday.", "wrongWord": "friday", "answer": "wednesday"},
                {"id": "F4", "sentence": "Saturday and Sunday are the weekday.", "wrongWord": "weekday", "answer": "weekend"},
                {"id": "F5", "sentence": "We go to school at Mondays.", "wrongWord": "at", "answer": "on"},
                {"id": "F6", "sentence": "The day before Sunday is Friday.", "wrongWord": "friday", "answer": "saturday"},
                {"id": "F7", "sentence": "There are seven days in a weekend.", "wrongWord": "weekend", "answer": "week"}
            ]
        },
        21: {
            missing: [
                {"id": "M7", "sentences": ["I clean my teeth every morning. I ___ clean them in the morning.", "I don't eat fish at all. I ___ eat fish."], "answers": ["always", "never"], "prefixes": ["a", "n"]},
                {"id": "M8", "sentences": ["I play tennis most weekends. I ___ play tennis.", "I play football on some weekends. I ___ play football."], "answers": ["often", "sometimes"], "prefixes": ["o", "s"]},
                {"id": "M9", "sentences": ["How ___ do you swim? Twice a week.", "Do you ___ go skating? Yes, sometimes."], "answers": ["often", "ever"]},
                {"id": "M10", "sentences": ["I swim on Mondays and Thursdays. That's ___ a week.", "I have one English lesson every week. That's ___ a week."], "answers": ["twice", "once"], "prefixes": ["t", "o"]},
                {"id": "M11", "sentences": ["She cleans her teeth every morning and every evening. That's twice a ___.", "He plays football only on Sundays. That's once a ___."], "answers": ["day", "week"], "prefixes": ["d", "w"]},
                {"id": "M12", "sentences": ["How often ___ you read comics?", "How often ___ your sister go swimming?"], "answers": ["do", "does"]}
            ],
            fix: [
                {"id": "F8", "sentence": "I never clean my teeth in the morning. I do it every morning!", "wrongWord": "never", "answer": "always"},
                {"id": "F9", "sentence": "I always eat fish. I don't eat it at all.", "wrongWord": "always", "answer": "never"},
                {"id": "F10", "sentence": "I swim on Mondays and Thursdays. That's once a week.", "wrongWord": "once", "answer": "twice"},
                {"id": "F11", "sentence": "I have one English lesson every week. That's twice a week.", "wrongWord": "twice", "answer": "once"},
                {"id": "F12", "sentence": "How many do you go swimming? Twice a week.", "wrongWord": "many", "answer": "often"},
                {"id": "F13", "sentence": "Does she often plays tennis?", "wrongWord": "plays", "answer": "play"},
                {"id": "F14", "sentence": "Do he ever go skating?", "wrongWord": "do", "answer": "does"}
            ]
        },
        22: {
            missing: [
                {"id": "M13", "sentences": ["I ___ to music in the car.", "I ___ films at the cinema."], "answers": ["listen", "watch"], "prefixes": ["l", "w"]},
                {"id": "M14", "sentences": ["I ___ a comic before bed.", "I ___ an email to Grandma every week."], "answers": ["read", "write"], "prefixes": ["r", "w"]},
                {"id": "M15", "sentences": ["We go ___ to buy food.", "I put on my skates and go ___ in the park."], "answers": ["shopping", "skating"], "prefixes": ["s", "s"]},
                {"id": "M16", "sentences": ["She often ___ to music.", "He sometimes ___ DVDs."], "answers": ["listens", "watches"], "prefixes": ["l", "w"]},
                {"id": "M17", "sentences": ["She doesn't ___ DVDs.", "He doesn't ___ to CDs."], "answers": ["watch", "listen"], "prefixes": ["w", "l"]},
                {"id": "M18", "sentences": ["I listen ___ a CD.", "I write ___ email to my cousin."], "answers": ["to", "an"]}
            ],
            fix: [
                {"id": "F15", "sentence": "I always listen at music in the car.", "wrongWord": "at", "answer": "to"},
                {"id": "F16", "sentence": "She often watch films on Friday evenings.", "wrongWord": "watch", "answer": "watches"},
                {"id": "F17", "sentence": "Every Saturday, Dad write an email to Grandma.", "wrongWord": "write", "answer": "writes"},
                {"id": "F18", "sentence": "I eat an email to Grandma every week.", "wrongWord": "eat", "answer": "write"},
                {"id": "F19", "sentence": "We go swimming at the supermarket to buy food.", "wrongWord": "swimming", "answer": "shopping"},
                {"id": "F20", "sentence": "She doesn't watches DVDs.", "wrongWord": "watches", "answer": "watch"}
            ]
        },
        25: {
            missing: [
                {"id": "M19", "sentences": ["We ___ listen to the teacher.", "We ___ kick our classmates."], "answers": ["must", "mustn't"], "prefixes": ["m", "m"]},
                {"id": "M20", "sentences": ["You ___ skate in the road.", "You ___ wear a helmet when you ride a bike."], "answers": ["mustn't", "must"], "prefixes": ["m", "m"]},
                {"id": "M21", "sentences": ["You must ___ a helmet when you ride a bike.", "You mustn't ___ in the road."], "answers": ["wear", "skate"], "prefixes": ["w", "s"]},
                {"id": "M22", "sentences": ["I wear a ___ to protect my head.", "I wear ___ to protect my hands."], "answers": ["helmet", "gloves"], "prefixes": ["h", "g"]},
                {"id": "M23", "sentences": ["I wear ___ to protect my eyes in the pool.", "I wear ___ ___ to protect my knees when I skate."], "answers": ["goggles", "knee", "pads"], "prefixes": ["g", "k", "p"]},
                {"id": "M24", "sentences": ["My helmet protects my ___.", "My gloves protect my ___."], "answers": ["head", "hands"], "prefixes": ["h", "h"]}
            ],
            fix: [
                {"id": "F21", "sentence": "We mustn't listen to the teacher.", "wrongWord": "mustn't", "answer": "must"},
                {"id": "F22", "sentence": "You must kick your classmates.", "wrongWord": "must", "answer": "mustn't"},
                {"id": "F23", "sentence": "He must wears a helmet when he rides his bike.", "wrongWord": "wears", "answer": "wear"},
                {"id": "F24", "sentence": "You mustn't skating in the road.", "wrongWord": "skating", "answer": "skate"},
                {"id": "F25", "sentence": "I wear goggles to protect my head when I ride my bike.", "wrongWord": "goggles", "answer": "helmet"},
                {"id": "F26", "sentence": "I wear gloves to protect my eyes when I swim.", "wrongWord": "gloves", "answer": "goggles"},
                {"id": "F27", "sentence": "I wear knee pads to protect my hands when I skate.", "wrongWord": "hands", "answer": "knees"},
                {"id": "F28", "sentence": "I wear goggles on my hands to keep them warm.", "wrongWord": "goggles", "answer": "gloves"}
            ]
        }
    };

    const pageCatalogs = { 'PU2:2:19': pu2Unit2Catalogs[19], 'PU2:2:21': pu2Unit2Catalogs[21], 'PU2:2:22': pu2Unit2Catalogs[22], 'PU2:2:25': pu2Unit2Catalogs[25], 'PU2:1:7': pu2Unit1Catalogs[7], 'PU2:1:9': pu2Unit1Catalogs[9], 'PU2:1:10': pu2Unit1Catalogs[10], 'PU2:1:16': pu2Unit1Catalogs[16], 'PU3:1:16': unit1Catalog, 'PU3:2:28': unit2Catalog, 'PU3:3:40': unit3Catalog, 'PU3:4:54': unit4Catalog, 'PU3:5:57': unit5Catalogs[57], 'PU3:5:59': unit5Catalogs[59], 'PU3:5:66': unit5Catalogs[66], 'PU3:6:69': unit6Catalogs[69], 'PU3:6:71': unit6Catalogs[71], 'PU3:6:73': unit6Catalogs[73], 'PU3:7:83': unit7Catalogs[83], 'PU3:7:85': unit7Catalogs[85], 'PU3:7:87': unit7Catalogs[87], 'PU3:8:95': unit8Catalogs[95], 'PU3:8:97': unit8Catalogs[97], 'PU3:8:98': unit8Catalogs[98], 'PU3:8:99': unit8Catalogs[99], 'PU3:9:107': unit9Catalogs[107], 'PU3:9:109': catalog, 'PU3:9:110': unit9Catalogs[110], 'PU3:9:111': unit9Catalogs[111] };

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
            // Availability can include not-yet-authored pages. Match the legacy
            // SR picker's guard; retain absIndex gaps for proximity weighting.
            const content = TEACHING_CONTENT[p.book] && TEACHING_CONTENT[p.book][p.unit] && TEACHING_CONTENT[p.book][p.unit][p.page];
            if (!content) continue;
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
