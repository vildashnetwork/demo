# Python script to add class selection and custom student dialog to Fees.tsx
with open('frontend/src/pages/Fees.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

modified = False

# 1. Update state declaration to add new state variables
old_state = '''  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);'''

new_state = '''  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [newStudentForm, setNewStudentForm] = useState<Student>(makeBlankStudent());
  const [savingStudent, setSavingStudent] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);'''

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print('SUCCESS: Updated state declaration')
    modified = True
else:
    print('FAILED: could not find state declaration')
    idx = content.find('const [payingStudent')
    if idx != -1:
        print(repr(content[idx:idx+200]))

# 2. Add useEffect for class filter to load class requirements
old_effect = '''  useEffect(() => {
    if (!classes.length) return;
    setVisibleCount(PAGE_SIZE);
    void fetchStudents(classFilter);
  }, [classFilter, classes.length]);'''

new_effect = '''  useEffect(() => {
    if (!classes.length) return;
    setVisibleCount(PAGE_SIZE);
    void fetchStudents(classFilter);
  }, [classFilter, classes.length]);

  // When class filter changes, load the class's registration requirements into the new student form
  useEffect(() => {
    if (classFilter !== "all" && classFilter) {
      const classObj = classMap.get(classFilter);
      if (classObj) {
        setSelectedClassId(classFilter);
        // Pre-fill the form with the class's registration requirements
        setNewStudentForm((prev) => ({
          ...prev,
          classId: classFilter,
          registrationRequirements: classObj.registrationRequirements || [],
        }));
      }
    } else {
      setSelectedClassId("");
      setNewStudentForm(makeBlankStudent());
    }
  }, [classFilter, classMap]);'''

if old_effect in content:
    content = content.replace(old_effect, new_effect, 1)
    print('SUCCESS: Added class filter useEffect')
    modified = True
else:
    print('FAILED: could not find class filter useEffect')
    idx = content.find('if (!classes.length) return;')
    if idx != -1:
        print(repr(content[idx:idx+200]))

if modified:
    with open('frontend/src/pages/Fees.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('ALL CHANGES WRITTEN')
else:
    print('NO CHANGES MADE')
