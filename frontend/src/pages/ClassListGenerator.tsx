import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, GraduationCap, Users } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://BCHS-back.onrender.com/api";

/* ─── BCHS brand ──────────────────────────────────────────────────────── */
const SCHOOL_NAME = "BCHS DOUALA";
const SCHOOL_SHORT = "BCHS";
const BLUE = "#155DAA";          // project main color (--color-brand)
const BLUE_DARK = "#17324D";     // deep brand ink (borders, headings)
const BLUE_LIGHT = "#EAF2FB";    // brand soft tint (--color-brand-soft)
const BLUE_BORDER = "#CADCF0";   // soft border
const BLUE_STRIPE = "#F4F8FD";   // zebra rows
const INK = "#121212";           // body text (--color-ink)
const MUTED = "#5B6573";         // secondary text
const GOLD = "#d2ad4b";

/* PDF page geometry (A4 portrait at 800px wide → 1131px tall) */
const PAGE_W = 800;
const PAGE_H = 1131;
const ROWS_PER_PAGE = 28;
const PDF_SCALE = 1.5;           // raise to 2 for sharper (but slower) PDFs
const PREVIEW_PAGE_SIZE = 30;    // rows rendered in the on-screen preview at a time

interface Student {
    id: string;
    fullName: string;
    matricule?: string;
    gender: string;
    classId: string;
}

interface SchoolClass {
    id: string;
    className: string;
    department: string;
    acedemicYear: string;
    section?: string;
}

const TERMS = [
    { label: "First Term", sequences: ["1st seq", "2nd seq"] },
    { label: "Second Term", sequences: ["3rd seq", "4th seq"] },
    { label: "Third Term", sequences: ["5th seq", "6th seq"] },
] as const;

type TermLabel = (typeof TERMS)[number]["label"];

/* ─── module-level caches: coming back to the page (or to a class) is instant,
       fresh data is still fetched in the background ─────────────────────── */

let classesCache: SchoolClass[] | null = null;
const studentsCache = new Map<string, Student[]>();

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/* Heavy libraries are loaded once and can be prefetched while the page is idle. */
const loadPdfLibs = () => Promise.all([import("jspdf"), import("html2canvas-pro")]);
let pdfLibsPromise: ReturnType<typeof loadPdfLibs> | null = null;
const getPdfLibs = () => {
    if (!pdfLibsPromise) {
        pdfLibsPromise = loadPdfLibs();
        pdfLibsPromise.catch(() => { pdfLibsPromise = null; });
    }
    return pdfLibsPromise;
};

const loadExcel = () => import("exceljs");
let excelPromise: ReturnType<typeof loadExcel> | null = null;
const getExcel = () => {
    if (!excelPromise) {
        excelPromise = loadExcel();
        excelPromise.catch(() => { excelPromise = null; });
    }
    return excelPromise;
};

/* ─── helpers ────────────────────────────────────────────────────────────── */

function escapeHtml(value: unknown): string {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character] || character);
}

function escapeCsv(value: string | number | undefined | null): string {
    const safe = String(value ?? "").replace(/\r?\n/g, " ").trim();
    return `"${safe.replace(/"/g, '""')}"`;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "class";
}

function classLabel(schoolClass: SchoolClass): string {
    return [schoolClass.className, schoolClass.department].filter(Boolean).join(" · ");
}

function sexLabel(gender: string): string {
    return gender === "male" ? "M" : gender === "female" ? "F" : "";
}

