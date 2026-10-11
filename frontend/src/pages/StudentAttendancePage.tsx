import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Save, RefreshCw, Award, Printer, Check } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import axios from "axios";
import { toast } from "sonner";
import jsPDF from "jspdf";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://BCHS-back.onrender.com/api";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

type Student = {
    id: string;
    fullName: string;
    gender?: string;
    classId?: string;
    department?: string;
    matricule?: string;
    admissionNumber?: string;
};

type ClassItem = {
    id: string;
    className?: string;
    name?: string;
    department?: string;
    acedemicYear?: string;
    academicYear?: string;
};

const statusMeta: Record<AttendanceStatus, { label: string; color: string }> = {
    present: { label: "Present", color: "bg-[#155DAA] text-white" },
    absent: { label: "Absent", color: "bg-red-600 text-white" },
    late: { label: "Late", color: "bg-amber-500 text-slate-900" },
    excused: { label: "Excused", color: "bg-sky-600 text-white" },
};

// BCHS brand palette (RGB) - mirrors frontend/src/styles.css (@theme) so the
// printed certificate carries the project's main name and color.
const BRAND: [number, number, number] = [21, 93, 170];      // #155DAA --color-brand
const BRAND_DARK: [number, number, number] = [23, 50, 77];  // #17324D deep brand ink
const GOLD: [number, number, number] = [210, 173, 75];      // #d2ad4b accent
const GOLD_LIGHT: [number, number, number] = [226, 197, 122];
const PAPER: [number, number, number] = [250, 252, 255];    // cool paper white
const INK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [95, 95, 95];

const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getWeekdays = (dateValue: string) => {
    const [year, month, day] = dateValue.split("-").map(Number);
    const monday = new Date(year, month - 1, day);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    return Array.from({ length: 5 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return {
            value: formatDateInput(date),
            dayName: date.toLocaleDateString(undefined, { weekday: "long" }),
            shortDate: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        };
    });
};

