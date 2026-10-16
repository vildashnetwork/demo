# Python script to add debtorsOnly filter to Fees.tsx
with open('frontend/src/pages/Fees.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

modified = False

# 1. Add debtorsOnly state variable after feeFilter state
old_state = '''  const [feeFilter, setFeeFilter] = useState<string>("all");
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);'''

new_state = '''  const [feeFilter, setFeeFilter] = useState<string>("all");
  const [debtorsOnly, setDebtorsOnly] = useState(false);
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);'''

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print('SUCCESS: Added debtorsOnly state')
    modified = True
else:
    print('FAILED: could not find state')

# 2. Update filteredStudents to include debtorsOnly filter
old_filter = '''  const filteredStudents = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !`${s.fullName} ${s.parentName} ${s.parentPhone}`.toLowerCase().includes(q)) {
        return false;
      }
      if (feeFilter === "debtors" && s.feesDue === 0) return false;
      if (feeFilter === "fully-paid" && s.feesDue > 0) return false;
      if (feeFilter === "partial") {
        const total = getFeePlan(s, classMap.get(s.classId)).totalFee;
        if (s.feesDue === 0 || s.feesDue >= total) return false;
      }
      return true;
    });
  }, [students, deferredSearch, feeFilter, classMap]);'''

new_filter = '''  const filteredStudents = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !`${s.fullName} ${s.parentName} ${s.parentPhone}`.toLowerCase().includes(q)) {
        return false;
      }
      // Fee filter
      if (feeFilter === "debtors" && s.feesDue === 0) return false;
      if (feeFilter === "fully-paid" && s.feesDue > 0) return false;
      if (feeFilter === "partial") {
        const total = getFeePlan(s, classMap.get(s.classId)).totalFee;
        if (s.feesDue === 0 || s.feesDue >= total) return false;
      }
      // Debtors only checkbox
      if (debtorsOnly && s.feesDue === 0) return false;
      return true;
    });
  }, [students, deferredSearch, feeFilter, debtorsOnly, classMap]);'''

if old_filter in content:
    content = content.replace(old_filter, new_filter, 1)
    print('SUCCESS: Added debtorsOnly filter to filteredStudents')
    modified = True
else:
    print('FAILED: could not find filteredStudents')

if modified:
    with open('frontend/src/pages/Fees.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('ALL CHANGES WRITTEN')
else:
    print('NO CHANGES MADE')