function downloadFile(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/* ─── printable page (one A4 sheet of the class list) ────────────────────── */

function buildPageHtml(ctx: {
    schoolClass: SchoolClass;
    term: TermLabel;
    sequences: readonly string[];
    pageStudents: Student[];
    startIndex: number;
    pageNumber: number;
    totalPages: number;
    totalStudents: number;
}): string {
    const { schoolClass, term, sequences, pageStudents, startIndex, pageNumber, totalPages, totalStudents } = ctx;
    const cell = `border:1px solid ${BLUE_DARK};padding:0 6px;height:26px;font-size:10.5px;`;
    const headCell = `border:1px solid ${BLUE_DARK};padding:6px 4px;font-size:10px;font-weight:700;text-align:center;background:${BLUE};color:#fff;`;

    const rows = Array.from({ length: ROWS_PER_PAGE }, (_, slot) => {
        const student = pageStudents[slot];
        const blank = `<td style="${cell}"></td>`;
        return `
          <tr style="background:${slot % 2 === 1 ? BLUE_STRIPE : "#ffffff"};">
            <td style="${cell}text-align:center;font-weight:600;">${student ? startIndex + slot + 1 : ""}</td>
            <td style="${cell}font-family:monospace;font-size:9.5px;">${student ? escapeHtml(student.matricule || "") : ""}</td>
            <td style="${cell}font-weight:600;">${student ? escapeHtml(student.fullName) : ""}</td>
            <td style="${cell}text-align:center;">${student ? sexLabel(student.gender) : ""}</td>
            ${sequences.map(() => blank).join("")}
          </tr>`;
    }).join("");

    const fillLine = (label: string, width: string) => `
      <div style="display:flex;align-items:flex-end;gap:6px;width:${width};">
        <span style="font-size:9.5px;font-weight:700;color:${BLUE_DARK};white-space:nowrap;text-transform:uppercase;letter-spacing:0.05em;">${label}</span>
        <span style="flex:1;border-bottom:1px dotted #333;height:14px;"></span>
      </div>`;

    return `
      <div style="box-sizing:border-box;width:${PAGE_W}px;height:${PAGE_H}px;display:flex;flex-direction:column;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;color:${INK};background:#fff;border:1px solid ${BLUE_BORDER};border-top:8px solid ${BLUE};">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;padding:12px 16px;border-bottom:3px solid ${GOLD};font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">
          <div style="text-align:left;line-height:1.5;color:${BLUE};">
            République du Cameroun<br/>
            <span style="font-weight:600;font-style:italic;text-transform:none;color:${MUTED};">Paix — Travail — Patrie</span><br/>
            Ministère des Enseignements Secondaires
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;max-width:250px;">
            <div style="width:50px;height:50px;border-radius:50%;background:${BLUE};border:3px solid ${GOLD};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;letter-spacing:0.02em;">${SCHOOL_SHORT}</div>
            <div style="font-size:11px;font-weight:900;color:${BLUE};text-transform:none;text-align:center;line-height:1.25;">${SCHOOL_NAME}</div>
          </div>
          <div style="text-align:right;line-height:1.5;color:${BLUE};">
            Republic of Cameroon<br/>
            <span style="font-weight:600;font-style:italic;text-transform:none;color:${MUTED};">Peace — Work — Fatherland</span><br/>
            Ministry of Secondary Education
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin:12px 16px 8px;padding:8px 14px;background:${BLUE_LIGHT};border-left:5px solid ${BLUE};">
          <div style="font-size:16px;font-weight:800;color:${BLUE};text-transform:uppercase;">Class List · ${escapeHtml(term)}</div>
          <div style="text-align:right;font-size:9.5px;font-weight:700;color:${MUTED};">ACADEMIC YEAR<br/><span style="font-size:12.5px;color:${INK};">${escapeHtml(schoolClass.acedemicYear || "—")}</span></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px 18px;margin:0 16px 8px;font-size:10.5px;">
          <div><b style="color:${MUTED};">CLASS</b><br/><span style="font-weight:700;color:${INK};">${escapeHtml(schoolClass.className)}</span></div>
          <div><b style="color:${MUTED};">DEPARTMENT</b><br/><span style="font-weight:700;color:${INK};">${escapeHtml(schoolClass.department || "—")}</span></div>
          <div><b style="color:${MUTED};">ENROLLED STUDENTS</b><br/><span style="font-weight:700;color:${INK};">${totalStudents}</span></div>
        </div>

        <div style="display:flex;gap:18px;margin:2px 16px 10px;">
          ${fillLine("Subject", "42%")}
          ${fillLine("Teacher", "38%")}
          ${fillLine("Date", "20%")}
        </div>

        <div style="margin:0 16px;">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <colgroup>
              <col style="width:6%;"/><col style="width:16%;"/><col style="width:38%;"/><col style="width:6%;"/>
              ${sequences.map(() => `<col style="width:${(100 - 6 - 16 - 38 - 6) / sequences.length}%;"/>`).join("")}
            </colgroup>
            <thead>
              <tr>
                <th style="${headCell}">N°</th>
                <th style="${headCell}">Matricule</th>
                <th style="${headCell}text-align:left;padding-left:8px;">Full name</th>
                <th style="${headCell}">Sex</th>
                ${sequences.map((sequence) => `<th style="${headCell}">${escapeHtml(sequence)}<br/><span style="font-weight:500;font-size:8.5px;">/20</span></th>`).join("")}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div style="margin-top:auto;padding:0 16px 10px;">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center;font-size:10px;margin-bottom:8px;">
            <div><div style="height:22px;border-bottom:1px dashed #000;"></div><div style="margin-top:3px;font-weight:600;">Subject Teacher</div></div>
            <div><div style="height:22px;border-bottom:1px dashed #000;"></div><div style="margin-top:3px;font-weight:600;">Class Master</div></div>
            <div><div style="height:22px;border-bottom:1px dashed #000;"></div><div style="margin-top:3px;font-weight:600;">Principal</div></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${BLUE_DARK};padding-top:5px;font-size:8.5px;font-weight:700;">
            <span>${SCHOOL_SHORT} · ${escapeHtml(classLabel(schoolClass))} · Printed ${new Date().toLocaleDateString()}</span>
            <span>Page ${pageNumber} / ${totalPages}</span>
          </div>
        </div>
      </div>`;
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export function ClassListGeneratorPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>(classesCache ?? []);
    const [selectedClassId, setSelectedClassId] = useState(classesCache?.[0]?.id ?? "");
    const [selectedTerm, setSelectedTerm] = useState<TermLabel>("First Term");
    const [loading, setLoading] = useState(!classesCache);
    const [classDataLoading, setClassDataLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState({ done: 0, total: 0 });
    const [visibleCount, setVisibleCount] = useState(PREVIEW_PAGE_SIZE);

    /* Prefetch the heavy export libraries shortly after the page is shown, so the
       first click on "Download PDF" / "Excel" doesn't wait for the download. */
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void getPdfLibs().catch(() => undefined);
            void getExcel().catch(() => undefined);
        }, 1500);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const fetchClasses = async () => {
            try {
                if (!classesCache) setLoading(true);
                const response = await axios.get(`${API_BASE}/classes`);
                if (cancelled) return;
                if (response.data.success) {
                    const mapped: SchoolClass[] = response.data.data.map((schoolClass: any) => ({
                        ...schoolClass,
                        id: schoolClass._id || schoolClass.id,
                        className: schoolClass.className || schoolClass.name || "",
                        department: schoolClass.department || "",
                        acedemicYear: schoolClass.acedemicYear || schoolClass.academicYear || "",
                    }));
                    classesCache = mapped;
                    setClasses(mapped);
                    setSelectedClassId((current) =>
                        current && mapped.some((item) => item.id === current) ? current : mapped[0]?.id || "",
                    );
                }
            } catch (error: any) {
                if (cancelled) return;
                console.error("Unable to load classes", error);
                toast.error(error.response?.data?.message || "Failed to load classes");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchClasses();
        return () => { cancelled = true; };
    }, []);

    const selectedClass = useMemo(
        () => classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? null,
        [classes, selectedClassId],
    );

    useEffect(() => {
        setVisibleCount(PREVIEW_PAGE_SIZE);

        if (!selectedClassId) {
            setStudents([]);
            setClassDataLoading(false);
            setRefreshing(false);
            return;
        }

        // Show cached students instantly (if we have them) and refresh in the background.
        const cached = studentsCache.get(selectedClassId);
        if (cached) {
            setStudents(cached);
            setClassDataLoading(false);
            setRefreshing(true);
        } else {
            setStudents([]);
            setClassDataLoading(true);
            setRefreshing(false);
        }

        let cancelled = false;
        axios.get(`${API_BASE}/students/class/${selectedClassId}`)
            .then((response) => {
                if (cancelled || !response.data.success) return;
                const mapped: Student[] = response.data.data.map((student: any) => ({
                    ...student,
                    id: String(student._id || student.id),
                    classId: String(student.classId),
                    matricule: student.matricule || student.admissionNumber || "",
                }));
                studentsCache.set(selectedClassId, mapped);
                setStudents(mapped);
            })
            .catch((error: any) => {
                if (cancelled) return;
                console.error("Unable to load students", error);
                toast.error(error.response?.data?.message || "Failed to load the students of this class");
            })
            .finally(() => {
                if (!cancelled) {
                    setClassDataLoading(false);
                    setRefreshing(false);
                }
            });

        return () => { cancelled = true; };
    }, [selectedClassId]);

    const classStudents = useMemo(
        () => students
            .filter((student) => student.classId === selectedClassId)
            .sort((first, second) => collator.compare(first.fullName, second.fullName)),
        [students, selectedClassId],
    );

    const { boys, girls } = useMemo(() => {
        let male = 0;
        let female = 0;
        for (const student of classStudents) {
            if (student.gender === "male") male++;
            else if (student.gender === "female") female++;
        }
        return { boys: male, girls: female };
    }, [classStudents]);

    const termConfig = TERMS.find((term) => term.label === selectedTerm) ?? TERMS[0];
    const totalPages = Math.max(1, Math.ceil(classStudents.length / ROWS_PER_PAGE));
    const previewRows = useMemo(() => classStudents.slice(0, visibleCount), [classStudents, visibleCount]);
    const fileBase = selectedClass
        ? `${slugify(selectedClass.className)}-${slugify(selectedClass.department)}-${slugify(selectedTerm)}-class-list`
        : "class-list";

    const headers = ["N°", "Matricule", "Full Name", "Sex", ...termConfig.sequences.map((sequence) => `${sequence} /20`)];
    const studentRow = (student: Student, index: number) => [
        index + 1,
        student.matricule || "",
        student.fullName,
        sexLabel(student.gender),
        ...termConfig.sequences.map(() => ""),
    ];

    const canExport = !loading && !classDataLoading && !!selectedClass;

    /* ── PDF ─────────────────────────────────────────────────────────────── */
    const exportPdf = async () => {
        if (!selectedClass) {
            toast.error("Choose a class before downloading");
            return;
        }

        setGeneratingPdf(true);
        setPdfProgress({ done: 0, total: totalPages });

        // One off-screen container is reused for every page instead of creating a new one each time.
        const container = document.createElement("div");
        container.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;z-index:-1;`;

        try {
            const [{ default: jsPDF }, { default: html2canvas }] = await getPdfLibs();
            const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
            document.body.appendChild(container);

            for (let page = 0; page < totalPages; page++) {
                container.innerHTML = buildPageHtml({
                    schoolClass: selectedClass,
                    term: selectedTerm,
                    sequences: termConfig.sequences,
                    pageStudents: classStudents.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE),
                    startIndex: page * ROWS_PER_PAGE,
                    pageNumber: page + 1,
                    totalPages,
                    totalStudents: classStudents.length,
                });

                await nextFrame(); // let the browser lay out the new page (and repaint the progress label)
                const canvas = await html2canvas(container, {
                    scale: PDF_SCALE,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                    width: PAGE_W,
                    height: PAGE_H,
                });
                if (page > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 210, 297, undefined, "FAST");
                setPdfProgress({ done: page + 1, total: totalPages });
            }

            pdf.save(`${fileBase}.pdf`);
            toast.success("Class list PDF downloaded");
        } catch (error) {
            console.error("Unable to generate the class list PDF", error);
            toast.error("Failed to generate the PDF");
        } finally {
            if (container.parentNode) container.parentNode.removeChild(container);
            setGeneratingPdf(false);
        }
    };

    /* ── CSV ─────────────────────────────────────────────────────────────── */
    const exportCsv = () => {
        if (!selectedClass) {
            toast.error("Choose a class before exporting");
            return;
        }
        const metadata = [
            ["School", SCHOOL_NAME],
            ["Class", selectedClass.className],
            ["Department", selectedClass.department],
            ["Academic Year", selectedClass.acedemicYear],
            ["Term", selectedTerm],
            ["Subject", ""],
            ["Teacher", ""],
            [],
        ];
        const csv = [...metadata, headers, ...classStudents.map(studentRow)]
            .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
            .join("\n");
        downloadFile(new Blob(["﻿", csv.replace(/\n/g, "\r\n")], { type: "text/csv;charset=utf-8;" }), `${fileBase}.csv`);
        toast.success("Class list exported to CSV");
    };

    /* ── Excel ───────────────────────────────────────────────────────────── */
    const exportExcel = async () => {
        if (!selectedClass) {
            toast.error("Choose a class before exporting");
            return;
        }

        try {
            const { Workbook } = await getExcel();
            const workbook = new Workbook();
            const worksheet = workbook.addWorksheet("Class List", {
                properties: { defaultRowHeight: 22 },
                views: [{ state: "frozen", ySplit: 8 }],
                pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
            });
            const lastColumn = String.fromCharCode(64 + headers.length);
            const blue = "FF155DAA";      // --color-brand
            const blueDark = "FF17324D";  // brand ink

            worksheet.columns = headers.map((_, index) => ({
                width: index === 0 ? 6 : index === 1 ? 20 : index === 2 ? 34 : index === 3 ? 6 : 16,
            }));

            worksheet.mergeCells(`A1:${lastColumn}1`);
            Object.assign(worksheet.getCell("A1"), {
                value: SCHOOL_NAME,
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: blue } },
                font: { bold: true, size: 14, color: { argb: "FFFFFFFF" } },
                alignment: { vertical: "middle", horizontal: "center" },
            });
            worksheet.getRow(1).height = 34;

            worksheet.mergeCells(`A2:${lastColumn}2`);
            Object.assign(worksheet.getCell("A2"), {
                value: `CLASS LIST · ${selectedTerm.toUpperCase()} · ${classLabel(selectedClass)} · ${selectedClass.acedemicYear}`,
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2FB" } },
                font: { bold: true, size: 12, color: { argb: blueDark } },
                alignment: { vertical: "middle", horizontal: "center" },
            });
            worksheet.getRow(2).height = 26;

            worksheet.getCell("A4").value = "SUBJECT:";
            worksheet.getCell("D4").value = "";
            worksheet.getCell("A5").value = "TEACHER:";
            worksheet.getCell("A6").value = "DATE:";
            ["A4", "A5", "A6"].forEach((address) => {
                worksheet.getCell(address).font = { bold: true, color: { argb: blueDark }, size: 10 };
            });
            [4, 5, 6].forEach((rowNumber) => {
                for (let column = 3; column <= headers.length; column++) {
                    worksheet.getRow(rowNumber).getCell(column).border = { bottom: { style: "dotted", color: { argb: "FF555555" } } };
                }
            });

            const headerRow = worksheet.getRow(8);
            headers.forEach((header, index) => { headerRow.getCell(index + 1).value = header; });
            headerRow.height = 28;
            headerRow.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
            });

            const totalRows = Math.max(classStudents.length + 5, ROWS_PER_PAGE);
            for (let index = 0; index < totalRows; index++) {
                const student = classStudents[index];
                const row = worksheet.addRow(student ? studentRow(student, index) : headers.map(() => ""));
                row.height = 22;
                row.eachCell({ includeEmpty: true }, (cell, column) => {
                    cell.alignment = { vertical: "middle", horizontal: column === 3 ? "left" : "center" };
                    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                    if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F8FD" } };
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            downloadFile(
                new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                `${fileBase}.xlsx`,
            );
            toast.success("Class list exported to Excel");
        } catch (error) {
            console.error("Unable to export the class list", error);
            toast.error("Failed to export the Excel class list");
        }
    };

    /* ── UI ──────────────────────────────────────────────────────────────── */
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-[#0B2F5C] via-[#104A87] to-[#155DAA] p-6 text-white shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-white/70">BCHS DOUALA · Academic records</p>
                    <h1 className="text-3xl font-black tracking-tight">Class list</h1>
                    <p className="mt-1 text-sm text-white/80">Printable list for one class, with blank columns for teachers to write marks.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={exportPdf}
                        disabled={!canExport || generatingPdf}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#155DAA] transition hover:bg-[#EAF2FB] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {generatingPdf ? (
                            <div className="size-4 animate-spin rounded-full border-2 border-[#155DAA] border-t-transparent" />
                        ) : (
                            <FileText className="size-4" />
                        )}
                        {generatingPdf
                            ? pdfProgress.total > 1
                                ? `Page ${Math.min(pdfProgress.done + 1, pdfProgress.total)}/${pdfProgress.total}...`
                                : "Generating..."
                            : "Download PDF"}
                    </button>
                    <button
                        onClick={exportExcel}
                        disabled={!canExport}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EAF2FB] px-4 py-2.5 text-sm font-semibold text-[#155DAA] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FileSpreadsheet className="size-4" />
                        Excel
                    </button>
                    <button
                        onClick={exportCsv}
                        disabled={!canExport}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Download className="size-4" />
                        CSV
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Term</span>
                        <FileSpreadsheet className="size-4 text-[#155DAA]" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedTerm}
                            onChange={(event) => setSelectedTerm(event.target.value as TermLabel)}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-[#155DAA]"
                        >
                            {TERMS.map((term) => (
                                <option key={term.label} value={term.label}>{term.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:col-span-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Class</span>
                        <GraduationCap className="size-4 text-[#155DAA]" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-[#155DAA]"
                        >
                            {classes.length === 0 && <option value="">No classes available</option>}
                            {classes.map((schoolClass) => (
                                <option key={schoolClass.id} value={schoolClass.id}>
                                    {classLabel(schoolClass)}{schoolClass.acedemicYear ? ` (${schoolClass.acedemicYear})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Students</div>
                    <div className="mt-2 text-3xl font-black tracking-tight text-[#155DAA]">{classStudents.length}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Boys</div>
                    <div className="mt-2 text-3xl font-black tracking-tight">{boys}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Girls</div>
                    <div className="mt-2 text-3xl font-black tracking-tight">{girls}</div>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#CADCF0] bg-[#EAF2FB] px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Users className="size-5 text-[#155DAA]" />
                        <div>
                            <h2 className="text-lg font-bold text-[#17324D]">Class list preview</h2>
                            <p className="text-sm text-stone-500">
                                {selectedClass ? `${classLabel(selectedClass)} • ${selectedTerm}` : "Choose a class"}
                                {selectedClass && ` • ${totalPages} PDF page${totalPages > 1 ? "s" : ""}`}
                            </p>
                        </div>
                    </div>
                    {refreshing && <span className="text-xs text-stone-500">Updating…</span>}
                </div>

                {loading ? (
                    <div className="p-8 text-sm text-stone-500">Loading classes...</div>
                ) : classDataLoading ? (
                    <div className="p-8 text-sm text-stone-500">Loading the students of this class...</div>
                ) : !selectedClass ? (
                    <div className="p-8 text-sm text-stone-500">No class selected.</div>
                ) : classStudents.length === 0 ? (
                    <div className="p-8 text-sm text-stone-500">
                        No students in this class yet. The PDF will still download as a blank class list.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="bg-[#155DAA] text-white">
                                <tr>
                                    <th className="w-12 px-3 py-3 text-center font-semibold">N°</th>
                                    <th className="px-3 py-3 font-semibold">Matricule</th>
                                    <th className="px-3 py-3 font-semibold">Full name</th>
                                    <th className="px-3 py-3 text-center font-semibold">Sex</th>
                                    {termConfig.sequences.map((sequence) => (
                                        <th key={sequence} className="border-l border-[#CADCF0] px-3 py-3 text-center font-semibold">{sequence} /20</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewRows.map((student, index) => (
                                    <tr key={student.id} className="border-t border-stone-200 even:bg-[#F4F8FD]">
                                        <td className="px-3 py-2.5 text-center font-semibold">{index + 1}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{student.matricule || "—"}</td>
                                        <td className="px-3 py-2.5 font-semibold text-stone-900">{student.fullName}</td>
                                        <td className="px-3 py-2.5 text-center">{sexLabel(student.gender)}</td>
                                        {termConfig.sequences.map((sequence) => (
                                            <td key={sequence} className="border-l border-stone-200 px-3 py-2.5" />
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {classStudents.length > visibleCount && (
                            <div className="border-t border-stone-200 p-4 text-center">
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount((count) => count + PREVIEW_PAGE_SIZE)}
                                    className="rounded-xl border border-[#CADCF0] bg-white px-4 py-2 text-sm font-semibold text-[#155DAA] hover:bg-[#EAF2FB]"
                                >
                                    Show more ({classStudents.length - visibleCount} remaining)
                                </button>
                                <p className="mt-2 text-xs text-stone-400">The PDF, Excel and CSV exports always include every student.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}