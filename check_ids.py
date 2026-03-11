import re
from collections import Counter

def check_ids(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    ids = re.findall(r'id="([^"]+)"', content)
    counts = Counter(ids)
    duplicates = {id: count for id, count in counts.items() if count > 1}
    
    return duplicates

if __name__ == "__main__":
    dups = check_ids('d:/coding/html games/Classroom-survivors/index.html')
    print(f"Total duplicate IDs: {len(dups)}")
    for id, count in dups.items():
        print(f"ID '{id}' appears {count} times")
