# Python script to update handleSave in ClassDialog
with open('frontend/src/pages/Classes.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """    if (form.registrationFeeRequired && form.registrationFeeAmount <= 0) {
      toast.error("Set the registration fee amount or turn off the registration fee requirement");
      return;
    }


    setSaving(true);"""

new = """    if (form.registrationFeeRequired && form.registrationFeeAmount <= 0) {
      toast.error("Set the registration fee amount or turn off the registration fee requirement");
      return;
    }

    // Build array fields from the dynamic inputs
    const amounts = installmentAmounts.slice(0, form.tuitionInstallments);
    while (amounts.length < form.tuitionInstallments) {
      amounts.push(0);
    }
    form.tuitionInstallmentAmounts = amounts;

    // Build requirement objects from the dynamic labels
    form.registrationRequirements = requirementLabels.map((label, i) => ({
      id: form.registrationRequirements && form.registrationRequirements.length > i
        ? form.registrationRequirements[i].id
        : "req_" + Date.now() + "_" + i,
      label: label.trim(),
    }));

    setSaving(true);"""

if old in content:
    content = content.replace(old, new, 1)
    with open('frontend/src/pages/Classes.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: Updated handleSave with new field assignments')
else:
    print('FAILED: could not find the exact text')
    # Show what we have around the validation area
    idx = content.find('registrationFeeRequired && form.registrationFeeAmount <= 0')
    if idx != -1:
        print('Found at index:', idx)
        print(repr(content[idx:idx+700]))
