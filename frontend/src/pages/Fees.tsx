import { useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
import { Wallet, AlertTriangle, Download, Printer, Filter, Search, FileText, Plus, X, Receipt, UserPlus } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { toast } from "sonner";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getClassTotalFee, type Student, type Class } from "@/pages/Students";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";
const PAGE_SIZE = 25;
const CHECKS_STORAGE_KEY = "manfess:requirement-checks";

type FeeType = "tuition" | "registration" | "enrollment";

interface ReceiptOptions {
  studentName: string;
  className?: string;
  matricule?: string;
  feeType: FeeType;
  installmentNumber?: number;
  amountPaid: number;
  newBalance: number;
  totalFee?: number;
  receiptNo?: string;
  paidAt?: Date | string;
}

function getFeePlan(student: Student, schoolClass?: Class) {
  const tuitionFee = Number(student.tuitionFee ?? schoolClass?.tuitionFee ?? 0);
  const tuitionFeePaid = Number(student.tuitionFeePaid ?? student.feesPaid ?? 0);
  const tuitionInstallments = Number(student.tuitionInstallments ?? schoolClass?.tuitionInstallments ?? 1);
  const tuitionInstallmentsPaid = Number(student.tuitionInstallmentsPaid ?? 0);
  const registrationFeeRequired = Boolean(student.registrationFeeRequired ?? schoolClass?.registrationFeeRequired);
  const registrationFeeAmount = registrationFeeRequired
    ? Number(student.registrationFeeAmount ?? schoolClass?.registrationFeeAmount ?? 0)
    : 0;
  const registrationFeePaid = Number(student.registrationFeePaid ?? 0);
  return {
    tuitionFee,
    tuitionFeePaid,
    tuitionInstallments,
    tuitionInstallmentsPaid,
    registrationFeeRequired,
    registrationFeeAmount,
    registrationFeePaid,
    registrationDue: Math.max(0, registrationFeeAmount - registrationFeePaid),
    tuitionDue: Math.max(0, tuitionFee - tuitionFeePaid),
    totalFee: tuitionFee + registrationFeeAmount,
  };
}

type FeePlan = ReturnType<typeof getFeePlan>;

// Suggested amount for the next payment of a given category.
function getSuggestedAmount(plan: FeePlan, type: "tuition" | "registration") {
  if (type === "registration") return plan.registrationDue;
  const installment = plan.tuitionInstallmentsPaid + 1;
  if (installment >= plan.tuitionInstallments) return plan.tuitionDue;
  return Math.min(plan.tuitionDue, Math.round((plan.tuitionFee / plan.tuitionInstallments) * 100) / 100);
}

// One status definition shared by the table, the exports and the debtors report.
function getStatus(feesDue: number, totalFee: number) {
  if (feesDue <= 0) return { label: "Fully Paid", color: "bg-green-100 text-green-700" };
  if (feesDue < totalFee) return { label: "Partial", color: "bg-yellow-100 text-yellow-700" };
  return { label: "Owing", color: "bg-red-100 text-red-700" };
}

