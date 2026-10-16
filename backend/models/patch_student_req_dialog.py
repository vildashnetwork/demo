"""Patch: Fees.tsx Add Student dialog (identity fields, handleSaveStudent,
guards), Students.tsx class requirements toggles, backend Students model."""
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


# ---------------------------------------------------------------- backend model
results.append(apply("backend/models/Students.js", [(
    """    registrationFeePaid: {
        type: Number,
        min: 0
    },
    feePayments: [{""",
    """    registrationFeePaid: {
        type: Number,
        min: 0
    },
    // Registration requirement checklist copied from the class, with this student's status
    registrationRequirements: [{
        _id: false,
        id: { type: String, required: true },
        label: { type: String, required: true },
        checked: { type: Boolean, default: false }
    }],
    feePayments: [{""",
)]))

# ------------------------------------------------------------- Students.tsx (1)
results.append(apply("frontend/src/pages/Students.tsx", [
    # 1) fetchClasses: normalise registrationRequirements on class objects
    (
        """      registrationFeeRequired: Boolean(cls.registrationFeeRequired),
      registrationFeeAmount: Number(cls.registrationFeeAmount) || 0,
    }));
    setClasses(mappedClasses);""",
        """      registrationFeeRequired: Boolean(cls.registrationFeeRequired),
      registrationFeeAmount: Number(cls.registrationFeeAmount) || 0,
      registrationRequirements: Array.isArray(cls.registrationRequirements)
        ? cls.registrationRequirements.map((r: any) => ({ id: r.id, label: r.label }))
        : [],
    }));
    setClasses(mappedClasses);""",
    ),
    # 2) handleClassChange: load the class's requirements into the form
    (
        """      registrationFeeRequired: Boolean(classObj?.registrationFeeRequired),
      registrationFeeAmount: classObj?.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
      feesDue: Math.max(0, totalFee - (Number(current.feesPaid) || 0)),
    }));""",
        """      registrationFeeRequired: Boolean(classObj?.registrationFeeRequired),
      registrationFeeAmount: classObj?.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
      feesDue: Math.max(0, totalFee - (Number(current.feesPaid) || 0)),
      // Load this class's registration requirements so each item can be toggled below.
      registrationRequirements:
        current.classId === classId && Array.isArray(current.registrationRequirements)
          ? current.registrationRequirements
          : (classObj?.registrationRequirements ?? []).map((r) => ({ id: r.id, label: r.label, checked: false })),
    }));""",
    ),
    # 3) create payload: persist the checklist
    (
        """        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
      };""",
        """        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
        registrationRequirements: Array.isArray(student.registrationRequirements)
          ? student.registrationRequirements.map((r) => ({ id: r.id, label: r.label, checked: Boolean(r.checked) }))
          : [],
      };""",
    ),
]))

# ------------------------------------------------------------- Students.tsx (2)
# UI: registration-requirement toggles inside the "Class & fees" fee-plan box
results.append(apply("frontend/src/pages/Students.tsx", [(
    """                  <p className="mt-2 text-xs text-black/55">Type what the student pays during registration — the balance updates live and is saved with the student.</p>
                </div>
              </div>
            ) : (""",
    """                  <p className="mt-2 text-xs text-black/55">Type what the student pays during registration — the balance updates live and is saved with the student.</p>
                </div>

                {(() => {
                  const saved = Array.isArray(form.registrationRequirements) ? form.registrationRequirements : [];
                  const list: NonNullable<Student["registrationRequirements"]> = saved.length
                    ? saved
                    : (selectedClass?.registrationRequirements ?? []).map((r) => ({ ...r, checked: false }));
                  if (!list.length) return null;
                  return (
                    <div className="mt-3 border-t border-blue-200/60 pt-3">
                      <p className="font-bold text-[#121212]">Registration requirements</p>
                      <p className="mt-1 text-xs text-black/55">Toggle each item once the student provides it — the status is saved with the student.</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {list.map((req) => {
                          const checked = Boolean(req.checked);
                          return (
                            <label key={req.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${checked ? "border-green-200 bg-green-50" : "border-white/70 bg-white/60"}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  set(
                                    "registrationRequirements",
                                    list.map((r) => (r.id === req.id ? { ...r, checked: !checked } : r))
                                  )
                                }
                                className="size-4 accent-green-600"
                              />
                              <span className={checked ? "font-semibold text-green-700" : "text-black/65"}>{req.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (""",
)]))

