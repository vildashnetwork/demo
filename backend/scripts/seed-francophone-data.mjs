import "dotenv/config";
import mongoose from "mongoose";
import SchoolClass from "../models/SchoolClass.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import Student from "../models/Students.js";
import SchoolSettings from "../models/SchoolSettings.js";
import StudentAttendance from "../models/StudentAttendance.js";
import TeacherAttendance from "../models/TeacherAttendance.js";
import TeacherSalary from "../models/TeacherSalary.js";
import Mark from "../models/Mark.js";
import Timetable from "../models/Timetable.js";
import { srvToStandardUri } from "../db/dbManager.js";

const SECTION = "francophone";
const ACADEMIC_YEAR = "2025-2026";
const schoolDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const classSeed = [
    { className: "6ème", department: "General", cycle: "1st Cycle", tuitionFee: 150000 },
    { className: "5ème", department: "General", cycle: "1st Cycle", tuitionFee: 160000 },
    { className: "4ème", department: "General", cycle: "1st Cycle", tuitionFee: 170000 },
    { className: "3ème", department: "General", cycle: "1st Cycle", tuitionFee: 180000 },
    { className: "Seconde", department: "Arts", cycle: "2nd Cycle", tuitionFee: 210000 },
    { className: "Seconde", department: "Science", cycle: "2nd Cycle", tuitionFee: 220000 },
    { className: "Première", department: "Arts", cycle: "2nd Cycle", tuitionFee: 230000 },
    { className: "Première", department: "Science", cycle: "2nd Cycle", tuitionFee: 240000 },
    { className: "Terminale", department: "Arts", cycle: "2nd Cycle", tuitionFee: 250000 },
    { className: "Terminale", department: "Science", cycle: "2nd Cycle", tuitionFee: 260000 },
].map((schoolClass) => ({
    ...schoolClass,
    section: "A",
    tuitionInstallments: 3,
    registrationFeeRequired: true,
    registrationFeeAmount: 25000,
}));

const classKey = (className, department) => `${className}|${department}`;
const allClassKeys = classSeed.map(({ className, department }) => classKey(className, department));
const artsClassKeys = allClassKeys.filter((key) => key.endsWith("|Arts"));
const scienceClassKeys = allClassKeys.filter((key) => key.endsWith("|Science"));

const subjectSeed = [
    { name: "Français", code: "FR-FRA", coefficient: 4, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 5 },
    { name: "Anglais", code: "FR-ENG", coefficient: 3, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 4 },
    { name: "Mathématiques", code: "FR-MTH", coefficient: 5, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 5 },
    { name: "Éducation à la citoyenneté", code: "FR-CIV", coefficient: 2, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 2 },
    { name: "Informatique", code: "FR-ICT", coefficient: 3, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 2 },
    { name: "Histoire", code: "FR-HIS", coefficient: 3, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 3 },
    { name: "Géographie", code: "FR-GEO", coefficient: 3, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 3 },
    { name: "Sciences de la vie et de la terre", code: "FR-SVT", coefficient: 4, cycle: "1st Cycle", classKeys: allClassKeys, periodsPerWeek: 4 },
    { name: "Physique", code: "FR-PHY", coefficient: 4, cycle: "2nd Cycle", classKeys: [...artsClassKeys, ...scienceClassKeys], periodsPerWeek: 4 },
    { name: "Chimie", code: "FR-CHE", coefficient: 4, cycle: "2nd Cycle", classKeys: scienceClassKeys, periodsPerWeek: 4 },
    { name: "Philosophie", code: "FR-PHI", coefficient: 4, cycle: "2nd Cycle", classKeys: artsClassKeys, periodsPerWeek: 4 },
    { name: "Économie", code: "FR-ECO", coefficient: 3, cycle: "2nd Cycle", classKeys: artsClassKeys, periodsPerWeek: 3 },
    { name: "Littérature française", code: "FR-LIT", coefficient: 4, cycle: "2nd Cycle", classKeys: artsClassKeys, periodsPerWeek: 4 },
    { name: "Biologie", code: "FR-BIO", coefficient: 4, cycle: "2nd Cycle", classKeys: scienceClassKeys, periodsPerWeek: 4 },
];

