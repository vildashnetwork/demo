import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

src = open('backend/models/patch_student_req_dialog.py', encoding='utf-8').read()
i = 0
line = 1
state = None
esc = False
stack = []
matches = {')': '(', ']': '[', '}': '{'}
while i < len(src):
    ch = src[i]
    if ch == '\n':
        line += 1
        if state in ('"', "'"):
            print(f"line {line-1}: unterminated single-line string")
            state = None
        i += 1
        continue
    if state:
        if esc:
            esc = False
        elif ch == '\\':
            esc = True
        elif state in ('"""', "'''") and src.startswith(state, i):
            state = None
            i += 3
            continue
        elif state in ('"', "'") and ch == state:
            state = None
        i += 1
        continue
    if src.startswith('"""', i):
        state = '"""'
        i += 3
        continue
    if src.startswith("'''", i):
        state = "'''"
        i += 3
        continue
    if ch in ('"', "'"):
        state = ch
        i += 1
        continue
    if ch == '#':
        j = src.find('\n', i)
        i = j if j != -1 else len(src)
        continue
    if ch in '([{':
        stack.append((ch, line))
    elif ch in ')]}':
        if not stack:
            print(f"line {line}: unmatched closer {ch}")
        else:
            o = stack.pop()
            if matches[ch] != o[0]:
                print(f"line {line}: {ch} mismatches {o[0]} opened at line {o[1]}")
    i += 1
print("unclosed at EOF:", [(c, l) for c, l in stack])
print("string state at EOF:", state)
