import re

def check_html(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find tags
    tags = re.findall(r'<(/?[a-z1-6]+)', content.lower())
    
    stack = []
    errors = []
    
    # Void tags in HTML5
    void_tags = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'}
    
    for i, tag in enumerate(tags):
        if tag in void_tags:
            continue
            
        if tag.startswith('/'):
            tag_name = tag[1:]
            if not stack:
                errors.append(f"Unmatched closing tag: </{tag_name}> at index {i}")
            elif stack[-1] != tag_name:
                errors.append(f"Expected </{stack[-1]}> but found </{tag_name}> at index {i}")
                # Try to recover by popping until match
                if tag_name in stack:
                    while stack and stack[-1] != tag_name:
                        stack.pop()
                    if stack: stack.pop()
            else:
                stack.pop()
        else:
            stack.append(tag)
            
    for t in stack:
        errors.append(f"Unclosed tag: <{t}>")
        
    return errors

if __name__ == "__main__":
    errs = check_html('d:/coding/html games/Classroom-survivors/index.html')
    print(f"Total problems found: {len(errs)}")
    for e in errs:
        print(e)
