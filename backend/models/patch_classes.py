# Python script to add state and helper functions to ClassDialog in Classes.tsx
with open('frontend/src/pages/Classes.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_section = """  const set = <K extends keyof SchoolClass>(k: K, v: SchoolClass[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const classNames = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Lower 6th", "Upper 6th", "Graduated"];"""

new_section = """  const set = <K extends keyof SchoolClass>(k: K, v: SchoolClass[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // State for installment amounts and registration requirements
  const [installmentAmounts, setInstallmentAmounts] = useState<number[]>(() => {
    if (initial.tuitionInstallmentAmounts && Array.isArray(initial.tuitionInstallmentAmounts)) {
      return initial.tuitionInstallmentAmounts.map(a => Number(a) || 0);
    }
    return new Array(initial.tuitionInstallments ?? 1).fill(0);
  });
  const [requirementLabels, setRequirementLabels] = useState<string[]>(() => {
    if (initial.registrationRequirements && Array.isArray(initial.registrationRequirements)) {
      return initial.registrationRequirements.map(r => r.label);
    }
    return [];
  });

  // Add a new installment field
  const addInstallment = () => {
    if (form.tuitionInstallments > installmentAmounts.length) {
      setInstallmentAmounts([...installmentAmounts, 0]);
    } else {
      toast.error(`Maximum ${form.tuitionInstallments} installments allowed`);
    }
  };

  // Remove an installment field
  const removeInstallment = (index: number) => {
    if (installmentAmounts.length > 1) {
      setInstallmentAmounts(installmentAmounts.filter((_, i) => i !== index));
    }
  };

  // Add a new registration requirement field
  const addRequirement = () => {
    setRequirementLabels([...requirementLabels, ""]);
  };

  // Remove a registration requirement field
  const removeRequirement = (index: number) => {
    if (requirementLabels.length > 0) {
      setRequirementLabels(requirementLabels.filter((_, i) => i !== index));
    }
  };

  const classNames = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Lower 6th", "Upper 6th", "Graduated"];"""

if old_section in content:
    content = content.replace(old_section, new_section, 1)
    with open('frontend/src/pages/Classes.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: Added state and helpers')
else:
    print('FAILED: could not find old_section')
