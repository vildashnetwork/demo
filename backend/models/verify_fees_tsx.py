# Verify fees.tsx changes
with open('frontend/src/pages/Fees.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    ('requirements header', 'Requirement Check' in content),
    ('requirementChecks in destructuring', 'requirementChecks, checkMap' in content),
    ('toggleRequirementCheck function', 'toggleRequirementCheck' in content),
    ('getRequirementsMet function', 'getRequirementsMet' in content),
    ('requirement toggle cells', 'checkMap.get(req.id)' in content),
    ('tuitionInstallmentAmounts mapped', 'tuitionInstallmentAmounts' in content),
    ('registrationRequirements mapped', 'registrationRequirements' in content),
]

for name, result in checks:
    status = 'OK' if result else 'MISSING'
    print(f'  {name}: {status}')