const teacherSeed = [
    { name: "Clarisse Mbarga", username: "mock_fr_teacher01", phone: "+237691100001", qualification: "Licence en lettres modernes", monthlySalary: 185000, subjectCodes: ["FR-FRA", "FR-LIT"] },
    { name: "Jean-Paul Nguema", username: "mock_fr_teacher02", phone: "+237691100002", qualification: "Master en mathématiques", monthlySalary: 195000, subjectCodes: ["FR-MTH", "FR-PHY"] },
    { name: "Solange Tchoumi", username: "mock_fr_teacher03", phone: "+237691100003", qualification: "Licence en sciences de la vie", monthlySalary: 190000, subjectCodes: ["FR-SVT", "FR-BIO"] },
    { name: "Patrick Ewane", username: "mock_fr_teacher04", phone: "+237691100004", qualification: "Master en histoire", monthlySalary: 180000, subjectCodes: ["FR-HIS", "FR-GEO"] },
    { name: "Nathalie Fopa", username: "mock_fr_teacher05", phone: "+237691100005", qualification: "Licence en philosophie", monthlySalary: 178000, subjectCodes: ["FR-PHI", "FR-ECO"] },
    { name: "Armand Kouam", username: "mock_fr_teacher06", phone: "+237691100006", qualification: "Licence en anglais", monthlySalary: 175000, subjectCodes: ["FR-ENG", "FR-CIV"] },
    { name: "Martine Biloa", username: "mock_fr_teacher07", phone: "+237691100007", qualification: "Licence en informatique", monthlySalary: 182000, subjectCodes: ["FR-ICT", "FR-CHE"] },
];

const firstNames = ["Ariane", "Brice", "Carine", "Dany", "Estelle", "Fabrice", "Gaëlle", "Hugo", "Inès", "Junior", "Laure", "Marius"];
const lastNames = ["Abena", "Biloa", "Djoum", "Essomba", "Fokam", "Kengne", "Manga", "Nana", "Tchana", "Yombi"];
const studentSeed = classSeed.flatMap((schoolClass, classIndex) =>
    Array.from({ length: 8 }, (_, studentInClass) => {
        const index = classIndex * 8 + studentInClass;
        const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
        const tuitionFeePaid = Math.round(schoolClass.tuitionFee * [0.4, 0.65, 0.85, 1][studentInClass % 4]);
        const registrationFeePaid = schoolClass.registrationFeeAmount;
        return {
            fullName: `${firstNames[index % firstNames.length]} ${lastName} ${String(index + 1).padStart(3, "0")}`,
            gender: index % 2 === 0 ? "female" : "male",
            dob: `${2007 + (index % 6)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`,
            className: schoolClass.className,
            department: schoolClass.department,
            parentName: `Parent ${lastName}`,
            parentPhone: `+23767${String(2000000 + index).slice(-7)}`,
            address: ["Bonabéri, Douala", "Akwa, Douala", "Bépanda, Douala", "Bonamoussadi, Douala"][index % 4],
            registrationDate: `2025-09-${String((index % 27) + 1).padStart(2, "0")}`,
            tuitionFee: schoolClass.tuitionFee,
            tuitionInstallments: schoolClass.tuitionInstallments,
            tuitionFeePaid,
            tuitionInstallmentsPaid: Math.max(1, Math.round((tuitionFeePaid / schoolClass.tuitionFee) * schoolClass.tuitionInstallments)),
            feesPaid: tuitionFeePaid + registrationFeePaid,
            feesDue: schoolClass.tuitionFee - tuitionFeePaid,
            registrationFeeRequired: true,
            registrationFeeAmount: schoolClass.registrationFeeAmount,
            registrationFeePaid,
        };
    })
);

const attendanceDates = [
    new Date("2025-09-08T00:00:00.000Z"), new Date("2025-09-09T00:00:00.000Z"), new Date("2025-09-10T00:00:00.000Z"),
    new Date("2026-01-12T00:00:00.000Z"), new Date("2026-01-13T00:00:00.000Z"), new Date("2026-01-14T00:00:00.000Z"),
    new Date("2026-05-04T00:00:00.000Z"), new Date("2026-05-05T00:00:00.000Z"), new Date("2026-05-06T00:00:00.000Z"),
];
const attendanceStatuses = ["present", "present", "late", "present", "absent", "present", "excused", "present", "late"];
const sequences = ["1st seq", "2nd seq", "3rd seq", "4th seq", "5th seq", "6th seq"];
const times = ["08:00", "09:00", "10:45", "11:45", "13:00", "14:00"];

const getSectionKey = (name, department) => `${name}|${department}`;

