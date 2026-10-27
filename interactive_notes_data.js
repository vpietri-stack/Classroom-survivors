(function (root) {
  'use strict';
  const pair = (id, left, right, note, page, crops) => ({ id, left, right, note, page, crops });
  const example = (word, meaning, sentence, translation, scene) => ({
    id: 'pu3-u9-p111-' + word, word, meaning, sentence, translation, scene,
    audio: 'interactive_notes_assets/audio/' + word + '.mp3'
  });
  const data = {
    id: 'pu3-u9-p111', book: 'PU3', title: 'Feelings: -ing or -ed?',
    pairs: [
      pair('boring',
        example('boring', '无聊的；令人厌烦的', 'The film is boring.', '这部电影很无聊。', '电视里的电影只有一只慢慢爬的蜗牛。'),
        example('bored', '感到无聊的', 'The boy is bored.', '男孩感到很无聊。', '男孩看着同一部电影，托着下巴，觉得无聊。'),
        '电影让人觉得无聊，用 boring；男孩自己感到无聊，用 bored。', '02-boring-and-interesting.png', [[31,354,475,281], [547,354,477,281]]),
      pair('interesting',
        example('interesting', '有趣的；引起兴趣的', 'The robot is interesting.', '这个机器人很有趣。', '一个小机器人正在用画笔画彩虹。'),
        example('interested', '感兴趣的', 'The girl is interested in the robot.', '女孩对这个机器人很感兴趣。', '女孩专心地看着机器人画彩虹。'),
        'be interested in ... = 对……感兴趣。机器人很有趣；女孩对它感兴趣。', '02-boring-and-interesting.png', [[31,909,475,276], [547,909,477,276]]),
      pair('frightening',
        example('frightening', '吓人的；令人害怕的', 'The thunder is frightening.', '雷声很吓人。', '窗外正在打雷下雨，女孩待在屋里。'),
        example('frightened', '感到害怕的', 'The girl is frightened.', '女孩感到害怕。', '屋里的女孩抱着玩具熊，感到害怕。'),
        '雷声让人害怕，用 frightening；女孩自己感到害怕，用 frightened。', '03-frightening-and-tiring.png', [[30,329,475,316], [547,329,477,316]]),
      pair('tiring',
        example('tiring', '累人的；令人疲倦的', 'The long walk is tiring.', '长时间走路很累人。', '男孩背着背包，正沿着很长的公园小路走。'),
        example('tired', '感到疲倦的', 'The boy is tired after the walk.', '走完后，男孩感到很累。', '走完路的男孩坐在长椅上休息，拿着一瓶水。'),
        'tiring 说活动让人累；tired 说自己感到累。', '03-frightening-and-tiring.png', [[30,925,475,355], [547,925,477,355]]),
      pair('exciting',
        example('exciting', '令人兴奋的', 'The race is exciting.', '这场比赛令人兴奋。', '两名小选手正在冲向终点，比赛很激烈。'),
        example('excited', '感到兴奋的', 'The children are excited.', '孩子们感到很兴奋。', '旁边的两个孩子举起手，兴奋地为选手加油。'),
        'exciting 说比赛令人兴奋；excited 说孩子们感到兴奋。', '04-exciting-and-surprising.png', [[37,401,477,305], [550,401,478,305]]),
      pair('surprising',
        example('surprising', '令人惊讶的；出人意料的', 'The purple carrot is surprising.', '这根紫色胡萝卜让人惊讶。', '男孩从菜地里拔出了一根真的紫色胡萝卜。'),
        example('surprised', '感到惊讶的', 'The boy is surprised.', '男孩感到很惊讶。', '男孩看着紫色胡萝卜，睁大眼睛，感到惊讶。'),
        'excited = 很期待、很兴奋；surprised = 没想到、很惊讶。', '04-exciting-and-surprising.png', [[37,975,477,301], [550,975,478,301]])
    ]
  };
  root.InteractiveNotesData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
