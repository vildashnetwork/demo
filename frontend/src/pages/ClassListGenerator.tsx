import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, GraduationCap, Users } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

interface Student {
    id: string;
    fullName: string;
    gender: string;
    dob: string;
    classId: string;
    department: string;
    parentName: string;
    parentPhone: string;
    address: string;
    registrationDate: string;
}

interface SchoolClass {
    id: string;
    className: string;
    department: string;
    cycle: string;
    acedemicYear: string;
    tuitionFee: number;
    tuitionInstallments: number;
    registrationFeeRequired: boolean;
    registrationFeeAmount: number;
}

const TERMS = ["First Term", "Second Term", "Third Term"] as const;

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

export function ClassListGeneratorPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedTerm, setSelectedTerm] = useState<(typeof TERMS)[number]>("First Term");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [studentsRes, classesRes] = await Promise.all([
                    axios.get(`${API_BASE}/students`),
                    axios.get(`${API_BASE}/classes`),
                ]);

                if (studentsRes.data.success) {
                    const mappedStudents = studentsRes.data.data.map((student: any) => ({
                        ...student,
                        id: student._id || student.id,
                    }));
                    setStudents(mappedStudents);
                }

                if (classesRes.data.success) {
                    const mappedClasses = classesRes.data.data.map((schoolClass: any) => ({
                        ...schoolClass,
                        id: schoolClass._id || schoolClass.id,
                        tuitionFee: Number(schoolClass.tuitionFee) || 0,
                        tuitionInstallments: Number(schoolClass.tuitionInstallments) || 1,
                        registrationFeeRequired: Boolean(schoolClass.registrationFeeRequired),
                        registrationFeeAmount: Number(schoolClass.registrationFeeAmount) || 0,
                    }));
                    setClasses(mappedClasses);
                    setSelectedClassId((current) => current || mappedClasses[0]?.id || "");
                }
            } catch (error: any) {
                console.error("Unable to load class list data", error);
                toast.error(error.response?.data?.message || "Failed to load class list data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);
    const selectedClass = useMemo(
        () => classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? null,
        [classes, selectedClassId],
    );

    const classStudents = useMemo(
        () => students.filter((student) => student.classId === selectedClassId),
        [students, selectedClassId],
    );

    const totalBoys = classStudents.filter((student) => student.gender?.toLowerCase() === "male").length;
    const totalGirls = classStudents.filter((student) => student.gender?.toLowerCase() === "female").length;

    const exportCsv = () => {
        if (!selectedClass) {
            toast.error("Choose a class before exporting");
            return;
        }

        if (classStudents.length === 0) {
            toast.error("There are no students in this class to export");
            return;
        }

        const headers = [
            "Term",
            "Class",
            "Student Name",
            "Gender",
            "Date of Birth",
            "Parent Name",
            "Parent Phone",
            "Address",
            "Registration Date",
        ];

        const rows = classStudents.map((student) => [
            selectedTerm,
            selectedClass.className,
            student.fullName,
            student.gender,
            student.dob,
            student.parentName,
            student.parentPhone,
            student.address,
            student.registrationDate,
        ]);

        const csv = [headers, ...rows]
            .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${slugify(selectedTerm)}-${slugify(selectedClass.className)}-class-list.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Class list exported to CSV");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-3xl border border-stone-200 bg-gradient-to-br from-[#121212] via-[#1b1b1b] to-[#2a2a2a] p-6 text-white shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-white/60">Students roster</p>
                    <h1 className="text-3xl font-black tracking-tight">Generate class list by term</h1>
                </div>
                <button
                    onClick={exportCsv}
                    disabled={loading || !selectedClass || classStudents.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#121212] transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Download className="size-4" />
                    Export CSV
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Selected term</span>
                        <FileSpreadsheet className="size-4 text-brand" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedTerm}
                            onChange={(event) => setSelectedTerm(event.target.value as (typeof TERMS)[number])}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"
                        >
                            {TERMS.map((term) => (
                                <option key={term} value={term}>{term}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:col-span-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Class</span>
                        <GraduationCap className="size-4 text-brand" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"
                        >
                            {classes.length === 0 && <option value="">No classes available</option>}
                            {classes.map((schoolClass) => (
                                <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.className}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Total students</div>
                    <div className="mt-3 text-3xl font-black tracking-tight">{classStudents.length}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Boys</div>
                    <div className="mt-3 text-3xl font-black tracking-tight text-blue-700">{totalBoys}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Girls</div>
                    <div className="mt-3 text-3xl font-black tracking-tight text-pink-700">{totalGirls}</div>
                </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Users className="size-5 text-brand" />
                        <div>
                            <h2 className="text-lg font-bold">Preview</h2>
                            <p className="text-sm text-stone-500">{selectedClass ? `${selectedClass.className} • ${selectedTerm}` : "Choose a class"}</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-sm text-stone-500">Loading roster...</div>
                ) : !selectedClass ? (
                    <div className="p-8 text-sm text-stone-500">No class selected.</div>
                ) : classStudents.length === 0 ? (
                    <div className="p-8 text-sm text-stone-500">No students available for this class.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-stone-50 text-stone-700">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Student</th>
                                    <th className="px-4 py-3 font-semibold">Gender</th>
                                    <th className="px-4 py-3 font-semibold">DOB</th>
                                    <th className="px-4 py-3 font-semibold">Parent</th>
                                    <th className="px-4 py-3 font-semibold">Phone</th>
                                    <th className="px-4 py-3 font-semibold">Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classStudents.map((student) => (
                                    <tr key={student.id} className="border-t border-stone-200">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-stone-900">{student.fullName}</div>
                                        </td>
                                        <td className="px-4 py-3">{student.gender || "—"}</td>
                                        <td className="px-4 py-3">{student.dob || "—"}</td>
                                        <td className="px-4 py-3">{student.parentName || "—"}</td>
                                        <td className="px-4 py-3">{student.parentPhone || "—"}</td>
                                        <td className="px-4 py-3">{student.address || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