export function StudentAttendancePage() {
    const today = formatDateInput(new Date());
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [printingCertificates, setPrintingCertificates] = useState(false);
    const weekdays = useMemo(() => getWeekdays(selectedDate), [selectedDate]);

    const fetchClasses = async () => {
        try {
            const response = await axios.get(`${API_BASE}/classes`);
            if (response.data.success) {
                const mapped = response.data.data.map((item: any) => ({
                    ...item,
                    id: item._id || item.id,
                    className: item.className || item.name,
                }));
                setClasses(mapped);
                if (!selectedClassId && mapped[0]) setSelectedClassId(mapped[0].id);
            }
        } catch (error) {
            console.error("Error fetching classes", error);
            toast.error("Failed to load classes");
        }
    };

    const fetchStudents = async (classId: string) => {
        if (!classId) {
            setStudents([]);
            return;
        }

        try {
            const response = await axios.get(`${API_BASE}/students/class/${classId}`);
            if (response.data.success) {
                const mapped = response.data.data.map((item: any) => ({
                    ...item,
                    id: item._id || item.id,
                    admissionNumber: item.matricule || item.admissionNumber || "N/A",
                }));
                setStudents(mapped);
            }
        } catch (error) {
            console.error("Error fetching students", error);
            toast.error("Failed to load students");
        }
    };

    const syncAttendance = async () => {
        if (!selectedClassId) return;

        try {
            const response = await axios.get(`${API_BASE}/attendance/students`, {
                params: {
                    classId: selectedClassId,
                    from: weekdays[0].value,
                    to: weekdays[weekdays.length - 1].value,
                },
            });

            if (response.data.success) {
                const nextState: Record<string, AttendanceStatus> = {};
                for (const record of response.data.data || []) {
                    const date = new Date(record.date).toISOString().slice(0, 10);
                    nextState[`${String(record.studentId)}:${date}`] = (record.status || "present") as AttendanceStatus;
                }
                setAttendance(nextState);
            }
        } catch (error) {
            console.error("Error fetching attendance", error);
        }
    };

    useEffect(() => {
        const bootstrap = async () => {
            setLoading(true);
            await fetchClasses();
            setLoading(false);
        };

        void bootstrap();
    }, []);

    useEffect(() => {
        if (!selectedClassId) {
            setAttendance({});
            setStudents([]);
            return;
        }

        const loadClassStudents = async () => {
            setLoading(true);
            await fetchStudents(selectedClassId);
            // NOTE: attendance is synced by the effect below (it also depends on
            // selectedClassId) - doing it here as well fetched the same week
            // twice on every class change.
            setLoading(false);
        };

        void loadClassStudents();
    }, [selectedClassId]);

    useEffect(() => {
        if (selectedClassId) {
            void syncAttendance();
        } else {
            setAttendance({});
        }
    }, [selectedDate, selectedClassId]);

    const classStudents = useMemo(() => {
        return students
            .filter((student) => student.classId === selectedClassId)
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }, [students, selectedClassId]);

    // Weekdays that can already be marked (today or in the past), hoisted out
    // of the per-student loops below.
    const markableWeekdays = useMemo(
        () => weekdays.filter((weekday) => weekday.value <= today),
        [weekdays],
    );

    // Single pass over the whole class (memoized) instead of building a huge
    // intermediate array and scanning it 4x on every render - classes can hold
    // hundreds of students and every checkbox click used to re-run that work.
    const { totalPresent, totalAbsent, totalLate, totalExcused } = useMemo(() => {
        const totals = { totalPresent: 0, totalAbsent: 0, totalLate: 0, totalExcused: 0 };
        for (const student of classStudents) {
            for (const weekday of markableWeekdays) {
                const status = attendance[`${student.id}:${weekday.value}`];
                if (status === "present") totals.totalPresent++;
                else if (status === "late") totals.totalLate++;
                else if (status === "excused") totals.totalExcused++;
                else totals.totalAbsent++; // nothing marked yet counts as absent
            }
        }
        return totals;
    }, [classStudents, markableWeekdays, attendance]);

    // ---- Pagination -------------------------------------------------------
    // Only the students of the current page are rendered (both the mobile card
    // list and the desktop table), which keeps the register fast even for very
    // large classes. Stats above still cover the whole class.
    const PAGE_SIZE_OPTIONS = [25, 50, 100, 0] as const; // 0 = show every student
    const [pageSize, setPageSize] = useState(50);
    const [pageIndex, setPageIndex] = useState(0);

    useEffect(() => {
        setPageIndex(0);
    }, [selectedClassId, pageSize]);

    const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(classStudents.length / pageSize)) : 1;
    const safePageIndex = Math.min(pageIndex, pageCount - 1);
    const pageStudents = useMemo(
        () => (pageSize > 0
            ? classStudents.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize)
            : classStudents),
        [classStudents, safePageIndex, pageSize],
    );

    const handleStatusChange = useCallback((studentId: string, date: string, status: AttendanceStatus) => {
        setAttendance((prev) => ({ ...prev, [`${studentId}:${date}`]: status }));
    }, []);

    const saveAttendance = async () => {
        if (!selectedClassId) {
            toast.error("Select a class before saving attendance");
            return;
        }

        setSaving(true);
        try {
            const academicYear = classes.find((item) => item.id === selectedClassId)?.acedemicYear
                || classes.find((item) => item.id === selectedClassId)?.academicYear
                || new Date().getFullYear().toString();

            const daysToSave = weekdays.filter((weekday) => weekday.value <= today);
            if (!daysToSave.length) {
                toast.error("There are no past or current weekdays to save");
                return;
            }

            const payload = classStudents.flatMap((student) => daysToSave.map((weekday) => {
                const month = new Date(`${weekday.value}T00:00:00`).getMonth();
                return {
                    studentId: student.id,
                    classId: selectedClassId,
                    date: weekday.value,
                    academicYear,
                    term: month >= 8 ? "first" : month <= 3 ? "second" : "third",
                    period: "day",
                    status: attendance[`${student.id}:${weekday.value}`] || "absent",
                    recordedBy: "admin",
                };
            }));

            await axios.post(`${API_BASE}/attendance/students/bulk`, payload);
            await syncAttendance();
            toast.success("Student attendance saved for the selected weekdays");
        } catch (error: any) {
            console.error("Error saving attendance", error);
            toast.error(error.response?.data?.message || "Could not save attendance");
        } finally {
            setSaving(false);
        }
    };

    // Resolve the academic year that best matches the given class
    // (classes store it as `acedemicYear` - a typo used across the app - or `academicYear`).
    const resolveAcademicYear = (classId?: string) => {
        const selectedClass = classes.find((item) => item.id === classId)
            || classes.find((item) => item.id === selectedClassId);
        return selectedClass?.acedemicYear
            || selectedClass?.academicYear
            || new Date().getFullYear().toString();
    };

    // Fetch the attendance summary (present / absent / late / excused / rate)
    // for one student for the whole academic year.
    const fetchAttendanceSummary = async (studentId: string, academicYear: string) => {
        const response = await axios.get(`${API_BASE}/attendance/students/summary`, {
            params: { studentId, academicYear, term: "annual", section: "englophone" },
        });
        return (response.data?.data || [])[0] || {};
    };

    // Draw one student's certificate onto the given (landscape A4) jsPDF document.
    // When `newPage` is true a fresh page is added first (used for every page after
    // the first one in bulk printing).
    const renderCertificatePage = (
        doc: jsPDF,
        student: Student,
        summary: any,
        academicYear: string,
        newPage: boolean,
    ) => {
        if (newPage) doc.addPage();

        const selectedClass = classes.find((item) => item.id === (student.classId || selectedClassId));
        const present = summary?.present ?? 0;
        const absent = summary?.absent ?? 0;
        const late = summary?.late ?? 0;
        const excused = summary?.excused ?? 0;
        const schoolDays = summary?.schoolDays ?? 0;
        const totalSessions = present + absent + late + excused;
        const rate = summary?.attendanceRate ?? (totalSessions > 0
            ? Math.round(((present + late) / totalSessions) * 100)
            : 0);

        const matricule = student.matricule || student.admissionNumber || "N/A";
        const className = selectedClass
            ? `${selectedClass.className || ""} ${selectedClass.department || student.department || ""}`.trim()
            : student.classId || "N/A";
        const issued = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        const certNo = `BCHS-${academicYear}-${String(matricule !== "N/A" ? matricule : student.id).slice(-6).toUpperCase()}`;

        const W = doc.internal.pageSize.getWidth();   // 297
        const H = doc.internal.pageSize.getHeight();  // 210
        const cx = W / 2;

        // ---- Paper background ----
        doc.setFillColor(...PAPER);
        doc.rect(0, 0, W, H, "F");

        // ---- Triple border: heavy brand blue / gold / hairline brand blue ----
        doc.setDrawColor(...BRAND);
        doc.setLineWidth(2.4);
        doc.rect(8, 8, W - 16, H - 16, "S");
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(0.7);
        doc.rect(12, 12, W - 24, H - 24, "S");
        doc.setDrawColor(...BRAND);
        doc.setLineWidth(0.25);
        doc.rect(14.5, 14.5, W - 29, H - 29, "S");

        // ---- Corner ornaments ----
        const corners: Array<[number, number]> = [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]];
        corners.forEach(([x, y]) => {
            doc.setFillColor(...BRAND);
            doc.circle(x, y, 4.2, "F");
            doc.setFillColor(...GOLD_LIGHT);
            doc.circle(x, y, 2.6, "F");
            doc.setFillColor(...BRAND_DARK);
            doc.circle(x, y, 1, "F");
        });

        // ---- Faint watermark ring behind the content ----
        doc.setDrawColor(226, 235, 247);
        doc.setLineWidth(0.6);
        doc.circle(cx, 105, 58, "S");
        doc.setLineWidth(0.3);
        doc.circle(cx, 105, 54, "S");

        // ---- School heading ----
        doc.setTextColor(...BRAND);
        doc.setFont("times", "bold");
        doc.setFontSize(19);
        doc.text("BCHS DOUALA", cx, 31, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text("(BCHS)", cx, 37, { align: "center", charSpace: 1.5 } as any);

        // ---- Gold divider with diamond ----
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(0.5);
        doc.line(cx - 70, 43, cx - 6, 43);
        doc.line(cx + 6, 43, cx + 70, 43);
        doc.setFillColor(...GOLD);
        doc.triangle(cx - 4, 43, cx, 40, cx + 4, 43, "F");
        doc.triangle(cx - 4, 43, cx, 46, cx + 4, 43, "F");

        // ---- Title ----
        doc.setTextColor(...BRAND_DARK);
        doc.setFont("times", "bold");
        doc.setFontSize(40);
        doc.text("CERTIFICATE", cx, 63, { align: "center", charSpace: 2 } as any);
        doc.setTextColor(...GOLD);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("OF ATTENDANCE", cx, 72, { align: "center", charSpace: 4 } as any);

        // ---- Presented to ----
        doc.setTextColor(...MUTED);
        doc.setFont("times", "italic");
        doc.setFontSize(12);
        doc.text("This certificate is proudly presented to", cx, 85, { align: "center" });

        // ---- Student name (shrinks to fit long names) ----
        doc.setTextColor(...INK);
        doc.setFont("times", "bolditalic");
        let nameSize = 32;
        doc.setFontSize(nameSize);
        while (doc.getTextWidth(student.fullName) > 200 && nameSize > 16) {
            nameSize -= 1;
            doc.setFontSize(nameSize);
        }
        doc.text(student.fullName, cx, 99, { align: "center" });
        const nameWidth = Math.max(doc.getTextWidth(student.fullName) + 24, 110);
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(0.6);
        doc.line(cx - nameWidth / 2, 103, cx + nameWidth / 2, 103);

        // ---- Student details ----
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        doc.text(
            `Matricule: ${matricule}     |     Class: ${className}     |     Department: ${student.department || "General"}`,
            cx, 110, { align: "center" },
        );

        // ---- Citation ----
        doc.setFont("times", "normal");
        doc.setFontSize(11.5);
        doc.setTextColor(...INK);
        const statement = `in recognition of the attendance record maintained during the ${academicYear} academic year, `
            + `as drawn from the official school attendance register, with an overall attendance rate of ${rate}%.`;
        const lines = doc.splitTextToSize(statement, 190);
        doc.text(lines, cx, 119, { align: "center", lineHeightFactor: 1.5 } as any);

        // ---- Statistic tiles ----
        const tiles: Array<{ label: string; value: string; highlight?: boolean }> = [
            { label: "Present", value: String(present) },
            { label: "Absent", value: String(absent) },
            { label: "Late", value: String(late) },
            { label: "Excused", value: String(excused) },
            { label: "School Days", value: String(schoolDays) },
            { label: "Attendance Rate", value: `${rate}%`, highlight: true },
        ];
        const tileH = 20;
        const gap = 4;
        const widthFor = (tile: { highlight?: boolean }) => (tile.highlight ? 48 : 34);
        const totalW = tiles.reduce((sum, t) => sum + widthFor(t), 0) + (tiles.length - 1) * gap;
        let cursorX = (W - totalW) / 2;
        const tileY = 133;
        tiles.forEach((tile) => {
            const tileW = widthFor(tile);
            const x = cursorX;
            cursorX += tileW + gap;

            if (tile.highlight) {
                doc.setFillColor(...BRAND);
                doc.setDrawColor(...BRAND_DARK);
            } else {
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(...GOLD);
            }
            doc.setLineWidth(0.5);
            doc.roundedRect(x, tileY, tileW, tileH, 1.8, 1.8, "FD");

            // Value
            doc.setFont("times", "bold");
            doc.setFontSize(17);
            doc.setTextColor(...(tile.highlight ? ([255, 255, 255] as [number, number, number]) : BRAND));
            doc.text(tile.value, x + tileW / 2, tileY + 10, { align: "center" });

            // Label: shrink the font until it fits inside the tile with padding
            const label = tile.label.toUpperCase();
            doc.setFont("helvetica", "bold");
            let labelSize = 7;
            doc.setFontSize(labelSize);
            while (doc.getTextWidth(label) > tileW - 8 && labelSize > 4.5) {
                labelSize -= 0.2;
                doc.setFontSize(labelSize);
            }
            doc.setTextColor(...(tile.highlight ? ([224, 237, 251] as [number, number, number]) : MUTED));
            doc.text(label, x + tileW / 2, tileY + 16, { align: "center" });
        });

        // ---- Official seal ----
        const sealX = cx;
        const sealY = 172;
        doc.setFillColor(...GOLD);
        doc.triangle(sealX - 8, sealY + 8, sealX - 1, sealY + 11, sealX - 10, sealY + 20, "F");
        doc.triangle(sealX + 8, sealY + 8, sealX + 1, sealY + 11, sealX + 10, sealY + 20, "F");
        doc.setFillColor(...GOLD);
        doc.circle(sealX, sealY, 13.5, "F");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.circle(sealX, sealY, 11.6, "S");
        doc.setFillColor(...BRAND);
        doc.circle(sealX, sealY, 9.6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.6);
        doc.text("OFFICIAL", sealX, sealY - 3.2, { align: "center", charSpace: 0.5 } as any);
        doc.setFont("times", "bold");
        doc.setFontSize(7);
        doc.text("BCHS", sealX, sealY + 1.2, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.6);
        doc.text("SEAL", sealX, sealY + 4.8, { align: "center", charSpace: 0.5 } as any);

        // ---- Signature lines ----
        const sigY = 180;
        const sigW = 62;
        const leftX = 40;
        const rightX = W - 40 - sigW;
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.4);
        doc.line(leftX, sigY, leftX + sigW, sigY);
        doc.line(rightX, sigY, rightX + sigW, sigY);
        doc.setTextColor(...INK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Class Teacher", leftX + sigW / 2, sigY + 5, { align: "center" });
        doc.text("Head of School", rightX + sigW / 2, sigY + 5, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text("Signature & Date", leftX + sigW / 2, sigY + 9, { align: "center" });
        doc.text("Signature & Date", rightX + sigW / 2, sigY + 9, { align: "center" });

        // ---- Footer ----
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(`Certificate No. ${certNo}   |   Issued on ${issued}   |   BCHS DOUALA`, cx, H - 17, { align: "center" });
    };

    const createCertificateDocument = () => new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Download a printable attendance certificate for a single student.
    const downloadAttendanceCertificate = async (student: Student) => {
        const academicYear = resolveAcademicYear(student.classId);
        try {
            const summary = await fetchAttendanceSummary(student.id, academicYear);
            const doc = createCertificateDocument();
            renderCertificatePage(doc, student, summary, academicYear, false);
            const safeName = student.fullName.replace(/[^a-z0-9]+/gi, "_");
            doc.save(`Attendance_Certificate_${safeName}_${academicYear}.pdf`);
            toast.success(`Attendance certificate downloaded for ${student.fullName}`);
        } catch (error: any) {
            console.error("Error generating attendance certificate", error);
            toast.error(error.response?.data?.message || "Could not generate the attendance certificate");
        }
    };

    // Bulk print: one PDF, one certificate page per student of the selected class.
    const printAllAttendanceCertificates = async () => {
        if (!classStudents.length) {
            toast.error("No students to print for this class");
            return;
        }
        setPrintingCertificates(true);
        try {
            const academicYear = resolveAcademicYear(selectedClassId);
            const doc = createCertificateDocument();

            // One request for the whole class instead of one HTTP call per
            // student - with large classes the old Promise.all fired hundreds
            // of requests at once and stalled the browser / server.
            const summaries = await axios.get(`${API_BASE}/attendance/students/summary`, {
                params: { classId: selectedClassId, academicYear, term: "annual", section: "englophone" },
            })
                .then((response) => (response.data?.data || []) as any[])
                .catch(() => [] as any[]);
            const summariesByStudent = new Map<string, any>(
                summaries.map((summary) => [String(summary.studentId), summary]),
            );

            classStudents.forEach((student, index) => {
                renderCertificatePage(doc, student, summariesByStudent.get(student.id) || {}, academicYear, index > 0);
            });

            const safeClass = (classes.find((item) => item.id === selectedClassId)?.className || "class")
                .replace(/[^a-z0-9]+/gi, "_");
            doc.save(`Attendance_Certificates_${safeClass}_${academicYear}.pdf`);
            toast.success(`Generated ${classStudents.length} attendance certificate(s)`);
        } catch (error: any) {
            console.error("Error generating attendance certificates", error);
            toast.error(error.response?.data?.message || "Could not generate the attendance certificates");
        } finally {
            setPrintingCertificates(false);
        }
    };


    if (loading) {
        return <CompactPageLoader label="Loading student attendance..." />;
    }

    const btnBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

    // Register table grid. Compact (matricule shown under the name) from lg,
    // full layout with a separate matricule column from xl. minmax(0,...) lets
    // columns shrink instead of forcing horizontal scroll.
    const rowGrid = "grid grid-cols-[minmax(0,2.4fr)_repeat(5,minmax(0,1fr))] xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_repeat(5,minmax(0,1fr))]";

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-4 sm:space-y-6 2xl:space-y-8">
            {/* ---------- Header / controls ---------- */}
            <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-black/45 sm:text-xs">BCHS · Daily attendance</p>
                        <h1 className="mt-1 text-xl font-display font-bold text-[#121212] sm:text-2xl">Student Attendance Register</h1>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 sm:w-auto">
                            <CalendarDays className="size-4 shrink-0 text-black/60" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(event) => setSelectedDate(event.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none sm:text-sm"
                                aria-label="Choose a date in the attendance week"
                            />
                            <span className="hidden whitespace-nowrap text-xs text-black/50 sm:inline">Week: Mon–Fri</span>
                        </div>

                        <select
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#155DAA] sm:w-auto sm:text-sm"
                            aria-label="Choose a class"
                        >
                            {classes.map((item) => (
                                <option key={item.id} value={item.id}>{item.className + " " + (item?.department ?? "")}</option>
                            ))}
                        </select>

                        <button
                            onClick={printAllAttendanceCertificates}
                            disabled={printingCertificates || classStudents.length === 0}
                            title="Download an attendance certificate for every student in this class (one PDF, one page each)"
                            className={`${btnBase} w-full border border-[#155DAA] bg-[#EAF2FB] text-[#155DAA] hover:bg-white focus-visible:ring-[#155DAA] sm:w-auto`}
                        >
                            {printingCertificates ? <RefreshCw className="size-4 animate-spin" /> : <Printer className="size-4" />}
                            <span className="sm:hidden">{printingCertificates ? "Printing..." : "Print All"}</span>
                            <span className="hidden sm:inline">{printingCertificates ? "Printing..." : "Print All Certificates"}</span>
                        </button>

                        <button
                            onClick={saveAttendance}
                            disabled={saving}
                            className={`${btnBase} hidden bg-[#155DAA] text-white hover:bg-[#104A87] focus-visible:ring-[#155DAA] sm:inline-flex`}
                        >
                            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                            {saving ? "Saving..." : "Save Attendance"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ---------- Stats ---------- */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatCard label="Present" value={totalPresent} tone="present" />
                <StatCard label="Absent" value={totalAbsent} tone="absent" />
                <StatCard label="Late" value={totalLate} tone="late" />
                <StatCard label="Excused" value={totalExcused} tone="excused" />
            </div>

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {classStudents.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-black/50">No students found for this class.</div>
                ) : (
                    <>
                        {/* ---------- Phones & tablets: one card per student (2 columns on tablets) ---------- */}
                        <div className="-mb-px grid grid-cols-1 md:grid-cols-2 lg:hidden">
                            {pageStudents.map((student) => (
                                <div key={student.id} className="min-w-0 space-y-3 border-b border-stone-200 p-3 sm:p-4 md:odd:border-r">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-[#121212]">{student.fullName}</div>
                                            <div className="mt-0.5 truncate text-xs text-black/50">
                                                {student.matricule || student.admissionNumber || "—"} · {student.department || "General"}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => downloadAttendanceCertificate(student)}
                                            aria-label={`Download certificate for ${student.fullName}`}
                                            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#CADCF0] bg-[#EAF2FB] px-3 py-2 text-xs font-semibold text-[#155DAA] transition active:scale-[0.97] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155DAA]"
                                        >
                                            <Award className="size-4" />
                                            <span className="max-[359px]:hidden">Certificate</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-5 gap-1 sm:gap-2">
                                        {weekdays.map((weekday) => {
                                            const status = attendance[`${student.id}:${weekday.value}`];
                                            const checked = status === "present" || status === "late";
                                            const isFuture = weekday.value > today;
                                            const isToday = weekday.value === today;
                                            return (
                                                <label
                                                    key={weekday.value}
                                                    className={`flex min-h-[64px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-0.5 py-2 text-center transition active:scale-95 ${isFuture
                                                        ? "cursor-not-allowed border-stone-100 bg-stone-50 opacity-50"
                                                        : checked
                                                            ? "border-[#CADCF0] bg-[#EAF2FB]"
                                                            : "border-stone-200 bg-white"
                                                        } ${isToday ? "ring-2 ring-[#155DAA]/50" : ""}`}
                                                >
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-black/55">
                                                        {weekday.dayName.slice(0, 3)}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={isFuture || saving}
                                                        aria-label={`${weekday.dayName} ${weekday.shortDate}: ${student.fullName} present`}
                                                        onChange={(event) => handleStatusChange(student.id, weekday.value, event.target.checked ? "present" : "absent")}
                                                        className="size-6 cursor-pointer accent-[#155DAA] disabled:cursor-not-allowed"
                                                    />
                                                    <span className="w-full truncate text-[9px] text-black/45">{weekday.shortDate}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ---------- Laptops & desktops: register table (no horizontal scroll) ---------- */}
                        <div className="hidden overflow-x-auto lg:block">
                            <div className="min-w-[620px]" role="table" aria-label="Weekly student attendance register">
                                <div role="row" className={`${rowGrid} border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-[0.1em] text-black/55`}>
                                    <div role="columnheader" className="px-3 py-3 xl:px-4">Student</div>
                                    <div role="columnheader" className="hidden px-3 py-3 xl:block xl:px-4">Matricule</div>
                                    {weekdays.map((weekday) => {
                                        const isToday = weekday.value === today;
                                        return (
                                            <div
                                                key={weekday.value}
                                                role="columnheader"
                                                className={`min-w-0 px-1 py-3 text-center ${isToday ? "bg-[#EAF2FB] text-[#155DAA]" : ""}`}
                                            >
                                                <div className="xl:hidden">{weekday.dayName.slice(0, 3)}</div>
                                                <div className="hidden xl:block">{weekday.dayName}</div>
                                                <div className="mt-1 truncate text-[11px] font-medium normal-case tracking-normal text-black/45">{weekday.shortDate}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {pageStudents.map((student) => (
                                    <div key={student.id} role="row" className={`${rowGrid} border-b border-stone-200 text-sm last:border-b-0 xl:text-[15px]`}>
                                        <div role="cell" className="min-w-0 px-3 py-3 xl:px-4 xl:py-4">
                                            <div className="break-words font-semibold leading-snug text-[#121212] xl:text-base">{student.fullName}</div>
                                            <div className="mt-0.5 truncate text-xs text-black/45">
                                                <span className="xl:hidden">{student.matricule || student.admissionNumber || "—"} · </span>
                                                {student.department || "General"}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => downloadAttendanceCertificate(student)}
                                                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[#CADCF0] bg-[#EAF2FB] px-2.5 py-1.5 text-[11px] font-semibold text-[#155DAA] transition hover:bg-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155DAA]"
                                            >
                                                <Award className="size-3.5" />
                                                Certificate
                                            </button>
                                        </div>
                                        <div role="cell" className="hidden min-w-0 break-words px-3 py-4 font-medium text-black/60 xl:block xl:px-4">
                                            {student.matricule || student.admissionNumber || "—"}
                                        </div>
                                        {weekdays.map((weekday) => {
                                            const status = attendance[`${student.id}:${weekday.value}`];
                                            const checked = status === "present" || status === "late";
                                            const isFuture = weekday.value > today;
                                            const isToday = weekday.value === today;
                                            return (
                                                <label
                                                    key={weekday.value}
                                                    role="cell"
                                                    className={`flex min-h-14 items-center justify-center border-l border-stone-100 ${isFuture ? "bg-stone-50" : isToday ? "bg-[#EAF2FB]/70 hover:bg-[#EAF2FB]" : "hover:bg-[#EAF2FB]/50"}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={isFuture || saving}
                                                        aria-label={`${weekday.dayName} ${weekday.shortDate}: ${student.fullName} present`}
                                                        onChange={(event) => handleStatusChange(student.id, weekday.value, event.target.checked ? "present" : "absent")}
                                                        className="peer sr-only"
                                                    />
                                                    <span
                                                        aria-hidden="true"
                                                        className={`flex size-7 items-center justify-center rounded-lg border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#155DAA] peer-focus-visible:ring-offset-2 xl:size-8 2xl:size-9 ${checked
                                                            ? "border-[#155DAA] bg-[#155DAA] text-white"
                                                            : "border-stone-300 bg-white text-transparent"
                                                            } ${isFuture || saving ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                                                    >
                                                        {checked && <Check className="size-4 xl:size-5" strokeWidth={3} />}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
                {classStudents.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-3 py-3 text-xs text-black/60 sm:px-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2">
                                <span className="text-black/50">Rows per page</span>
                                <select
                                    value={pageSize}
                                    onChange={(event) => setPageSize(Number(event.target.value))}
                                    className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#155DAA]"
                                >
                                    {PAGE_SIZE_OPTIONS.map((size) => (
                                        <option key={size} value={size}>{size === 0 ? "All" : size}</option>
                                    ))}
                                </select>
                            </label>
                            <span>
                                Showing {classStudents.length === 0 ? 0 : safePageIndex * (pageSize || classStudents.length) + 1}
                                {" – "}
                                {pageSize > 0 ? Math.min((safePageIndex + 1) * pageSize, classStudents.length) : classStudents.length}
                                {" of "}{classStudents.length} students
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                                disabled={safePageIndex === 0}
                                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold transition hover:bg-[#EAF2FB] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="font-medium">Page {safePageIndex + 1} / {pageCount}</span>
                            <button
                                type="button"
                                onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
                                disabled={safePageIndex >= pageCount - 1}
                                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-semibold transition hover:bg-[#EAF2FB] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
                <div className="border-t border-stone-200 px-3 py-3 text-xs text-black/50 sm:px-4">
                    Check a weekday to mark the student present. Unchecked past or current weekdays are saved as absent; future dates are calculated but cannot be marked yet.
                </div>
            </div>

            {/* ---------- Mobile sticky save bar ---------- */}
            <div className="sticky bottom-3 z-10 sm:hidden">
                <button
                    onClick={saveAttendance}
                    disabled={saving}
                    className={`${btnBase} w-full bg-[#155DAA] text-white shadow-lg hover:bg-[#104A87] focus-visible:ring-[#155DAA]`}
                >
                    {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Saving..." : "Save Attendance"}
                </button>
            </div>
        </div>
    );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: AttendanceStatus }) {
    const style = statusMeta[tone];

    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-black/45">{label}</div>
                    <div className="mt-1.5 text-xl font-display font-bold text-[#121212] sm:mt-2 sm:text-2xl">{value}</div>
                </div>
                <span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide lg:inline-flex ${style.color}`}>
                    {label}
                </span>
                <span className={`size-2.5 shrink-0 rounded-full lg:hidden ${style.color.split(" ")[0]}`} aria-hidden="true" />
            </div>
        </div>
    );
}