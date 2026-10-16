"""Patch: Fees.tsx requirement-check persistence, adapted to the current
localStorage-based implementation:
  1) comment reflects server-side persistence,
  2) fetchStudents seeds the toggles from each student's saved checklist,
  3) toggleRequirementCheck PATCHes the full checklist to the server,
  4) createStudentFromFees sends the dialog checklist in the POST payload."""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

results = []


def apply(path, pairs):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for i, (old, new) in enumerate(pairs, 1):
        n = content.count(old)
        if n != 1:
            print(f"FAIL [{path}] pair {i}: found {n} occurrences")
            print("  probe:", repr(old[:100]))
            return False
        content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"OK [{path}]: {len(pairs)} replacements")
    return True


results.append(apply("frontend/src/pages/Fees.tsx", [
    # 1) comment: checks are now saved server-side
    (
        '''  // Requirement checkboxes per student, keyed "studentId:requirementId".
  // Persisted in this browser's localStorage so they survive a reload.
  // To share them between devices/users, store them on the backend instead.''',
        '''  // Requirement checkboxes per student, keyed "studentId:requirementId".
  // Saved on each student (registrationRequirements.checked) via the API and
  // cached in this browser's localStorage as a fallback.''',
    ),
    # 2) fetchStudents: seed the toggles from each student's saved checklist
    (
        '''      if (res.data.success) {
        setStudents(res.data.data.map((s: any) => ({ ...s, id: s._id || s.id })));
      }''',
        '''      if (res.data.success) {
        const loaded = res.data.data.map((s: any) => ({ ...s, id: s._id || s.id }));
        setStudents(loaded);
        // Seed the requirement toggles from the checklist saved on each student
        // so ticks survive a reload or a different browser (localStorage is only
        // the fallback for students saved before this field existed).
        setRequirementChecks((prev) => {
          const next = { ...prev };
          for (const s of loaded) {
            const list = Array.isArray(s.registrationRequirements) ? s.registrationRequirements : [];
            for (const r of list) next[checkKey(s.id, r.id)] = Boolean(r.checked);
          }
          return next;
        });
      }''',
    ),
    # 3) toggleRequirementCheck: persist the full checklist via PATCH
    (
        '''  const toggleRequirementCheck = (studentId: string, requirementId: string) => {
    const key = checkKey(studentId, requirementId);
    setRequirementChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };''',
        '''  const toggleRequirementCheck = (studentId: string, requirementId: string) => {
    const key = checkKey(studentId, requirementId);
    const nextChecked = !requirementChecks[key];
    setRequirementChecks((prev) => ({ ...prev, [key]: nextChecked }));

    // Persist the student's full checklist on the server so ticks are shared
    // across browsers/devices (localStorage remains a local cache).
    const student = students.find((s) => s.id === studentId);
    const classObj = student ? classMap.get(student.classId) : undefined;
    if (!student || !classObj) return;
    axios
      .patch(`${API_BASE}/students/${student.id}`, {
        registrationRequirements: (classObj.registrationRequirements || []).map((r) => ({
          id: r.id,
          label: r.label,
          checked: r.id === requirementId ? nextChecked : Boolean(requirementChecks[checkKey(studentId, r.id)]),
        })),
      })
      .catch((error: any) => {
        console.error("Error saving requirement check:", error);
        toast.error(error.response?.data?.message || "Could not save requirement check");
      });
  };''',
    ),
    # 4) create payload: send the dialog's checklist with the new student
    (
        '''        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
      };''',
        '''        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
        registrationRequirements: (classObj.registrationRequirements || []).map((r) => ({
          id: r.id,
          label: r.label,
          checked: Boolean(newStudentChecks[r.id]),
        })),
      };''',
    ),
]))

if all(results):
    print("ALL PATCHES APPLIED")
else:
    print("SOME PATCHES FAILED")