const makeReceiptNo = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MAN-${ymd}-${rand}`;
};

const csvCell = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;

// Prevents names/phones containing < > & " ' from breaking (or injecting into) the print windows.
const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Defined at module level so it can be used in useState initialisers.
const makeBlankStudent = (): Student => ({
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
} as Student);

const checkKey = (studentId: string, requirementId: string) => `${studentId}:${requirementId}`;

// Renders only one layout (table OR cards) instead of mounting both and hiding one with CSS.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const handler = () => setIsDesktop(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function FeesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [feeFilter, setFeeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "due-desc" | "due-asc">("default");
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [paymentType, setPaymentType] = useState<"tuition" | "registration">("tuition");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState<Student>(makeBlankStudent());
  const [newStudentChecks, setNewStudentChecks] = useState<Record<string, boolean>>({});
  const [savingStudent, setSavingStudent] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Requirement checkboxes per student, keyed "studentId:requirementId".
  // Saved on each student (registrationRequirements.checked) via the API and
  // cached in this browser's localStorage as a fallback.
  const [requirementChecks, setRequirementChecks] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(CHECKS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHECKS_STORAGE_KEY, JSON.stringify(requirementChecks));
    } catch {
      /* storage unavailable: ignore */
    }
  }, [requirementChecks]);

  const isDesktop = useIsDesktop();
  const deferredSearch = useDeferredValue(searchTerm);
  const requestId = useRef(0);

  // O(1) class lookup instead of classes.find(...) inside every loop.
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // Loads students for a class. Stale responses (from an earlier, slower request) are ignored.
  const fetchStudents = async (classId: string) => {
    const id = ++requestId.current;
    setStudentsLoading(true);
    try {
      const endpoint = classId === "all"
        ? `${API_BASE}/students`
        : `${API_BASE}/students/class/${classId}`;

      const res = await axios.get(endpoint);
      if (id !== requestId.current) return;
      if (res.data.success) {
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
      }
    } catch (error: any) {
      if (id === requestId.current) {
        toast.error(error.response?.data?.message || "Failed to fetch students");
        console.error("Error fetching students:", error);
      }
    } finally {
      if (id === requestId.current) setStudentsLoading(false);
    }
  };

  // Classes are loaded once. Students load via the effect below when the class filter is set.
  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/classes`);
      if (res.data.success) {
        const mapped = res.data.data.map((cls: any) => ({
          ...cls,
          id: cls._id || cls.id,
          className: cls.className || cls.name,
          tuitionFee: Number(cls.tuitionFee) || 0,
          tuitionInstallments: Number(cls.tuitionInstallments) || 1,
          tuitionInstallmentAmounts: Array.isArray(cls.tuitionInstallmentAmounts) ? cls.tuitionInstallmentAmounts.map(Number) : [],
          registrationFeeRequired: Boolean(cls.registrationFeeRequired),
          registrationFeeAmount: Number(cls.registrationFeeAmount) || 0,
          registrationRequirements: Array.isArray(cls.registrationRequirements)
            ? cls.registrationRequirements.map((r: any) => ({ id: r.id, label: r.label }))
            : [],
        }));
        setClasses(mapped);
        if (mapped[0]) setClassFilter(mapped[0].id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch classes");
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClasses();
  }, []);

  useEffect(() => {
    if (!classes.length) return;
    setVisibleCount(PAGE_SIZE);
    void fetchStudents(classFilter);
  }, [classFilter, classes.length]);

  // Reset pagination when the list changes shape.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearch, feeFilter, sortBy]);

  const toggleRequirementCheck = (studentId: string, requirementId: string) => {
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
  };

  // Calculate statistics (single pass)
  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalDue = 0;
    let debtorsCount = 0;
    let fullyPaidCount = 0;
    let partialCount = 0;

    for (const s of students) {
      totalPaid += s.feesPaid;
      totalDue += s.feesDue;
      if (s.feesDue > 0) {
        debtorsCount++;
        const totalFee = getFeePlan(s, classMap.get(s.classId)).totalFee;
        if (s.feesDue < totalFee) partialCount++;
      } else {
        fullyPaidCount++;
      }
    }

    const totalStudents = students.length;
    const totalFees = totalPaid + totalDue;
    const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

    return {
      totalStudents,
      totalPaid,
      totalDue,
      totalFees,
      partialCount,
      collectionRate,
      debtorsCount,
      fullyPaidCount,
      averageDue: totalStudents > 0 ? totalDue / totalStudents : 0,
    };
  }, [students, classMap]);

  // Filter students (server already returns the selected class, so no class check here)
  const filteredStudents = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = students.filter((s) => {
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
    // Sort by amount owed (the filter above already returned a new array, so sorting in place is safe).
    if (sortBy === "due-desc") list.sort((a, b) => b.feesDue - a.feesDue);
    else if (sortBy === "due-asc") list.sort((a, b) => a.feesDue - b.feesDue);
    return list;
  }, [students, deferredSearch, feeFilter, sortBy, classMap]);

  // Derived per-student view-model shared by the desktop table and the mobile card list
  const feeRows = useMemo(() => {
    return filteredStudents.map((s) => {
      const classObj = classMap.get(s.classId);
      const plan = getFeePlan(s, classObj);
      const { label: status, color: statusColor } = getStatus(s.feesDue, plan.totalFee);
      const hasPayment = s.feesPaid > 0 || (s.feePayments && s.feePayments.length > 0);
      const requirements = classObj?.registrationRequirements || [];
      const requirementsMet = requirements.filter((r) => requirementChecks[checkKey(s.id, r.id)]).length;

      return {
        student: s,
        classObj,
        plan,
        status,
        statusColor,
        hasPayment,
        requirements,
        requirementsMet,
      };
    });
  }, [filteredStudents, classMap, requirementChecks]);

  // Only render one page of rows at a time
  const visibleRows = useMemo(() => feeRows.slice(0, visibleCount), [feeRows, visibleCount]);

  const startPayment = (student: Student) => {
    const plan = getFeePlan(student, classMap.get(student.classId));
    if (plan.registrationDue > 0) {
      setPaymentType("registration");
      setPaymentAmount(getSuggestedAmount(plan, "registration"));
    } else if (plan.tuitionDue > 0) {
      setPaymentType("tuition");
      setPaymentAmount(getSuggestedAmount(plan, "tuition"));
    } else {
      toast.success("This student has no remaining fees");
      return;
    }
    setPayingStudent(student);
  };

  const changePaymentType = (nextType: "tuition" | "registration") => {
    if (!payingStudent) return;
    const plan = getFeePlan(payingStudent, classMap.get(payingStudent.classId));
    setPaymentAmount(getSuggestedAmount(plan, nextType));
    setPaymentType(nextType);
  };

  // Build a branded PDF receipt from a payment.
  const generateReceiptPdf = (opts: ReceiptOptions) => {
    const doc = new jsPDF();
    const receiptNo = opts.receiptNo || makeReceiptNo();
    const paidAt = opts.paidAt ? new Date(opts.paidAt) : new Date();

    // Header band
    doc.setFillColor(10, 61, 46);
    doc.rect(0, 0, 210, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("MANFESS SCHOOL", 14, 18);
    doc.setFontSize(10);
    doc.text("Official Fee Payment Receipt", 14, 26);

    doc.setFontSize(9);
    doc.text(`Receipt No: ${receiptNo}`, 196, 16, { align: "right" });
    doc.text(`Date: ${paidAt.toLocaleString()}`, 196, 23, { align: "right" });

    // Received from
    let y = 48;
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.text("Received with thanks from:", 14, y);
    doc.setFontSize(14);
    doc.text(opts.studentName, 14, y + 9);

    y += 24;
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    if (opts.className) { doc.text(`Class: ${opts.className}`, 14, y); y += 6; }
    if (opts.matricule) { doc.text(`Matricule: ${opts.matricule}`, 14, y); y += 6; }

    // Payment description
    y += 6;
    doc.setTextColor(20, 20, 20);
    const description =
      opts.feeType === "registration"
        ? "Registration fee"
        : opts.feeType === "enrollment"
          ? "Enrollment / initial payment"
          : `Tuition installment ${opts.installmentNumber ?? ""}`.trim();
    doc.setFontSize(11);
    doc.text("Payment for:", 14, y);
    doc.setFontSize(12);
    doc.text(description, 60, y);

    // Amount box
    y += 12;
    doc.setDrawColor(225, 225, 225);
    doc.setFillColor(245, 247, 246);
    doc.roundedRect(14, y, 182, 26, 3, 3, "F");
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    doc.text("Amount Paid", 20, y + 16);
    doc.setFontSize(15);
    doc.text(`${opts.amountPaid.toLocaleString()} XAF`, 190, y + 17, { align: "right" });

    // Summary
    y += 40;
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    if (opts.totalFee !== undefined) {
      doc.text(`Total fees: ${opts.totalFee.toLocaleString()} XAF`, 14, y); y += 7;
    }
    doc.text(`Balance remaining: ${opts.newBalance.toLocaleString()} XAF`, 14, y);
    y += 8;
    const cleared = opts.newBalance <= 0;
    doc.setTextColor(cleared ? 20 : 180, cleared ? 120 : 60, 40);
    doc.setFontSize(11);
    doc.text(`Status: ${cleared ? "FULLY PAID" : "PARTIAL PAYMENT"}`, 14, y);

    // Footer
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(8);
    doc.text("This is a computer-generated receipt. Keep it for your records.", 14, 272);
    doc.text("MANFESS School", 196, 272, { align: "right" });

    doc.save(`receipt_${receiptNo}.pdf`);
    toast.success("Receipt downloaded");
  };

  // Open a branded HTML receipt in a new window and trigger the browser print popup.
  const printReceipt = (opts: ReceiptOptions) => {
    const receiptNo = opts.receiptNo || makeReceiptNo();
    const paidAt = opts.paidAt ? new Date(opts.paidAt) : new Date();
    const description =
      opts.feeType === "registration"
        ? "Registration fee"
        : opts.feeType === "enrollment"
          ? "Enrollment / upfront payment"
          : `Tuition${opts.installmentNumber ? ` · installment ${opts.installmentNumber}` : ""}`;
    const cleared = opts.newBalance <= 0;

    const printWindow = window.open("", "_blank", "width=520,height=760");
    if (!printWindow) {
      toast.error("Please allow popups to print the receipt");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${escapeHtml(receiptNo)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 24px; color: #141414; }
          .head { background: #0a3d2e; color: #fff; padding: 18px 20px; border-radius: 10px 10px 0 0; }
          .head h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
          .head p { margin: 4px 0 0; font-size: 12px; opacity: .9; }
          .meta { display: flex; justify-content: space-between; font-size: 12px; padding: 10px 20px; background: #f3f5f4; border-bottom: 1px solid #e3e6e5; }
          .body { border: 1px solid #e3e6e5; border-top: none; border-radius: 0 0 10px 10px; padding: 20px; }
          .muted { color: #6b6b6b; }
          .row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; border-bottom: 1px dashed #ececec; }
          .row span:last-child { font-weight: bold; }
          .amount { margin: 18px 0; background: #f3f5f4; border-radius: 10px; padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; }
          .amount .label { font-size: 12px; color: #6b6b6b; text-transform: uppercase; letter-spacing: 1px; }
          .amount .value { font-size: 22px; font-weight: bold; }
          .status { display: inline-block; margin-top: 10px; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: bold; letter-spacing: 1px; }
          .paid { background: #dcfce7; color: #15803d; }
          .partial { background: #fef3c7; color: #b45309; }
          .foot { margin-top: 22px; font-size: 11px; color: #8a8a8a; display: flex; justify-content: space-between; }
          .sign { margin-top: 34px; border-top: 1px solid #ddd; width: 180px; padding-top: 6px; font-size: 11px; color: #6b6b6b; }
        </style>
      </head>
      <body>
        <div class="head">
          <h1>MANFESS SCHOOL</h1>
          <p>Official Fee Payment Receipt</p>
        </div>
        <div class="meta">
          <span>Receipt No: <strong>${escapeHtml(receiptNo)}</strong></span>
          <span>Date: ${escapeHtml(paidAt.toLocaleString())}</span>
        </div>
        <div class="body">
          <div class="muted" style="font-size:12px">Received with thanks from</div>
          <div style="font-size:18px; font-weight:bold; margin:4px 0 12px">${escapeHtml(opts.studentName)}</div>
          ${opts.className ? `<div class="row"><span class="muted">Class</span><span>${escapeHtml(opts.className)}</span></div>` : ""}
          ${opts.matricule ? `<div class="row"><span class="muted">Matricule</span><span>${escapeHtml(opts.matricule)}</span></div>` : ""}
          <div class="row"><span class="muted">Payment for</span><span>${escapeHtml(description)}</span></div>
          ${opts.totalFee !== undefined ? `<div class="row"><span class="muted">Total fees</span><span>${opts.totalFee.toLocaleString()} XAF</span></div>` : ""}

          <div class="amount">
            <span class="label">Amount Paid</span>
            <span class="value">${opts.amountPaid.toLocaleString()} XAF</span>
          </div>

          <div class="row"><span class="muted">Balance remaining</span><span>${opts.newBalance.toLocaleString()} XAF</span></div>
          <div>
            <span class="status ${cleared ? "paid" : "partial"}">${cleared ? "FULLY PAID" : "PARTIAL PAYMENT"}</span>
          </div>

          <div class="sign">Authorised Signature</div>
          <div class="foot">
            <span>This is a computer-generated receipt. Keep it for your records.</span>
            <span>MANFESS School</span>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const recordFeePayment = async (withPrint = false) => {
    if (!payingStudent || paymentAmount <= 0) return;
    const plan = getFeePlan(payingStudent, classMap.get(payingStudent.classId));
    const installmentNumber = paymentType === "tuition" ? plan.tuitionInstallmentsPaid + 1 : undefined;
    const maxAmount = paymentType === "registration" ? plan.registrationDue : plan.tuitionDue;
    if (paymentAmount > maxAmount) {
      toast.error(`Amount exceeds the outstanding ${paymentType === "registration" ? "registration" : "tuition"} fee (${maxAmount.toLocaleString()} XAF)`);
      return;
    }
    setSavingPayment(true);
    try {
      const response = await axios.post(`${API_BASE}/students/${payingStudent.id}/pay-fees`, {
        amount: paymentAmount,
        feeType: paymentType,
        installmentNumber,
        recordedBy: "admin",
      });
      toast.success(paymentType === "registration" ? "Registration fee payment recorded" : `Tuition installment ${installmentNumber} recorded`);
      const className = classMap.get(payingStudent.classId)?.className;
      const receiptData = response.data?.data;
      const studentName = payingStudent.fullName;
      const matricule = (payingStudent as any).matricule;
      setPayingStudent(null);

      // Print right away; refresh the list in the background (no full-page loader).
      if (withPrint && receiptData) {
        printReceipt({
          studentName,
          className,
          matricule,
          feeType: receiptData.feeType,
          installmentNumber: receiptData.installmentNumber,
          amountPaid: receiptData.paymentAmount,
          newBalance: receiptData.newBalance,
          totalFee: plan.totalFee,
        });
      }
      void fetchStudents(classFilter);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  // Re-print a receipt for a student's most recent recorded payment.
  const reprintReceipt = (student: Student) => {
    const schoolClass = classMap.get(student.classId);
    const plan = getFeePlan(student, schoolClass);
    const last = student.feePayments && student.feePayments.length
      ? student.feePayments[student.feePayments.length - 1]
      : null;
    if (!last && !(student.feesPaid > 0)) {
      toast.error("No payment recorded for this student yet");
      return;
    }
    generateReceiptPdf({
      studentName: student.fullName,
      className: schoolClass?.className,
      matricule: (student as any).matricule,
      feeType: last?.feeType ?? "enrollment",
      installmentNumber: last?.installmentNumber,
      amountPaid: last?.amount ?? student.feesPaid,
      newBalance: student.feesDue,
      totalFee: plan.totalFee,
      paidAt: last?.paidAt ?? student.registrationDate,
    });
  };

  const openNewStudent = () => {
    const defaultClass = classFilter !== "all" ? classMap.get(classFilter) : undefined;
    setNewStudentForm({
      ...makeBlankStudent(),
      classId: defaultClass?.id ?? "",
      department: defaultClass?.department ?? "",
    });
    setNewStudentChecks({});
    setShowNewStudent(true);
  };

  const updateNewStudent = (patch: Partial<Student>) =>
    setNewStudentForm((prev) => ({ ...prev, ...patch }));

  // Enroll a new student from the Fees page (same fields/payload as Students page)
  // and, when any fee is paid up-front, issue a receipt immediately.
  const createStudentFromFees = async (student: Student) => {
    if (!student.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!student.parentPhone.trim()) {
      toast.error("Parent phone is required");
      return;
    }
    if (!student.classId) {
      toast.error("Class is required");
      return;
    }

    const classObj = classMap.get(student.classId);
    if (!classObj || (classObj.className !== "Graduated" && classObj.tuitionFee <= 0)) {
      toast.error("Configure this class's tuition in Classes & Subjects before enrolling students");
      return;
    }
    const totalFee = getClassTotalFee(classObj);

    const tuitionPaid = Number(student.tuitionFeePaid) || 0;
    const registrationPaid = Number(student.registrationFeePaid) || 0;
    const upfrontPayment = Math.max(0, Number(student.upfrontPayment) || 0);
    const feesPaid = tuitionPaid + registrationPaid + upfrontPayment;
    if (feesPaid > totalFee) {
      toast.error(`Payment exceeds the total fee (${totalFee.toLocaleString()} XAF)`);
      return;
    }
    const feesDue = Math.max(0, totalFee - feesPaid);

    setSavingStudent(true);
    try {
      const studentData = {
        fullName: student.fullName.trim(),
        gender: student.gender,
        section: classObj.schoolSection || student.section || "englophone",
        dob: student.dob,
        classId: student.classId,
        department: student.department || classObj.department,
        parentName: (student.parentName || "").trim(),
        parentPhone: student.parentPhone.trim(),
        address: (student.address || "").trim(),
        photoUrl: student.photoUrl || "",
        registrationDate: student.registrationDate || new Date().toISOString().slice(0, 10),
        feesPaid,
        feesDue,
        tuitionFee: classObj.tuitionFee,
        tuitionInstallments: classObj.tuitionInstallments,
        tuitionFeePaid: tuitionPaid + upfrontPayment,
        tuitionInstallmentsPaid: Number(student.tuitionInstallmentsPaid) || 0,
        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
        registrationRequirements: (classObj.registrationRequirements || []).map((r) => ({
          id: r.id,
          label: r.label,
          checked: Boolean(newStudentChecks[r.id]),
        })),
      };

      const response = await axios.post(`${API_BASE}/students`, studentData);
      if (response.data.success) {
        toast.success("Student added successfully");
        const created = response.data.data;
        const createdId = created?._id || created?.id;

        // Save the requirement boxes ticked in the form against the new student.
        if (createdId) {
          setRequirementChecks((prev) => {
            const next = { ...prev };
            for (const req of classObj.registrationRequirements) {
              if (newStudentChecks[req.id]) next[checkKey(createdId, req.id)] = true;
            }
            return next;
          });
        }

        setShowNewStudent(false);
        if (feesPaid > 0) {
          generateReceiptPdf({
            studentName: studentData.fullName,
            className: classObj.className,
            matricule: created?.matricule,
            feeType: "enrollment",
            amountPaid: feesPaid,
            newBalance: feesDue,
            totalFee,
          });
        }
        void fetchStudents(classFilter);
      }
    } catch (error: any) {
      const data = error?.response?.data;
      const detail =
        (Array.isArray(data?.errors) && data.errors.length ? data.errors.join(", ") : "") ||
        data?.message ||
        error?.message ||
        "Could not save student";
      console.error("Error creating student:", data ?? error);
      toast.error(detail);
    } finally {
      setSavingStudent(false);
    }
  };

  const handleSaveStudent = () => createStudentFromFees(newStudentForm);

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Fees Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Students: ${stats.totalStudents}`, 14, 36);
    doc.text(`Total Fees Collected: ${stats.totalPaid.toLocaleString()} XAF`, 14, 42);
    doc.text(`Total Fees Outstanding: ${stats.totalDue.toLocaleString()} XAF`, 14, 48);
    doc.text(`Collection Rate: ${stats.collectionRate.toFixed(1)}%`, 14, 54);

    const tableData = filteredStudents.map((s) => {
      const status = getStatus(s.feesDue, getFeePlan(s, classMap.get(s.classId)).totalFee).label;
      return [
        s.fullName,
        classMap.get(s.classId)?.className || "",
        s.parentName,
        s.parentPhone,
        s.feesPaid.toLocaleString(),
        s.feesDue.toLocaleString(),
        status,
      ];
    });

    autoTable(doc, {
      startY: 60,
      head: [["Name", "Class", "Parent", "Phone", "Paid", "Due", "Status"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [0, 0, 0], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
      },
    });

    let shownPaid = 0;
    let shownDue = 0;
    for (const s of filteredStudents) {
      shownPaid += s.feesPaid;
      shownDue += s.feesDue;
    }

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Summary:`, 14, finalY);
    doc.text(`Total Students: ${filteredStudents.length}`, 14, finalY + 6);
    doc.text(`Total Paid: ${shownPaid.toLocaleString()} XAF`, 14, finalY + 12);
    doc.text(`Total Due: ${shownDue.toLocaleString()} XAF`, 14, finalY + 18);

    doc.save(`fees_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported successfully");
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Full Name", "Class", "Parent Name", "Parent Phone", "Fees Paid", "Fees Due", "Status"];

    const rows = filteredStudents.map((s) => {
      const status = getStatus(s.feesDue, getFeePlan(s, classMap.get(s.classId)).totalFee).label;
      return [
        s.fullName,
        classMap.get(s.classId)?.className || "",
        s.parentName,
        s.parentPhone,
        s.feesPaid.toString(),
        s.feesDue.toString(),
        status,
      ];
    });

    const csvContent = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fees_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("CSV exported successfully");
  };

  // Print debtors
  const printDebtors = () => {
    const debtors = filteredStudents.filter((s) => s.feesDue > 0);

    if (debtors.length === 0) {
      toast.error("No students with outstanding fees");
      return;
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("Please allow popups for printing");
      return;
    }

    const totalDue = debtors.reduce((sum, s) => sum + s.feesDue, 0);

    const rowsHtml = debtors
      .map((s, index) => {
        const classObj = classMap.get(s.classId);
        const status = getStatus(s.feesDue, getFeePlan(s, classObj).totalFee).label;
        const statusClass = status === "Owing" ? "status-owing" : "status-partial";
        return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(s.fullName)}</strong></td>
          <td>${escapeHtml(classObj?.className || "")}</td>
          <td>${escapeHtml(s.parentName)}</td>
          <td>${escapeHtml(s.parentPhone)}</td>
          <td>${s.feesPaid.toLocaleString()}</td>
          <td class="fee-due">${s.feesDue.toLocaleString()}</td>
          <td><span class="status-badge ${statusClass}">${status}</span></td>
        </tr>`;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Students with Outstanding Fees</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
          .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #f5f5f5; padding: 10px; text-align: left; border: 1px solid #ddd; }
          td { padding: 8px 10px; border: 1px solid #ddd; }
          .total { margin-top: 20px; font-weight: bold; }
          .fee-due { color: #dc3545; font-weight: bold; }
          .status-badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
          .status-owing { background: #fee2e2; color: #dc2626; }
          .status-partial { background: #fef3c7; color: #d97706; }
        </style>
      </head>
      <body>
        <h1>📋 Outstanding Fees Report</h1>
        <p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>
        <div class="summary">
          <h3>Summary</h3>
          <p>Total Debtors: ${debtors.length} students</p>
          <p>Total Outstanding: ${totalDue.toLocaleString()} XAF</p>
          <p>Average Due: ${(totalDue / debtors.length).toLocaleString()} XAF</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Student Name</th><th>Class</th><th>Parent</th>
              <th>Phone</th><th>Fees Paid</th><th>Fees Due</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}
          </tbody>
        </table>
        <div class="total"><p>Total Fees Due: ${totalDue.toLocaleString()} XAF</p></div>
        <script>
          window.onload = function() { window.print(); }
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return <CompactPageLoader label="Loading fees data..." />;
  }

  const showMore = feeRows.length > visibleCount && (
    <div className="border-t border-stone-100 p-4 text-center">
      <button
        type="button"
        onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
        className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold hover:bg-stone-50"
      >
        Show more ({feeRows.length - visibleCount} remaining)
      </button>
    </div>
  );

  const newStudentClass = newStudentForm.classId ? classMap.get(newStudentForm.classId) : undefined;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4 sm:space-y-6 2xl:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Fees & Finance</h1>
          <p className="text-sm text-black/60 mt-1">Track payments, issue receipts and enroll students.</p>
        </div>
        <button
          type="button"
          onClick={openNewStudent}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
        >
          <UserPlus className="size-4" /> Add Student
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 2xl:gap-6">
        <div className="min-w-0 rounded-2xl bg-brand p-3 text-white sm:p-5">
          <Wallet className="size-5 mb-3 opacity-80" />
          <div className="text-[10px] uppercase tracking-widest font-bold opacity-80">Collected</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold sm:text-2xl">{stats.totalPaid.toLocaleString()} XAF</div>
          <div className="text-xs opacity-80 mt-1">{stats.fullyPaidCount} fully paid</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 sm:p-5">
          <AlertTriangle className="size-5 mb-3 text-red-500" />
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/40">Outstanding</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold text-red-600 sm:text-2xl">{stats.totalDue.toLocaleString()} XAF</div>
          <div className="text-xs text-black/50 mt-1">{stats.debtorsCount} students owe</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 sm:p-5">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/40">Collection Rate</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold sm:text-2xl">{stats.collectionRate.toFixed(1)}%</div>
          <div className="text-xs text-black/50 mt-1">{stats.totalStudents} total students</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 sm:p-5">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/40">Average Due</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold sm:text-2xl">{stats.averageDue.toLocaleString()} XAF</div>
          <div className="text-xs text-black/50 mt-1">per student</div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid min-w-0 gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:flex sm:flex-wrap sm:items-center sm:p-4">
        <div className="relative min-w-0 w-full sm:flex-1 sm:basis-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or parent..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
          />
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Filter className="size-4 text-black/40" />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium sm:w-auto sm:max-w-[220px]"
          >
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{`${c.className} ${c.department ?? ""}`.trim()}</option>)}
          </select>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <select
            value={feeFilter}
            onChange={(e) => setFeeFilter(e.target.value)}
            className="min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium sm:w-auto"
          >
            <option value="all">All Students</option>
            <option value="fully-paid">Fully Paid</option>
            <option value="partial">Partial Payment</option>
            <option value="debtors">Owing / Partial (fees due)</option>
          </select>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "default" | "due-desc" | "due-asc")}
            aria-label="Sort students"
            className="min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium sm:w-auto"
          >
            <option value="default">Sort: Default</option>
            <option value="due-desc">Highest debt first</option>
            <option value="due-asc">Lowest debt first</option>
          </select>
        </div>

        {/* One click: all classes, debtors only, highest debt first. Click again to go back. */}
        {(() => {
          const debtorsViewActive = classFilter === "all" && feeFilter === "debtors";
          return (
            <button
              type="button"
              onClick={() => {
                if (debtorsViewActive) {
                  setFeeFilter("all");
                  setSortBy("default");
                  setClassFilter(classes[0]?.id ?? "all");
                } else {
                  setClassFilter("all");
                  setFeeFilter("debtors");
                  setSortBy("due-desc");
                }
              }}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold sm:w-auto sm:px-4 ${debtorsViewActive
                ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
                : "border-red-200 bg-white text-red-600 hover:bg-red-50"
                }`}
            >
              <AlertTriangle className="size-4 shrink-0" />
              {debtorsViewActive ? "Showing all debtors" : "Show all debtors"}
            </button>
          );
        })()}

        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <button onClick={printDebtors} className="col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-700 sm:col-span-1 sm:w-auto sm:px-4">
            <Printer className="size-4 shrink-0" /> Print Debtors
          </button>
          <button onClick={exportCSV} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-stone-50 sm:w-auto sm:px-4">
            <Download className="size-4 shrink-0" /> CSV
          </button>
          <button onClick={exportPDF} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-stone-50 sm:w-auto sm:px-4">
            <FileText className="size-4 shrink-0" /> PDF
          </button>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-display font-bold">
            Students with fees
            <span className="text-sm font-normal text-black/40 ml-2">
              ({filteredStudents.length} shown)
            </span>
          </h3>
          {studentsLoading && <span className="text-xs text-black/40">Updating…</span>}
        </div>

        {/* Desktop table (lg and up). Columns appear progressively as space allows:
            lg: student, tuition, paid, due, status, requirements, actions
            xl: + registration fee, labelled action buttons
            2xl: + separate class / parent / phone columns */}
        {isDesktop && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm xl:text-[15px]">
              <thead className="bg-stone-50 text-left text-[10px] font-bold uppercase tracking-widest text-black/50 xl:text-[11px]">
                <tr>
                  <th className="px-4 py-3 xl:px-5">Student</th>
                  <th className="hidden px-3 py-3 2xl:table-cell">Class</th>
                  <th className="hidden px-3 py-3 2xl:table-cell">Parent</th>
                  <th className="hidden px-3 py-3 2xl:table-cell">Phone</th>
                  <th className="px-3 py-3 text-right">Tuition Plan</th>
                  <th className="hidden px-3 py-3 text-right xl:table-cell">Registration</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-3 py-3 text-right">Due</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Requirement Check</th>
                  <th className="px-3 py-3 text-right xl:px-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {feeRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-black/40">
                      No students match your filters.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map(({ student: s, classObj, plan, status, statusColor, hasPayment, requirements, requirementsMet }) => (
                    <tr key={s.id} className="transition-colors even:bg-stone-50/50 hover:bg-emerald-50/30">
                      <td className="min-w-[180px] px-4 py-3 align-middle xl:px-5 xl:py-4">
                        <div className="break-words font-semibold leading-snug">{s.fullName}</div>
                        <div className="mt-0.5 text-xs text-black/50 2xl:hidden">
                          {classObj?.className || "—"}{s.parentName ? ` · ${s.parentName}` : ""}
                        </div>
                        {s.parentPhone && <div className="text-xs text-black/40 2xl:hidden">{s.parentPhone}</div>}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-middle 2xl:table-cell">{classObj?.className || "—"}</td>
                      <td className="hidden px-3 py-3 align-middle text-xs 2xl:table-cell">{s.parentName || "—"}</td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-middle text-xs tabular-nums 2xl:table-cell">{s.parentPhone || "—"}</td>
                      <td className="px-3 py-3 text-right align-middle text-xs tabular-nums xl:text-sm">
                        <strong className="whitespace-nowrap">{plan.tuitionFee.toLocaleString()} XAF</strong>
                        <span className="block text-black/45">{plan.tuitionInstallmentsPaid}/{plan.tuitionInstallments} installments paid</span>
                      </td>
                      <td className="hidden px-3 py-3 text-right align-middle text-xs tabular-nums xl:table-cell xl:text-sm">
                        {plan.registrationFeeRequired ? (
                          <>
                            <strong className="whitespace-nowrap">{plan.registrationFeeAmount.toLocaleString()} XAF</strong>
                            <span className="block text-black/45">{plan.registrationFeePaid.toLocaleString()} paid</span>
                          </>
                        ) : <span className="text-black/40">Not required</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right align-middle font-medium tabular-nums text-green-600">
                        {s.feesPaid.toLocaleString()}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-3 text-right align-middle font-bold tabular-nums ${s.feesDue > 0 ? "text-red-600" : "text-green-600"}`}>
                        {s.feesDue.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                      {/* Requirement Check (matches the header order) */}
                      <td className="px-3 py-3 text-center align-middle">
                        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                          {requirements.map((req) => {
                            const checked = !!requirementChecks[checkKey(s.id, req.id)];
                            return (
                              <label key={req.id} className="flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleRequirementCheck(s.id, req.id)}
                                  className="size-3.5 accent-blue-700"
                                />
                                <span className={checked ? "text-brand" : "text-black/60"}>{req.label}</span>
                              </label>
                            );
                          })}
                          {requirements.length === 0 && (
                            <span className="text-xs text-black/30">No requirements</span>
                          )}
                          {requirements.length > 0 && (
                            <span className="ml-1 text-[10px] text-black/40">({requirementsMet}/{requirements.length})</span>
                          )}
                        </div>
                      </td>
                      {/* Action */}
                      <td className="px-3 py-3 align-middle xl:px-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => reprintReceipt(s)}
                            disabled={!hasPayment}
                            title="Issue / reprint receipt"
                            aria-label={`Receipt for ${s.fullName}`}
                            className="inline-flex size-9 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-black/70 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 xl:size-auto xl:px-3 xl:py-2"
                          >
                            <Receipt className="size-4" />
                            <span className="hidden xl:inline">Receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => startPayment(s)}
                            disabled={s.feesDue <= 0}
                            title="Record_payment"
                            aria-label={`Record payment for ${s.fullName}`}
                            className="inline-flex size-9 items-center justify-center gap-1.5 rounded-lg bg-brand text-xs font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40 xl:size-auto xl:px-3 xl:py-2"
                          >
                            <Plus className="size-4" />
                            <span className="hidden xl:inline">Record_payment</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {showMore}
          </div>
        )}

        {/* Phones & tablets: card list (2 columns on tablets) */}
        {!isDesktop && (
          <div>
            {feeRows.length === 0 ? (
              <div className="py-12 text-center text-black/40">
                No students match your filters.
              </div>
            ) : (
              <ul className="-mb-px grid grid-cols-1 md:grid-cols-2">
                {visibleRows.map(({ student: s, classObj, plan, status, statusColor, hasPayment, requirements, requirementsMet }) => (
                  <li key={s.id} className="min-w-0 space-y-3 border-b border-stone-100 p-4 md:odd:border-r">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.fullName}</p>
                        <p className="truncate text-xs text-black/50">{classObj?.className || "—"} · {s.parentName || "—"}</p>
                        {s.parentPhone && <p className="text-xs text-black/40">{s.parentPhone}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${statusColor}`}>
                        {status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-stone-50 p-2">
                        <div className="text-black/45">Tuition</div>
                        <div className="font-semibold">{plan.tuitionFee.toLocaleString()} XAF</div>
                        <div className="text-black/45">{plan.tuitionInstallmentsPaid}/{plan.tuitionInstallments} paid</div>
                      </div>
                      <div className="rounded-lg bg-stone-50 p-2">
                        <div className="text-black/45">Registration</div>
                        {plan.registrationFeeRequired ? (
                          <>
                            <div className="font-semibold">{plan.registrationFeeAmount.toLocaleString()} XAF</div>
                            <div className="text-black/45">{plan.registrationFeePaid.toLocaleString()} paid</div>
                          </>
                        ) : <div className="text-black/40">Not required</div>}
                      </div>
                      <div className="rounded-lg bg-stone-50 p-2">
                        <div className="text-black/45">Paid</div>
                        <div className="font-semibold text-green-600">{s.feesPaid.toLocaleString()} XAF</div>
                      </div>
                      <div className="rounded-lg bg-stone-50 p-2">
                        <div className="text-black/45">Due</div>
                        <div className={`font-semibold ${s.feesDue > 0 ? "text-red-600" : "text-green-600"}`}>{s.feesDue.toLocaleString()} XAF</div>
                      </div>
                    </div>

                    {requirements.length > 0 && (
                      <div className="rounded-lg bg-stone-50 p-2 text-xs">
                        <div className="mb-1 text-black/45">Requirements ({requirementsMet}/{requirements.length})</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {requirements.map((req) => {
                            const checked = !!requirementChecks[checkKey(s.id, req.id)];
                            return (
                              <label key={req.id} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleRequirementCheck(s.id, req.id)}
                                  className="size-3.5 accent-blue-700"
                                />
                                <span className={checked ? "text-brand" : "text-black/60"}>{req.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => reprintReceipt(s)}
                        disabled={!hasPayment}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-black/70 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Receipt className="size-4 shrink-0" /> Receipt
                      </button>
                      <button
                        type="button"
                        onClick={() => startPayment(s)}
                        disabled={s.feesDue <= 0}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="size-4 shrink-0" /> Record payment
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {showMore}
          </div>
        )}
      </div>

      {/* Record payment dialog */}
      {payingStudent && (() => {
        const plan = getFeePlan(payingStudent, classMap.get(payingStudent.classId));
        const installmentNumber = plan.tuitionInstallmentsPaid + 1;
        const maxForType = paymentType === "registration" ? plan.registrationDue : plan.tuitionDue;
        const suggested = getSuggestedAmount(plan, paymentType);
        const remainder = Math.max(0, maxForType - paymentAmount);
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPayingStudent(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">Record Fee Payment</h2>
                  <p className="mt-1 text-sm text-black/55">{payingStudent.fullName} · {classMap.get(payingStudent.classId)?.className}</p>
                </div>
                <button type="button" onClick={() => setPayingStudent(null)} className="grid size-8 place-items-center rounded-lg text-black/45 hover:bg-stone-100" aria-label="Close payment dialog">
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 text-xs">
                <p>Tuition due <strong className="block text-sm">{plan.tuitionDue.toLocaleString()} XAF</strong></p>
                <p>Registration due <strong className="block text-sm">{plan.registrationDue.toLocaleString()} XAF</strong></p>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">Payment category</span>
                  <select value={paymentType} onChange={(event) => changePaymentType(event.target.value as "tuition" | "registration")} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
                    {plan.registrationDue > 0 && <option value="registration">Registration fee</option>}
                    {plan.tuitionDue > 0 && <option value="tuition">Tuition installment {installmentNumber} of {plan.tuitionInstallments}</option>}
                  </select>
                </label>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                      {paymentType === "registration" ? "Registration payment (XAF)" : `Tuition payment (XAF) — installment ${installmentNumber} of ${plan.tuitionInstallments}`}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={maxForType}
                      step={1}
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(Math.max(0, Number(event.target.value) || 0))}
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                    />
                    <span className="mt-1 block text-xs text-black/45">
                      Pay any amount. Suggested {paymentType === "tuition" ? "installment" : "amount"}: {suggested.toLocaleString()} XAF · max {maxForType.toLocaleString()} XAF
                    </span>
                  </label>

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-black/60">Amount paying now</span>
                      <strong>{Number(paymentAmount || 0).toLocaleString()} XAF</strong>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-black/60">Balance after payment</span>
                      <strong className={remainder > 0 ? "text-red-600" : "text-green-700"}>{remainder.toLocaleString()} XAF</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setPayingStudent(null)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold hover:bg-stone-50">Cancel</button>
                <button type="button" onClick={() => recordFeePayment(false)} disabled={savingPayment || paymentAmount <= 0} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50">
                  {savingPayment ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => recordFeePayment(true)} disabled={savingPayment || paymentAmount <= 0} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">
                  <Printer className="size-4" /> {savingPayment ? "Saving..." : "Save & Print Receipt"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add student dialog */}
      {showNewStudent && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowNewStudent(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-xl mb-5">Add Student</h3>

            <div className="space-y-4">
              {/* Class */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Class *</label>
                <select
                  value={newStudentForm.classId}
                  onChange={(e) => {
                    const classObj = classMap.get(e.target.value);
                    updateNewStudent({ classId: e.target.value, department: classObj?.department ?? "" });
                    setNewStudentChecks({});
                  }}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} - {c.department} · {c.tuitionFee.toLocaleString()} XAF
                    </option>
                  ))}
                </select>
              </div>

              {/* Student details */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Full name *</label>
                <input
                  value={newStudentForm.fullName}
                  onChange={(e) => updateNewStudent({ fullName: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Gender</label>
                  <select
                    value={newStudentForm.gender}
                    onChange={(e) => updateNewStudent({ gender: e.target.value as Student["gender"] })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Date of birth</label>
                  <input
                    type="date"
                    value={newStudentForm.dob}
                    onChange={(e) => updateNewStudent({ dob: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Parent name</label>
                  <input
                    value={newStudentForm.parentName}
                    onChange={(e) => updateNewStudent({ parentName: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Parent phone *</label>
                  <input
                    type="tel"
                    value={newStudentForm.parentPhone}
                    onChange={(e) => updateNewStudent({ parentPhone: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Address</label>
                <input
                  value={newStudentForm.address}
                  onChange={(e) => updateNewStudent({ address: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              {/* Registration requirements */}
              {newStudentClass && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">
                    Registration requirements for {newStudentClass.className}
                  </label>
                  <div className="space-y-2">
                    {newStudentClass.registrationRequirements.map((req) => (
                      <label key={req.id} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2">
                        <input
                          type="checkbox"
                          checked={!!newStudentChecks[req.id]}
                          onChange={() => setNewStudentChecks((prev) => ({ ...prev, [req.id]: !prev[req.id] }))}
                          className="size-4 accent-blue-700"
                        />
                        <span className={newStudentChecks[req.id] ? "text-brand font-medium" : "text-black/60"}>{req.label}</span>
                      </label>
                    ))}
                    {newStudentClass.registrationRequirements.length === 0 && (
                      <p className="text-xs text-black/40">No registration requirements configured for this class</p>
                    )}
                  </div>
                </div>
              )}

              {/* Up-front payment */}
              {newStudentClass && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Up-front payment (XAF)</label>
                  <input
                    type="number"
                    min={0}
                    value={Number(newStudentForm.upfrontPayment) || 0}
                    onChange={(e) => updateNewStudent({ upfrontPayment: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* Fee summary */}
              {newStudentClass && (
                <div className="rounded-lg bg-stone-50 p-3">
                  <div className="text-sm font-bold">Fee Summary</div>
                  <div className="mt-1 space-y-1 text-xs text-black/60">
                    <p>Tuition: {newStudentClass.tuitionFee.toLocaleString()} XAF</p>
                    <p>Registration fee: {(newStudentClass.registrationFeeRequired ? newStudentClass.registrationFeeAmount : 0).toLocaleString()} XAF</p>
                    <p>Total required: {getClassTotalFee(newStudentClass).toLocaleString()} XAF</p>
                    <p>
                      Requirements confirmed:{" "}
                      {newStudentClass.registrationRequirements.filter((r) => newStudentChecks[r.id]).length}/
                      {newStudentClass.registrationRequirements.length}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowNewStudent(false)}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStudent}
                className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={savingStudent || !newStudentForm.classId}
              >
                {savingStudent ? "Saving..." : "Add Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}