# ------------------------------------------------------------------ Fees.tsx (1)
results.append(apply("frontend/src/pages/Fees.tsx", [
    # 1) drop unused StudentDialog import
    (
        'import { StudentDialog, getClassTotalFee, type Student, type Class } from "@/pages/Students";',
        'import { getClassTotalFee, type Student, type Class } from "@/pages/Students";',
    ),
    # 2) remove unread selectedClassId state
    (
        """  const [showNewStudent, setShowNewStudent] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [newStudentForm, setNewStudentForm] = useState<Student>(makeBlankStudent());""",
        """  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState<Student>(makeBlankStudent());""",
    ),
    # 3) remove the in-component makeBlankStudent (moved to module scope so the
    #    state initialiser above no longer hits the temporal dead zone)
    (
        """  const makeBlankStudent = (): Student => ({
    id: "",
    fullName: "",
    gender: "",
    section: "englophone",
    dob: "",
    classId: "",
    department: "",
    parentName: "",
    parentPhone: "",
    address: "",
    registrationDate: new Date().toISOString().slice(0, 10),
    feesPaid: 0,
    feesDue: 0,
  });

""",
        "",
    ),
    # 4) module-scope makeBlankStudent (with registrationRequirements seeded)
    (
        "export function FeesPage() {",
        """// Blank student form used by the Fees "Add Student" dialog. Declared at module
// scope so state initialisers inside the component can call it safely.
function makeBlankStudent(): Student {
  return {
    id: "",
    fullName: "",
    gender: "",
    section: "englophone",
    dob: "",
    classId: "",
    department: "",
    parentName: "",
    parentPhone: "",
    address: "",
    registrationDate: new Date().toISOString().slice(0, 10),
    feesPaid: 0,
    feesDue: 0,
    registrationRequirements: [],
  };
}

export function FeesPage() {""",
    ),
    # 5) class-filter effect: drop setSelectedClassId(classFilter)
    (
        """      if (classObj) {
        setSelectedClassId(classFilter);
        // Pre-fill the form with the class's registration requirements""",
        """      if (classObj) {
        // Pre-fill the form with the class's registration requirements""",
    ),
    # 6) class-filter effect: drop the else-branch setter
    (
        """    } else {
      setSelectedClassId("");
      setNewStudentForm(makeBlankStudent());
    }""",
        """    } else {
      setNewStudentForm(makeBlankStudent());
    }""",
    ),
]))

