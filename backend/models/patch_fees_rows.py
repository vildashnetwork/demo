# Python script to update feeRows in Fees.tsx
with open('frontend/src/pages/Fees.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_fee_rows = """  // Derived per-student view-model shared by the desktop table and the mobile card list
  const feeRows = useMemo(() => {
    return filteredStudents.map((s) => {
      const classObj = classMap.get(s.classId);
      const plan = getFeePlan(s, classObj);
      const totalFee = plan.totalFee;
      let status = "Fully Paid";
      let statusColor = "bg-green-100 text-green-700";

      if (s.feesDue > 0 && s.feesDue < totalFee) {
        status = "Partial";
        statusColor = "bg-yellow-100 text-yellow-700";
      } else if (s.feesDue > 0 && s.feesDue >= totalFee) {
        status = "Owing";
        statusColor = "bg-red-100 text-red-700";
      }

      const hasPayment = s.feesPaid > 0 || (s.feePayments && s.feePayments.length > 0);

      return { student: s, classObj, plan, status, statusColor, hasPayment };
    });
  }, [filteredStudents, classMap]);"""

new_fee_rows = """  // Derived per-student view-model shared by the desktop table and the mobile card list
  const feeRows = useMemo(() => {
    return filteredStudents.map((s) => {
      const classObj = classMap.get(s.classId);
      const plan = getFeePlan(s, classObj);
      const totalFee = plan.totalFee;
      let status = "Fully Paid";
      let statusColor = "bg-green-100 text-green-700";

      if (s.feesDue > 0 && s.feesDue < totalFee) {
        status = "Partial";
        statusColor = "bg-yellow-100 text-yellow-700";
      } else if (s.feesDue > 0 && s.feesDue >= totalFee) {
        status = "Owing";
        statusColor = "bg-red-100 text-red-700";
      }

      const hasPayment = s.feesPaid > 0 || (s.feePayments && s.feePayments.length > 0);

      // Get requirement check states for this student
      const studentChecks = requirementChecks.filter((rc) => rc.studentId === s.id);
      const checkMap = new Map(studentChecks.map((rc) => [rc.requirementId, rc.checked]));

      return {
        student: s,
        classObj,
        plan,
        status,
        statusColor,
        hasPayment,
        requirements: classObj?.registrationRequirements || [],
        requirementChecks: studentChecks,
        checkMap,
      };
    });
  }, [filteredStudents, classMap, requirementChecks]);"""

if old_fee_rows in content:
    content = content.replace(old_fee_rows, new_fee_rows, 1)
    with open('frontend/src/pages/Fees.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: Updated feeRows')
else:
    print('FAILED: could not find feeRows')