async function seedFrancophoneData() {
    const connectionUri = process.env.SEED_DB === "offline" ? process.env.MONGOURIOFFLINE : process.env.MONGOURI;
    if (!connectionUri) throw new Error(`Mongo URI for SEED_DB=${process.env.SEED_DB === "offline" ? "offline" : "online"} is not configured.`);
    const mongoUri = process.env.SEED_DB === "offline" || !connectionUri.startsWith("mongodb+srv://")
        ? connectionUri
        : await srvToStandardUri(connectionUri);

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, socketTimeoutMS: 120000, maxPoolSize: 5 });
    console.log(`Connected to configured ${process.env.SEED_DB === "offline" ? "offline" : "online"} database.`);

    try {
        const classIds = new Map();
        const subjectIds = new Map();
        const teacherDocs = new Map();

        for (const schoolClass of classSeed) {
            const classDoc = await SchoolClass.findOneAndUpdate(
                { className: schoolClass.className, department: schoolClass.department, acedemicYear: ACADEMIC_YEAR, schoolSection: SECTION },
                { $set: { ...schoolClass, schoolSection: SECTION, acedemicYear: ACADEMIC_YEAR, isActive: true, studentCount: 0, maxStudents: 45, classMasterId: "" } },
                { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
            );
            classIds.set(getSectionKey(schoolClass.className, schoolClass.department), classDoc._id.toString());
        }

        for (const subject of subjectSeed) {
            const subjectDoc = await Subject.findOneAndUpdate(
                { code: subject.code, section: SECTION },
                {
                    $set: {
                        name: subject.name,
                        code: subject.code,
                        coefficient: subject.coefficient,
                        cycle: subject.cycle,
                        section: SECTION,
                        classIds: subject.classKeys.map((key) => classIds.get(key)).filter(Boolean),
                        teacherIds: [],
                        periodsPerWeek: subject.periodsPerWeek,
                        periodsByClass: {},
                    }
                },
                { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
            );
            subjectIds.set(subject.code, subjectDoc._id.toString());
        }

        const settingsIndexes = await SchoolSettings.collection.indexes();
        const legacyYearIndex = settingsIndexes.find((index) =>
            index.name === "academicYear_1"
            && index.unique
            && index.key?.academicYear === 1
            && Object.keys(index.key).length === 1
        );
        if (legacyYearIndex) {
            await SchoolSettings.collection.dropIndex(legacyYearIndex.name);
            console.log("Removed obsolete academic-year-only settings index.");
        }

        await SchoolSettings.findOneAndUpdate(
            { academicYear: ACADEMIC_YEAR, section: SECTION },
            {
                $set: {
                    schoolStartTime: "07:30",
                    schoolEndTime: "15:30",
                    breakStart: "10:00",
                    breakEnd: "10:30",
                    periodDurationMinutes: 45,
                    schoolDays,
                    academicYear: ACADEMIC_YEAR,
                    section: SECTION,
                    periodsPerDay: 6,
                    teacherPaymentMode: "hourly",
                }
            },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );

        for (const teacher of teacherSeed) {
            const assignedClassIds = [...new Set(teacher.subjectCodes.flatMap((code) =>
                subjectSeed.find((subject) => subject.code === code)?.classKeys ?? []
            ).map((key) => classIds.get(key)).filter(Boolean))];
            const teacherDoc = await User.findOneAndUpdate(
                { username: teacher.username },
                {
                    $set: {
                        name: teacher.name,
                        username: teacher.username,
                        phone: teacher.phone,
                        role: "teacher",
                        section: SECTION,
                        qualification: teacher.qualification,
                        subjectIds: teacher.subjectCodes.map((code) => subjectIds.get(code)).filter(Boolean),
                        classIds: assignedClassIds,
                        isPermanent: true,
                        monthlySalary: teacher.monthlySalary,
                        availableDays: schoolDays,
                        acedemicYear: ACADEMIC_YEAR,
                        isActive: true,
                    }
                },
                { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
            );
            teacherDocs.set(teacher.username, teacherDoc);
        }

        for (const subject of subjectSeed) {
            const assignedTeachers = teacherSeed
                .filter((teacher) => teacher.subjectCodes.includes(subject.code))
                .map((teacher) => teacherDocs.get(teacher.username)?._id.toString())
                .filter(Boolean);
            await Subject.updateOne({ code: subject.code, section: SECTION }, { $set: { teacherIds: assignedTeachers } });
        }

        const students = [];
        for (const [index, student] of studentSeed.entries()) {
            const studentMatricule = `MOCKFR-2025-${String(index + 1).padStart(4, "0")}`;
            const studentDoc = await Student.findOneAndUpdate(
                { matricule: studentMatricule },
                {
                    $set: {
                        ...student,
                        matricule: studentMatricule,
                        enrollmentYear: 2025,
                        section: SECTION,
                        classId: classIds.get(getSectionKey(student.className, student.department)),
                        photoUrl: "",
                        feePayments: [
                            { feeType: "tuition", amount: Math.max(student.tuitionFeePaid, 1), installmentNumber: 1, paidAt: new Date("2025-09-08"), recordedBy: "francophone-demo-seed" },
                            { feeType: "registration", amount: student.registrationFeePaid, installmentNumber: 1, paidAt: new Date("2025-09-08"), recordedBy: "francophone-demo-seed" },
                        ],
                    }
                },
                { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
            );
            students.push(studentDoc);
        }

        for (const [classId, studentCount] of await Student.aggregate([
            { $match: { section: SECTION, classId: { $in: [...classIds.values()] } } },
            { $group: { _id: "$classId", count: { $sum: 1 } } },
        ]).then((rows) => rows.map((row) => [row._id, row.count]))) {
            await SchoolClass.updateOne({ _id: classId, schoolSection: SECTION }, { $set: { studentCount } });
        }

        const studentAttendanceOps = students.flatMap((student, studentIndex) => attendanceDates.map((date, dateIndex) => ({
            updateOne: {
                filter: { studentId: student._id.toString(), date, period: "day" },
                update: {
                    $set: {
                        studentId: student._id.toString(),
                        classId: student.classId,
                        date,
                        period: "day",
                        status: attendanceStatuses[(studentIndex + dateIndex) % attendanceStatuses.length],
                        academicYear: ACADEMIC_YEAR,
                        term: dateIndex < 3 ? "first" : dateIndex < 6 ? "second" : "third",
                        section: SECTION,
                        recordedBy: "francophone-demo-seed",
                        notes: "Présence de démonstration",
                    }
                },
                upsert: true,
            },
        })));
        for (let offset = 0; offset < studentAttendanceOps.length; offset += 500) {
            await StudentAttendance.bulkWrite(studentAttendanceOps.slice(offset, offset + 500), { ordered: false });
        }

        for (const [teacherIndex, teacher] of [...teacherDocs.values()].entries()) {
            for (const [dateIndex, date] of attendanceDates.entries()) {
                const status = attendanceStatuses[(teacherIndex + dateIndex) % attendanceStatuses.length];
                await TeacherAttendance.findOneAndUpdate(
                    { teacherId: teacher._id, date },
                    {
                        $set: {
                            teacherId: teacher._id,
                            date,
                            section: SECTION,
                            checkIn: status === "absent" ? undefined : status === "late" ? "08:12" : "07:40",
                            checkOut: status === "absent" ? undefined : "15:30",
                            status,
                            hoursWorked: status === "absent" ? 0 : 7.5,
                            periodsTaught: status === "absent" ? 0 : 6,
                            notes: "Présence de démonstration",
                            academicYear: ACADEMIC_YEAR,
                            term: dateIndex < 3 ? "first" : dateIndex < 6 ? "second" : "third",
                        }
                    },
                    { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
                );
            }
        }

        const marks = [];
        for (const [studentIndex, student] of students.entries()) {
            const studentClassKey = getSectionKey(studentSeed[studentIndex].className, studentSeed[studentIndex].department);
            for (const subject of subjectSeed.filter((item) => item.classKeys.includes(studentClassKey))) {
                const subjectId = subjectIds.get(subject.code);
                const teacherSeedItem = teacherSeed.find((teacher) => teacher.subjectCodes.includes(subject.code));
                const recordedBy = teacherDocs.get(teacherSeedItem?.username)?._id.toString();
                if (!subjectId || !recordedBy) continue;
                for (const [sequenceIndex, sequence] of sequences.entries()) {
                    const score = 9 + ((studentIndex * 7 + sequenceIndex * 3 + subject.code.length) % 12);
                    marks.push({
                        updateOne: {
                            filter: { studentId: student._id.toString(), subjectId, classId: student.classId, sequence, academicyear: ACADEMIC_YEAR, section: SECTION },
                            update: {
                                $set: {
                                    studentId: student._id.toString(),
                                    subjectId,
                                    classId: student.classId,
                                    sequence,
                                    academicyear: ACADEMIC_YEAR,
                                    score,
                                    recordedBy,
                                    section: SECTION,
                                }
                            },
                            upsert: true,
                        },
                    });
                }
            }
        }
        for (let offset = 0; offset < marks.length; offset += 500) {
            await Mark.bulkWrite(marks.slice(offset, offset + 500), { ordered: false });
        }

        for (const [index, subject] of subjectSeed.entries()) {
            const teacherData = teacherSeed.find((teacher) => teacher.subjectCodes.includes(subject.code));
            const teacher = teacherDocs.get(teacherData?.username);
            const targetKey = subject.classKeys[0];
            const [className, department] = targetKey.split("|");
            const classId = classIds.get(targetKey);
            const subjectId = subjectIds.get(subject.code);
            if (!teacher || !classId || !subjectId) continue;
            const day = schoolDays[index % schoolDays.length];
            const startTime = times[index % times.length];
            const endTime = startTime.endsWith(":00") ? `${startTime.slice(0, 2)}:45` : `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:30`;
            await Timetable.findOneAndUpdate(
                { teacherId: teacher._id, classId, subjectId, day, startTime, academicYear: ACADEMIC_YEAR, section: SECTION },
                {
                    $set: {
                        teacherId: teacher._id,
                        classId,
                        subjectId,
                        day,
                        startTime,
                        endTime,
                        periodNumber: (index % 6) + 1,
                        cycle: subject.cycle === "1st Cycle" ? "first" : "second",
                        ratePerPeriod: subject.cycle === "1st Cycle" ? 500 : 700,
                        room: `Salle ${101 + index}`,
                        academicYear: ACADEMIC_YEAR,
                        section: SECTION,
                        isActive: true,
                    }
                },
                { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
            );
        }

        for (const [teacherIndex, teacher] of [...teacherDocs.values()].entries()) {
            for (const [monthIndex, item] of [
                { month: "September", year: "2025", term: "first" },
                { month: "January", year: "2026", term: "second" },
                { month: "May", year: "2026", term: "third" },
            ].entries()) {
                const firstCycle = 14 + ((teacherIndex + monthIndex) % 8);
                const secondCycle = 8 + ((teacherIndex * 2 + monthIndex) % 6);
                const grossSalary = firstCycle * 500 + secondCycle * 700;
                await TeacherSalary.findOneAndUpdate(
                    { teacherId: teacher._id, month: item.month, year: item.year },
                    {
                        $set: {
                            teacherId: teacher._id,
                            section: SECTION,
                            month: item.month,
                            year: item.year,
                            periodCounts: { firstCycle, secondCycle, total: firstCycle + secondCycle },
                            rates: { firstCycle: 500, secondCycle: 700 },
                            paymentMode: "hourly",
                            monthlyAmount: teacher.monthlySalary,
                            classBreakdown: [],
                            grossSalary,
                            deductions: { total: 0, details: [] },
                            netSalary: grossSalary,
                            attendance: { present: 20, absent: 0, late: 0, excused: 0 },
                            status: "pending",
                            academicYear: ACADEMIC_YEAR,
                            term: item.term,
                        }
                    },
                    { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
                );
            }
        }

        console.log("Francophone demo records posted:", {
            classes: await SchoolClass.countDocuments({ schoolSection: SECTION, acedemicYear: ACADEMIC_YEAR }),
            subjects: await Subject.countDocuments({ section: SECTION }),
            teachers: await User.countDocuments({ section: SECTION, role: "teacher" }),
            students: await Student.countDocuments({ section: SECTION }),
            studentAttendance: await StudentAttendance.countDocuments({ section: SECTION, academicYear: ACADEMIC_YEAR }),
            teacherAttendance: await TeacherAttendance.countDocuments({ section: SECTION, academicYear: ACADEMIC_YEAR }),
            marks: await Mark.countDocuments({ section: SECTION, academicyear: ACADEMIC_YEAR }),
            timetables: await Timetable.countDocuments({ section: SECTION, academicYear: ACADEMIC_YEAR }),
            salaries: await TeacherSalary.countDocuments({ section: SECTION, academicYear: ACADEMIC_YEAR }),
            settings: await SchoolSettings.countDocuments({ section: SECTION, academicYear: ACADEMIC_YEAR }),
        });
    } finally {
        await mongoose.disconnect();
    }
}

seedFrancophoneData().catch((error) => {
    console.error("Unable to seed Francophone demo records:", error);
    process.exitCode = 1;
});