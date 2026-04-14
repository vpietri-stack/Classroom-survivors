import re

file_path = r'd:\coding\html games\Classroom-survivors\translations.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_sentences = [
    ('Grandma is cooking in the kitchen.', '奶奶正在厨房做饭。'),
    ('Grandma is in the kitchen.', '奶奶在厨房。'),
    ('Grandpa is eating in the dining room.', '爷爷正在餐厅吃饭。'),
    ('Grandpa is in the dining room.', '爷爷在餐厅。'),
    ('He\'s looking at his face in the mirror.', '他正在照镜子。'),
    ('Jim is in the living room.', '吉姆在客厅。'),
    ('Jim is playing the piano in the living room.', '吉姆正在客厅里弹钢琴。'),
    ('Mr Friendly is in the bathroom.', '弗伦德利先生在浴室。'),
    ('She\'s sleeping in the bedroom.', '她正在卧室里睡觉。'),
    ('The bath is in the bathroom.', '浴缸在浴室里。'),
    ('The bed is in the bedroom.', '床在卧室里。'),
    ('The piano is in the living room.', '钢琴在客厅里。'),
    ('The TV is in the living room.', '电视在客厅里。'),
    ('They are listening to the radio in the bedroom.', '他们正在卧室里听收音机。'),
    ('They are sitting on the bed.', '他们正坐在床上。'),
]

# Insert 'room' in the 'House & Rooms' block
for i, line in enumerate(lines):
    if '"roof":' in line:
        lines.insert(i + 1, '    "room": "房间",\n')
        break

# Now for sentences
for en, zh in new_sentences:
    inserted = False
    for i in range(1200, len(lines)):
        line = lines[i]
        match = re.match(r'^\s*\"([A-Za-z].*?)\"\s*:', line)
        if match:
            existing_en = match.group(1)
            # Basic string comparison (case-insensitive)
            if existing_en.lower() > en.lower():
                lines.insert(i, f'    "{en}": "{zh}",\n')
                inserted = True
                break
            
    if not inserted:
        for i in range(len(lines)-1, 0, -1):
            if '}' in lines[i]:
                lines.insert(i, f'    "{en}": "{zh}",\n')
                break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Success')