# ------------------------------------------------------------------ Fees.tsx (2)
results.append(apply("frontend/src/pages/Fees.tsx", [
    # 7) fetchStudents: seed requirement toggles from each student's saved checklist
    (
        """      if (res.data.success) {
        setStudents(res.data.data.map((s: any) => ({ ...s, id: s._id || s.id })));
      }""",
        """      if (res.data.success) {
        const loaded: Student[] = res.data.data.map((s: any) => ({ ...s, id: s._id || s.id }));
        setStudents(loaded);
        // Seed each student's requirement toggles from the checklist saved on the server.
        const loadedIds = new Set(loaded.map((s) => s.id));
        setRequirementChecks((prev) => [
          ...loaded.flatMap((s) =>
            (Array.isArray(s.registrationRequirements) ? s.registrationRequirements : []).map((r) => ({
              studentId: s.id,
              requirementId: r.id,
              checked: Boolean(r.checked),
            }))
          ),
          ...prev.filter((rc) => !loadedIds.has(rc.studentId)),
        ]);
      }""",
    ),
    # 8) toggleRequirementCheck: persist the checklist via PATCH /students/:id
    (
        """  // Toggle a requirement check for a student
  const toggleRequirementCheck = (studentId: string, requirementId: string) => {
    setRequirementChecks((prev) => {
      const existing = prev.find((rc) => rc.studentId === studentId && rc.requirementId === requirementId);
      if (existing) {
        return prev.map((rc) =>
          rc.studentId === studentId && rc.requirementId === requirementId
            ? { ...rc, checked: !rc.checked }
            : rc
        );
      }
      return [...prev, { studentId, requirementId, checked: true }];
    });
  };""",
        """  // Toggle a requirement check for a student (optimistic, then persisted to the server).
  const toggleRequirementCheck = (studentId: string, requirementId: string) => {
    setRequirementChecks((prev) => {
      const existing = prev.find((rc) => rc.studentId === studentId && rc.requirementId === requirementId);
      if (existing) {
        return prev.map((rc) =>
          rc.studentId === studentId && rc.requirementId === requirementId
            ? { ...rc, checked: !rc.checked }
            : rc
        );
      }
      return [...prev, { studentId, requirementId, checked: true }];
    });

    // Persist the student's full checklist so the status survives reloads.
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const classObj = classMap.get(student.classId);
    const base: Array<{ id: string; label: string; checked?: boolean }> =
      Array.isArray(student.registrationRequirements) && student.registrationRequirements.length
        ? student.registrationRequirements
        : (classObj?.registrationRequirements ?? []).map((r) => ({ ...r, checked: false }));
    const next = base.map((r) => (r.id === requirementId ? { ...r, checked: !r.checked } : r));
    setStudents((prevList) =>
      prevList.map((s) => (s.id === studentId ? { ...s, registrationRequirements: next } : s))
    );
    void axios
      .patch(`${API_BASE}/students/${studentId}`, { registrationRequirements: next })
      .catch((error: any) => {
        toast.error(error.response?.data?.message || "Could not save requirement status");
      });
  };""",
    ),
    # 9) getRequirementsMet: guard optional registrationRequirements
    (
        "if (!classObj || !classObj.registrationRequirements.length) return 0;",
        "if (!classObj || !(classObj.registrationRequirements ?? []).length) return 0;",
    ),
    # 10) createStudentFromFees payload: persist the checklist
    (
        """        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
      };""",
        """        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
        registrationRequirements: Array.isArray(student.registrationRequirements)
          ? student.registrationRequirements.map((r) => ({ id: r.id, label: r.label, checked: Boolean(r.checked) }))
          : [],
      };""",
    ),
    # 11) after a successful save: keep class selection, reset details & checks
    (
        """        toast.success("Student added successfully");
        setShowNewStudent(false);
        const created = response.data.data;""",
        """        toast.success("Student added successfully");
        setShowNewStudent(false);
        // Keep the selected class for the next enrolment but clear details/checks.
        setNewStudentForm((prev) => ({
          ...makeBlankStudent(),
          classId: prev.classId,
          registrationRequirements: (prev.registrationRequirements ?? []).map((r) => ({ ...r, checked: false })),
        }));
        const created = response.data.data;""",
    ),
]))

# ------------------------------------------------------------------ Fees.tsx (3)
results.append(apply("frontend/src/pages/Fees.tsx", [
    # 12) dialog class onChange: drop setSelectedClassId
    (
        """                    registrationRequirements: classObj?.registrationRequirements || [],
                  }));
                  setSelectedClassId(classId);
                }}""",
        """                    registrationRequirements: classObj?.registrationRequirements || [],
                  }));
                }}""",
    ),
    # 13) identity fields between class select and requirements block
    (
        """              </select>
            </div>

            {/* Registration Requirements */}""",
        """              </select>
            </div>

            {/* Student Details */}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Full Name *</span>
                <input
                  type="text"
                  value={newStudentForm.fullName}
                  onChange={(e) => setNewStudentForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="Student full name"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Parent Name *</span>
                <input
                  type="text"
                  value={newStudentForm.parentName}
                  onChange={(e) => setNewStudentForm((prev) => ({ ...prev, parentName: e.target.value }))}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="Parent / guardian name"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Parent Phone *</span>
                <input
                  type="tel"
                  value={newStudentForm.parentPhone}
                  onChange={(e) => setNewStudentForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="6xx xxx xxx"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Address</span>
                <input
                  type="text"
                  value={newStudentForm.address}
                  onChange={(e) => setNewStudentForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="Residential address"
                />
              </label>
            </div>

            {/* Registration Requirements */}""",
    ),
    # 14) handleSaveStudent definition
    (
        """      console.error("Error creating student:", data ?? error);
      toast.error(detail);
    }
  };""",
        """      console.error("Error creating student:", data ?? error);
      toast.error(detail);
    }
  };

  // Saves the Add Student dialog, wrapping createStudentFromFees with the saving state.
  const handleSaveStudent = async () => {
    if (savingStudent) return;
    setSavingStudent(true);
    try {
      await createStudentFromFees(newStudentForm);
    } finally {
      setSavingStudent(false);
    }
  };""",
    ),
]))

