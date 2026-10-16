# Python script to add class filter useEffect to Fees.tsx
with open('frontend/src/pages/Fees.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

modified = False

# Find the class filter useEffect and add the new useEffect after it
old_effect = '''  useEffect(() => {
    if (!classes.length) return;
    setVisibleCount(PAGE_SIZE);
    void fetchStudents(classFilter);
  }, [classFilter, classes.length]);

  // Reset pagination when the list changes shape.'''

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
  }, [classFilter, classMap]);

  // Reset pagination when the list changes shape.'''

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
