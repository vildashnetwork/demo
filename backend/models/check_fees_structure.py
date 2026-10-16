# Python script to check Fees.tsx structure
with open('frontend/src/pages/Fees.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find where StudentDialog is used for create student
idx = content.find('showNewStudent &&')
if idx != -1:
    print('StudentDialog usage in Fees:')
    print(content[idx:idx+600])

# Find where feeFilter is used
idx = content.find('feeFilter === "debtors"')
if idx != -1:
    print('\nfeeFilter usage:')
    print(content[idx-100:idx+300])

# Find classFilter usage
idx = content.find('classFilter')
if idx != -1:
    print('\nclassFilter usage (first occurrence):')
    print(content[idx-50:idx+200])