# ------------------------------------------------------------------ Fees.tsx (4)
results.append(apply("frontend/src/pages/Fees.tsx", [
    # 15-20) guards for the optional registrationRequirements on Student
    (
        "newStudentForm.registrationRequirements.map((req) => (",
        "(newStudentForm.registrationRequirements ?? []).map((req) => (",
    ),
    (
        "registrationRequirements: prev.registrationRequirements.map((r) =>",
        "registrationRequirements: (prev.registrationRequirements ?? []).map((r) =>",
    ),
    (
        "newStudentForm.registrationRequirements.find(r => r.id === req.id)?.checked",
        "(newStudentForm.registrationRequirements ?? []).find(r => r.id === req.id)?.checked",
    ),
    (
        "newStudentForm.registrationRequirements.length === 0 &&",
        "(newStudentForm.registrationRequirements ?? []).length === 0 &&",
    ),
    (
        "const checkedReqs = newStudentForm.registrationRequirements.filter(r => r.checked).length;",
        "const checkedReqs = (newStudentForm.registrationRequirements ?? []).filter(r => r.checked).length;",
    ),
    (
        "Requirements confirmed: {checkedReqs}/{newStudentForm.registrationRequirements.length}",
        "Requirements confirmed: {checkedReqs}/{(newStudentForm.registrationRequirements ?? []).length}",
    ),
    # 21) save button: require identity fields too
    (
        "disabled={savingStudent || !newStudentForm.classId}",
        "disabled={savingStudent || !newStudentForm.classId || !newStudentForm.fullName.trim() || !newStudentForm.parentPhone.trim()}",
    ),
    # 22) empty-state colSpan: table now has 11 columns
    (
        '<td colSpan={10} className="py-12 text-center text-black/40">',
        '<td colSpan={11} className="py-12 text-center text-black/40">',
    ),
]))

# ---------------------------------------------------------------- verification
print("\n--- verification ---")
with open("frontend/src/pages/Fees.tsx", encoding="utf-8") as f:
    fees = f.read()
with open("frontend/src/pages/Students.tsx", encoding="utf-8") as f:
    stux = f.read()
checks = [
    ("Fees: selectedClassId refs (want 0)", fees.count("selectedClassId")),
    ("Fees: StudentDialog refs (want 0)", fees.count("StudentDialog")),
    ("Fees: handleSaveStudent refs (want 2+)", fees.count("handleSaveStudent")),
    ("Fees: makeBlankStudent defs (want 1)", fees.count("function makeBlankStudent")),
    ("Fees: getRequirementsMet refs", fees.count("getRequirementsMet(")),
    ("Fees: unguarded accesses (want 0)",
     fees.count("newStudentForm.registrationRequirements.") - fees.count("(newStudentForm.registrationRequirements ?? []).")),
    ("Students.tsx: Registration requirements UI", stux.count("Registration requirements")),
    ("Students.tsx: registrationRequirements refs", stux.count("registrationRequirements")),
]
for label, n in checks:
    print(f"  {label}: {n}")





if all(results):
    print("ALL PATCHES APPLIED")
else:
    print("SOME PATCHES FAILED - do not continue until fixed")
