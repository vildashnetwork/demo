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

const ACADEMIC_YEAR = "2025-2026";
const SECTION = "englophone";

const classSeed = [
    { className: "Form 1", department: "General", cycle: "1st Cycle", section: "A", tuitionFee: 180000, tuitionInstallments: 3, registrationFeeRequired: true, registrationFeeAmount: 25000 },
    { className: "Form 2", department: "General", cycle: "1st Cycle", section: "A", tuitionFee: 190000, tuitionInstallments: 3, registrationFeeRequired: true, registrationFeeAmount: 25000 },
    { className: "Form 3", department: "Arts", cycle: "1st Cycle", section: "A", tuitionFee: 210000, tuitionInstallments: 3, registrationFeeRequired: true, registrationFeeAmount: 30000 },
    { className: "Form 3", department: "Science", cycle: "1st Cycle", section: "A", tuitionFee: 220000, tuitionInstallments: 3, registrationFeeRequired: true, registrationFeeAmount: 30000 },
    { className: "Form 4", department: "Arts", cycle: "1st Cycle", section: "A", tuitionFee: 220000, tuitionInstallments: 3, registrationFeeRequired: true, registrationFeeAmount: 30000 },
    { className: "Form 4", department: "Science", cycle: "1st Cycle", section: "A", tuitionFee: 240000, tuitionInstallments: 3, registrationFeeRequired: true, registrationFeeAmount: 30000 },
    { className: "Form 5", department: "Arts", cycle: "1st Cycle", section: "A", tuitionFee: 240000, tuitionInstallments: 4, registrationFeeRequired: true, registrationFeeAmount: 35000 },
    { className: "Form 5", department: "Science", cycle: "1st Cycle", section: "A", tuitionFee: 260000, tuitionInstallments: 4, registrationFeeRequired: true, registrationFeeAmount: 35000 },
    { className: "Lower 6th", department: "Arts", cycle: "2nd Cycle", section: "A", tuitionFee: 320000, tuitionInstallments: 4, registrationFeeRequired: true, registrationFeeAmount: 40000 },
    { className: "Lower 6th", department: "Science", cycle: "2nd Cycle", section: "A", tuitionFee: 340000, tuitionInstallments: 4, registrationFeeRequired: true, registrationFeeAmount: 40000 },
    { className: "Upper 6th", department: "Arts", cycle: "2nd Cycle", section: "A", tuitionFee: 340000, tuitionInstallments: 4, registrationFeeRequired: true, registrationFeeAmount: 45000 },
    { className: "Upper 6th", department: "Science", cycle: "2nd Cycle", section: "A", tuitionFee: 360000, tuitionInstallments: 4, registrationFeeRequired: true, registrationFeeAmount: 45000 },
];

const firstCycleLevels = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "6ème", "5ème", "4ème", "3ème"];
const secondCycleLevels = ["Lower 6th", "Upper 6th", "Seconde", "Première", "Terminale"];
const industrialDepartments = [
    "Electrical & Electronics",
    "Civil Engineering & Woodwork",
    "Mechanical",
    "Home Economics & Social",
];
const commercialDepartments = [
    "Accounting",
    "Marketing & Sales",
    "Secretarial Administration & Communication",
    "Home Economics & Social Care",
];
const vocationalDepartments = [...industrialDepartments, ...commercialDepartments];
const firstCycleVocationalDepartments = [
    ...vocationalDepartments,
    "General",
    "Science",
    "Arts",
    "Commercial",
];
const firstCycleIndustrialDepartments = [
    ...industrialDepartments,
    "General",
    "Science",
    "Arts",
];
const firstCycleLevelsByTrack = {
    "Electrical & Electronics": firstCycleLevels,
    "Civil Engineering & Woodwork": firstCycleLevels,
    Mechanical: firstCycleLevels,
    "Home Economics & Social": firstCycleLevels,
    Accounting: firstCycleLevels,
    "Marketing & Sales": ["Form 3", "Form 4", "Form 5", "4ème", "3ème"],
    "Secretarial Administration & Communication": firstCycleLevels,
    "Home Economics & Social Care": firstCycleLevels,
};
const secondCycleLevelsByTrack = Object.fromEntries(
    vocationalDepartments.map((department) => [department, secondCycleLevels])
);

for (const [department, classNames] of Object.entries(firstCycleLevelsByTrack)) {
    for (const className of classNames) {
        classSeed.push({
            className,
            department,
            cycle: "1st Cycle",
            section: "A",
            tuitionFee: 230000,
            tuitionInstallments: 3,
            registrationFeeRequired: true,
            registrationFeeAmount: 30000,
        });
    }
}

for (const [department, classNames] of Object.entries(secondCycleLevelsByTrack)) {
    for (const className of classNames) {
        classSeed.push({
            className,
            department,
            cycle: "2nd Cycle",
            section: "A",
            tuitionFee: 320000,
            tuitionInstallments: 4,
            registrationFeeRequired: true,
            registrationFeeAmount: 40000,
        });
    }
}

const subjectSeed = [
    { name: "English Language", code: "ENG", coefficient: 4, cycle: "1st Cycle", classNames: firstCycleLevels, departments: firstCycleVocationalDepartments, periodsPerWeek: 5 },
    { name: "French Language", code: "FRE", coefficient: 3, cycle: "1st Cycle", classNames: firstCycleLevels, departments: firstCycleVocationalDepartments, periodsPerWeek: 4 },
    { name: "Mathematics", code: "MTH", coefficient: 5, cycle: "1st Cycle", classNames: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5"], departments: ["General", "Arts", "Science"], periodsPerWeek: 5 },
    { name: "Citizenship Education", code: "CIV", coefficient: 2, cycle: "1st Cycle", classNames: firstCycleLevels, departments: firstCycleVocationalDepartments, periodsPerWeek: 2 },
    { name: "Information and Communication Technology", code: "ICT", coefficient: 3, cycle: "1st Cycle", classNames: firstCycleLevels, departments: ["General", "Arts", "Science", ...commercialDepartments], periodsPerWeek: 3 },
    { name: "Literature in English", code: "LIT", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "History", code: "HIS", coefficient: 4, cycle: "1st Cycle", classNames: firstCycleLevels, departments: firstCycleIndustrialDepartments, periodsPerWeek: 4 },
    { name: "Geography", code: "GEO", coefficient: 4, cycle: "1st Cycle", classNames: firstCycleLevels, departments: firstCycleIndustrialDepartments, periodsPerWeek: 4 },
    { name: "Economics", code: "ECO", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "Commerce", code: "COM", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "Logic", code: "LOG", coefficient: 2, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 2 },
    { name: "Religious Studies", code: "REL", coefficient: 3, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 3 },
    { name: "Biology", code: "BIO", coefficient: 5, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Chemistry", code: "CHE", coefficient: 5, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Physics", code: "PHY", coefficient: 5, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Geology", code: "GOL", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Science"], periodsPerWeek: 4 },
    { name: "Additional Mathematics", code: "ADM", coefficient: 5, cycle: "1st Cycle", classNames: ["Form 4", "Form 5"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Home Economics", code: "HEC", coefficient: 3, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Science"], periodsPerWeek: 3 },
    { name: "Communication Skills", code: "CSK", coefficient: 3, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts", "Science"], periodsPerWeek: 3 },
    { name: "English Literature", code: "ENL", coefficient: 5, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts"], periodsPerWeek: 5 },
    { name: "French", code: "FRE6", coefficient: 4, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "History", code: "HIS6", coefficient: 4, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "Geography", code: "GEO6", coefficient: 4, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "Economics", code: "ECO6", coefficient: 4, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "Philosophy", code: "PHI", coefficient: 4, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "Religious Studies", code: "REL6", coefficient: 3, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Arts"], periodsPerWeek: 3 },
    { name: "Pure Mathematics", code: "PMA", coefficient: 5, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Further Mathematics", code: "FMA", coefficient: 5, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Physics", code: "PHY6", coefficient: 5, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Chemistry", code: "CHE6", coefficient: 5, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Biology", code: "BIO6", coefficient: 5, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Science"], periodsPerWeek: 5 },
    { name: "Geology", code: "GOL6", coefficient: 4, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Science"], periodsPerWeek: 4 },
    { name: "Computer Science", code: "CSC", coefficient: 4, cycle: "2nd Cycle", classNames: ["Lower 6th", "Upper 6th"], departments: ["Science"], periodsPerWeek: 4 },
];

function addVocationalSubject(name, code, coefficient, departments, classNames, periodsPerWeek) {
    const cycleGroups = [
        { cycle: "1st Cycle", code, levels: firstCycleLevels },
        { cycle: "2nd Cycle", code: `${code}2`, levels: secondCycleLevels },
    ];

    for (const group of cycleGroups) {
        const cycleClassNames = classNames.filter((className) => group.levels.includes(className));
        if (cycleClassNames.length === 0) continue;
        subjectSeed.push({
            name,
            code: group.code,
            coefficient,
            cycle: group.cycle,
            classNames: cycleClassNames,
            departments,
            periodsPerWeek,
        });
    }
}

const allVocationalLevels = [...firstCycleLevels, ...secondCycleLevels];
const allIndustrialLevels = [...firstCycleLevels, ...secondCycleLevels];
const allCommercialLevels = [...firstCycleLevels, ...secondCycleLevels];

addVocationalSubject("English Language", "ENGT", 4, vocationalDepartments, secondCycleLevels, 5);
addVocationalSubject("French Language", "FRET", 3, vocationalDepartments, secondCycleLevels, 4);
addVocationalSubject("Citizenship Education", "CIVT", 2, vocationalDepartments, secondCycleLevels, 2);
addVocationalSubject("History", "HIST", 3, industrialDepartments, secondCycleLevels, 3);
addVocationalSubject("Geography", "GEOT", 3, industrialDepartments, secondCycleLevels, 3);
addVocationalSubject("Information and Communication Technology", "ICTT", 3, commercialDepartments, secondCycleLevels, 3);

addVocationalSubject("Industrial Mathematics", "IMT", 5, industrialDepartments, allIndustrialLevels, 5);
addVocationalSubject("Engineering Science", "ENS", 5, industrialDepartments, allIndustrialLevels, 5);
addVocationalSubject("Technical Drawing / Engineering Drawing", "TDR", 4, industrialDepartments, allIndustrialLevels, 4);
addVocationalSubject("Trade and Training / Workshop Safety", "TWS", 3, industrialDepartments, allIndustrialLevels, 3);
addVocationalSubject("Industrial Internship / Practicals", "IIP", 5, industrialDepartments, allIndustrialLevels, 5);

addVocationalSubject("Electrical Technology and Diagrams", "ETD", 5, ["Electrical & Electronics"], allIndustrialLevels, 5);
addVocationalSubject("Circuit Automation & Electromechanical Systems", "CAE", 5, ["Electrical & Electronics"], allIndustrialLevels, 5);
addVocationalSubject("Digital and Analogue Electronics", "DAE", 5, ["Electrical & Electronics"], allIndustrialLevels, 5);
addVocationalSubject("Electrical Installation Practice", "EIP", 5, ["Electrical & Electronics"], allIndustrialLevels, 5);

addVocationalSubject("Building Construction Technology", "BCT", 5, ["Civil Engineering & Woodwork"], allIndustrialLevels, 5);
addVocationalSubject("Civil Engineering Drawing & Architectural Drafting", "CED", 4, ["Civil Engineering & Woodwork"], allIndustrialLevels, 4);
addVocationalSubject("Applied Mechanics / Resistance of Materials", "RDM", 5, ["Civil Engineering & Woodwork"], allIndustrialLevels, 5);
addVocationalSubject("Carpentry and Joinery Technology", "CJT", 5, ["Civil Engineering & Woodwork"], allIndustrialLevels, 5);
addVocationalSubject("Bricklaying and Practical Construction Work", "BPC", 5, ["Civil Engineering & Woodwork"], allIndustrialLevels, 5);

addVocationalSubject("Motor/Diesel Vehicle Technology", "MDV", 5, ["Mechanical"], allIndustrialLevels, 5);
addVocationalSubject("Mechanical Construction & Design", "MCD", 5, ["Mechanical"], allIndustrialLevels, 5);
addVocationalSubject("Hydraulics and Chassis Systems", "HCS", 4, ["Mechanical"], allIndustrialLevels, 4);
addVocationalSubject("Workshop Processes and Materials", "WPM", 4, ["Mechanical"], allIndustrialLevels, 4);
addVocationalSubject("Welding Fabrication Work & Sheet Metal Construction", "WFS", 5, ["Mechanical"], allIndustrialLevels, 5);

addVocationalSubject("Pattern Drafting and Garment Making", "PDG", 5, ["Home Economics & Social"], allIndustrialLevels, 5);
addVocationalSubject("Textile Science", "TEX", 4, ["Home Economics & Social"], allIndustrialLevels, 4);
addVocationalSubject("Catering & Food Science Technology", "CFS", 4, ["Home Economics & Social"], allIndustrialLevels, 4);
addVocationalSubject("Nutrition and Applied Chemistry", "NAC", 4, ["Home Economics & Social"], allIndustrialLevels, 4);

addVocationalSubject("Business Mathematics", "BMA", 5, commercialDepartments, allCommercialLevels, 5);
addVocationalSubject("Business Economics", "BEC", 4, commercialDepartments, allCommercialLevels, 4);
addVocationalSubject("Business Commerce", "BCM", 4, commercialDepartments, allCommercialLevels, 4);
addVocationalSubject("Business Law / Company Law", "BLC", 3, commercialDepartments, allCommercialLevels, 3);
addVocationalSubject("Entrepreneurship", "ENT", 3, commercialDepartments, secondCycleLevels, 3);

addVocationalSubject("OHADA Financial Accounting", "OFA", 5, ["Accounting"], allCommercialLevels, 5);
addVocationalSubject("Financial Reporting & Corporate Accounting", "FRC", 5, ["Accounting"], allCommercialLevels, 5);
addVocationalSubject("Cost & Management Accounting", "CMA", 5, ["Accounting"], allCommercialLevels, 5);
addVocationalSubject("Computer-Aided Accounting", "CAA", 4, ["Accounting"], allCommercialLevels, 4);

addVocationalSubject("Professional Marketing Practice", "PMP", 5, ["Marketing & Sales"], ["Form 3", "Form 4", "Form 5", "4ème", "3ème", ...secondCycleLevels], 5);
addVocationalSubject("Product Mastery and Sales Methods", "PMS", 5, ["Marketing & Sales"], ["Form 3", "Form 4", "Form 5", "4ème", "3ème", ...secondCycleLevels], 5);
addVocationalSubject("Digital Marketing", "DGM", 4, ["Marketing & Sales"], ["Form 3", "Form 4", "Form 5", "4ème", "3ème", ...secondCycleLevels], 4);

addVocationalSubject("Office Practice / Office Automation", "OPA", 5, ["Secretarial Administration & Communication"], allCommercialLevels, 5);
addVocationalSubject("Professional Communication Techniques", "PCT", 4, ["Secretarial Administration & Communication"], allCommercialLevels, 4);
addVocationalSubject("Information Processing / Word Processing", "IPW", 4, ["Secretarial Administration & Communication"], allCommercialLevels, 4);

addVocationalSubject("Food Science & Nutrition / Catering Management", "FSC", 5, ["Home Economics & Social Care"], allCommercialLevels, 5);
addVocationalSubject("Resource Management on Home Studies", "RMH", 4, ["Home Economics & Social Care"], allCommercialLevels, 4);
addVocationalSubject("Family Life Education & Gerontology", "FLE", 3, ["Home Economics & Social Care"], allCommercialLevels, 3);

const userSeed = [
    { name: "Awa Ndeh", username: "admin01", phone: "+237650000001", role: "admin", qualification: "School Administrator", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 0, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
    { name: "Samuel Tchouga", username: "bursar01", phone: "+237650000002", role: "bursar", qualification: "Finance Officer", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 0, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
    { name: "Miriam Ndong", username: "teacher01", phone: "+237650000003", role: "teacher", qualification: "B.Ed English", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 180000, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
    { name: "Daniel Ekema", username: "teacher02", phone: "+237650000004", role: "teacher", qualification: "B.Sc Mathematics", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 185000, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
    { name: "Grace Tabi", username: "teacher03", phone: "+237650000005", role: "teacher", qualification: "B.Sc Biology", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 190000, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
    { name: "Paul Fotso", username: "teacher04", phone: "+237650000006", role: "teacher", qualification: "B.A History", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 175000, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
    { name: "Marie Fonkou", username: "teacher05", phone: "+237650000007", role: "teacher", qualification: "B.A Geography", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 178000, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
    { name: "Joseph Nfor", username: "teacher06", phone: "+237650000008", role: "teacher", qualification: "B.Sc Physics", subjectIds: [], classIds: [], isPermanent: true, monthlySalary: 195000, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], acedemicYear: ACADEMIC_YEAR },
];

const studentSeed = [
    { fullName: "Nadia Mbah", gender: "female", dob: "2012-03-11", className: "Form 1", department: "General", parentName: "Mbah Emmanuel", parentPhone: "+237670000011", address: "Bonaberi, Douala", registrationDate: "2025-09-02", feesPaid: 155000, feesDue: 30000, tuitionFee: 180000, tuitionInstallments: 3, tuitionFeePaid: 155000, tuitionInstallmentsPaid: 2, registrationFeeRequired: true, registrationFeeAmount: 25000, registrationFeePaid: 25000 },
    { fullName: "Kevin Ngu", gender: "male", dob: "2011-05-19", className: "Form 2", department: "General", parentName: "Ngu Sylvie", parentPhone: "+237670000012", address: "Mile 6, Douala", registrationDate: "2025-09-03", feesPaid: 170000, feesDue: 45000, tuitionFee: 190000, tuitionInstallments: 3, tuitionFeePaid: 170000, tuitionInstallmentsPaid: 2, registrationFeeRequired: true, registrationFeeAmount: 25000, registrationFeePaid: 25000 },
    { fullName: "Lola Momo", gender: "female", dob: "2010-09-07", className: "Form 3", department: "Arts", parentName: "Momo Roger", parentPhone: "+237670000013", address: "Bepanda, Douala", registrationDate: "2025-09-04", feesPaid: 180000, feesDue: 60000, tuitionFee: 210000, tuitionInstallments: 3, tuitionFeePaid: 180000, tuitionInstallmentsPaid: 2, registrationFeeRequired: true, registrationFeeAmount: 30000, registrationFeePaid: 30000 },
    { fullName: "Armand Eyoum", gender: "male", dob: "2010-11-16", className: "Form 3", department: "Science", parentName: "Eyoum Henri", parentPhone: "+237670000014", address: "Akwa, Douala", registrationDate: "2025-09-05", feesPaid: 190000, feesDue: 70000, tuitionFee: 220000, tuitionInstallments: 3, tuitionFeePaid: 190000, tuitionInstallmentsPaid: 2, registrationFeeRequired: true, registrationFeeAmount: 30000, registrationFeePaid: 30000 },
    { fullName: "Fleur Tchinda", gender: "female", dob: "2009-02-23", className: "Form 4", department: "Arts", parentName: "Tchinda Leonel", parentPhone: "+237670000015", address: "Makepe, Douala", registrationDate: "2025-09-06", feesPaid: 200000, feesDue: 80000, tuitionFee: 220000, tuitionInstallments: 3, tuitionFeePaid: 200000, tuitionInstallmentsPaid: 2, registrationFeeRequired: true, registrationFeeAmount: 30000, registrationFeePaid: 30000 },
    { fullName: "Yvan Njamnsi", gender: "male", dob: "2009-08-01", className: "Form 4", department: "Science", parentName: "Njamnsi Jade", parentPhone: "+237670000016", address: "Ndokoti, Douala", registrationDate: "2025-09-07", feesPaid: 210000, feesDue: 90000, tuitionFee: 240000, tuitionInstallments: 3, tuitionFeePaid: 210000, tuitionInstallmentsPaid: 2, registrationFeeRequired: true, registrationFeeAmount: 30000, registrationFeePaid: 30000 },
    { fullName: "Beatrice Ayuk", gender: "female", dob: "2008-06-18", className: "Form 5", department: "Arts", parentName: "Ayuk Patrick", parentPhone: "+237670000017", address: "Bassa, Douala", registrationDate: "2025-09-08", feesPaid: 230000, feesDue: 100000, tuitionFee: 240000, tuitionInstallments: 4, tuitionFeePaid: 230000, tuitionInstallmentsPaid: 3, registrationFeeRequired: true, registrationFeeAmount: 35000, registrationFeePaid: 35000 },
    { fullName: "Caleb Mvogo", gender: "male", dob: "2008-09-25", className: "Form 5", department: "Science", parentName: "Mvogo Nicolas", parentPhone: "+237670000018", address: "New Bell, Douala", registrationDate: "2025-09-09", feesPaid: 250000, feesDue: 110000, tuitionFee: 260000, tuitionInstallments: 4, tuitionFeePaid: 250000, tuitionInstallmentsPaid: 3, registrationFeeRequired: true, registrationFeeAmount: 35000, registrationFeePaid: 35000 },
    { fullName: "Celine Fai", gender: "female", dob: "2007-04-20", className: "Lower 6th", department: "Arts", parentName: "Fai Dorian", parentPhone: "+237670000019", address: "Logbessou, Douala", registrationDate: "2025-09-10", feesPaid: 290000, feesDue: 120000, tuitionFee: 320000, tuitionInstallments: 4, tuitionFeePaid: 290000, tuitionInstallmentsPaid: 3, registrationFeeRequired: true, registrationFeeAmount: 40000, registrationFeePaid: 40000 },
    { fullName: "Ruben Atangana", gender: "male", dob: "2007-01-12", className: "Lower 6th", department: "Science", parentName: "Atangana Bernard", parentPhone: "+237670000020", address: "Bonapriso, Douala", registrationDate: "2025-09-11", feesPaid: 295000, feesDue: 130000, tuitionFee: 340000, tuitionInstallments: 4, tuitionFeePaid: 295000, tuitionInstallmentsPaid: 3, registrationFeeRequired: true, registrationFeeAmount: 40000, registrationFeePaid: 40000 },
    { fullName: "Diane Ngassa", gender: "female", dob: "2006-10-09", className: "Upper 6th", department: "Arts", parentName: "Ngassa Michel", parentPhone: "+237670000021", address: "Bali, Douala", registrationDate: "2025-09-12", feesPaid: 310000, feesDue: 150000, tuitionFee: 340000, tuitionInstallments: 4, tuitionFeePaid: 310000, tuitionInstallmentsPaid: 3, registrationFeeRequired: true, registrationFeeAmount: 45000, registrationFeePaid: 45000 },
    { fullName: "Victor Neba", gender: "male", dob: "2006-12-29", className: "Upper 6th", department: "Science", parentName: "Neba Marie", parentPhone: "+237670000022", address: "Bafia, Douala", registrationDate: "2025-09-13", feesPaid: 330000, feesDue: 160000, tuitionFee: 360000, tuitionInstallments: 4, tuitionFeePaid: 330000, tuitionInstallmentsPaid: 3, registrationFeeRequired: true, registrationFeeAmount: 45000, registrationFeePaid: 45000 },
];

const TARGET_STUDENTS_PER_CLASS = 10;
const generatedFirstNames = ["Amina", "Boris", "Chantal", "Didier", "Esther", "Frank", "Gloria", "Hervé", "Irene", "Jean"];
const generatedLastNames = ["Abena", "Biloa", "Etoa", "Fokou", "Kouam", "Manga", "Mbiya", "Nana", "Owona", "Talla"];
let generatedStudentNumber = 1;

for (const schoolClass of classSeed) {
    const existingCount = studentSeed.filter((student) =>
        student.className === schoolClass.className && student.department === schoolClass.department
    ).length;

    for (let classStudentIndex = existingCount; classStudentIndex < TARGET_STUDENTS_PER_CLASS; classStudentIndex += 1) {
        const studentNumber = generatedStudentNumber;
        const tuitionFeePaid = Math.round(schoolClass.tuitionFee * ([0.25, 0.5, 0.75][classStudentIndex % 3]));
        const registrationFeePaid = schoolClass.registrationFeeRequired ? schoolClass.registrationFeeAmount : 0;
        const firstName = generatedFirstNames[(studentNumber - 1) % generatedFirstNames.length];
        const lastName = generatedLastNames[Math.floor((studentNumber - 1) / generatedFirstNames.length) % generatedLastNames.length];

        studentSeed.push({
            fullName: `${firstName} ${lastName} ${String(studentNumber).padStart(4, "0")}`,
            gender: studentNumber % 2 === 0 ? "male" : "female",
            dob: `${2006 + (studentNumber % 7)}-${String((studentNumber % 12) + 1).padStart(2, "0")}-${String((studentNumber % 27) + 1).padStart(2, "0")}`,
            className: schoolClass.className,
            department: schoolClass.department,
            parentName: `Parent ${lastName} ${String(studentNumber).padStart(4, "0")}`,
            parentPhone: `+23767${String(1000000 + studentNumber).slice(-7)}`,
            address: ["Bonaberi, Douala", "Bepanda, Douala", "Akwa, Douala", "Bamenda", "Bafoussam"][studentNumber % 5],
            registrationDate: `2025-09-${String((studentNumber % 27) + 1).padStart(2, "0")}`,
            feesPaid: tuitionFeePaid + registrationFeePaid,
            feesDue: schoolClass.tuitionFee - tuitionFeePaid,
            tuitionFee: schoolClass.tuitionFee,
            tuitionInstallments: schoolClass.tuitionInstallments,
            tuitionFeePaid,
            tuitionInstallmentsPaid: Math.max(1, Math.floor((tuitionFeePaid / schoolClass.tuitionFee) * schoolClass.tuitionInstallments)),
            registrationFeeRequired: schoolClass.registrationFeeRequired,
            registrationFeeAmount: schoolClass.registrationFeeAmount,
            registrationFeePaid,
        });

        generatedStudentNumber += 1;
    }
}

const schoolSettingsSeed = {
    schoolStartTime: "07:30",
    schoolEndTime: "15:30",
    breakStart: "10:00",
    breakEnd: "10:30",
    periodDurationMinutes: 45,
    schoolDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    academicYear: ACADEMIC_YEAR,
    section: SECTION,
    periodsPerDay: 6,
    teacherPaymentMode: "hourly",
};

function getClassKey(className, department) {
    return `${className}|${department}`;
}

async function main() {
    const mongoUri = process.env.SEED_DB === "offline" ? process.env.MONGOURIOFFLINE : process.env.MONGOURI;
    if (!mongoUri) {
        throw new Error("Neither MONGOURIOFFLINE nor MONGOURI is defined in the environment.");
    }

    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 120000,
        maxPoolSize: 5,
    });
    console.log(`Connected to configured ${process.env.SEED_DB === "offline" ? "offline" : "online"} database.`);

    const createdClassIds = new Map();
    for (const schoolClass of classSeed) {
        const doc = await SchoolClass.findOneAndUpdate(
            { className: schoolClass.className, department: schoolClass.department, acedemicYear: ACADEMIC_YEAR, schoolSection: SECTION },
            {
                $set: {
                    ...schoolClass,
                    schoolSection: SECTION,
                    acedemicYear: ACADEMIC_YEAR,
                    isActive: true,
                    studentCount: 0,
                    maxStudents: 45,
                    classMasterId: "",
                },
            },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );

        createdClassIds.set(getClassKey(schoolClass.className, schoolClass.department), doc._id.toString());
        console.log(`Seeded class: ${schoolClass.className} / ${schoolClass.department}`);
    }

    const createdSubjectIds = new Map();
    for (const subject of subjectSeed) {
        const classIds = classSeed
            .filter((schoolClass) => subject.classNames.includes(schoolClass.className) && subject.departments.includes(schoolClass.department))
            .map((schoolClass) => createdClassIds.get(getClassKey(schoolClass.className, schoolClass.department)))
            .filter(Boolean);

        const doc = await Subject.findOneAndUpdate(
            { code: subject.code, section: SECTION },
            {
                $set: {
                    ...subject,
                    section: SECTION,
                    classIds,
                    teacherIds: [],
                    periodsByClass: {},
                },
            },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );

        createdSubjectIds.set(subject.code, doc._id.toString());
        console.log(`Seeded subject: ${subject.name} (${subject.code})`);
    }

    await SchoolSettings.findOneAndUpdate(
        { academicYear: ACADEMIC_YEAR, section: SECTION },
        { $set: schoolSettingsSeed },
        { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
    );
    console.log(`Seeded school settings for ${ACADEMIC_YEAR}`);

    const createdUsers = [];
    for (const user of userSeed) {
        const doc = await User.findOneAndUpdate(
            { username: user.username },
            { $set: { ...user, section: SECTION } },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );
        createdUsers.push(doc);
        console.log(`Seeded user: ${doc.name} (${doc.role})`);
    }

    const teacherMap = new Map(createdUsers.filter((user) => user.role === "teacher").map((user) => [user.username, user._id.toString()]));
    const teacherUsers = createdUsers.filter((user) => user.role === "teacher");

    for (const teacher of teacherUsers) {
        const subjectCodes =
            teacher.username === "teacher01" ? ["ENG", "LIT"] :
                teacher.username === "teacher02" ? ["MTH", "PMA"] :
                    teacher.username === "teacher03" ? ["BIO", "CHE"] :
                        teacher.username === "teacher04" ? ["HIS", "GEO"] :
                            teacher.username === "teacher05" ? ["GEO", "REL"] :
                                teacher.username === "teacher06" ? ["PHY", "CHE6"] :
                                    ["ENG"];

        const subjectIds = subjectCodes.map((code) => createdSubjectIds.get(code)).filter(Boolean);
        const classIds = Array.from(createdClassIds.values()).slice(0, 3);

        await User.findByIdAndUpdate(teacher._id, { $set: { subjectIds, classIds } });
    }

    const studentRecords = [];
    for (const [index, student] of studentSeed.entries()) {
        const classId = createdClassIds.get(getClassKey(student.className, student.department));
        if (!classId) continue;

        const matriculeValue = `BCHS-${ACADEMIC_YEAR}-${String(index + 1).padStart(4, "0")}`;

        const doc = await Student.findOneAndUpdate(
            { matricule: matriculeValue },
            {
                $set: {
                    fullName: student.fullName,
                    section: SECTION,
                    matricule: matriculeValue,
                    enrollmentYear: 2025,
                    gender: student.gender,
                    dob: student.dob,
                    classId,
                    department: student.department,
                    parentName: student.parentName,
                    parentPhone: student.parentPhone,
                    address: student.address,
                    photoUrl: "",
                    registrationDate: student.registrationDate,
                    feesPaid: student.feesPaid,
                    feesDue: student.feesDue,
                    tuitionFee: student.tuitionFee,
                    tuitionInstallments: student.tuitionInstallments,
                    tuitionFeePaid: student.tuitionFeePaid,
                    tuitionInstallmentsPaid: student.tuitionInstallmentsPaid,
                    registrationFeeRequired: student.registrationFeeRequired,
                    registrationFeeAmount: student.registrationFeeAmount,
                    registrationFeePaid: student.registrationFeePaid,
                    feePayments: [
                        { feeType: "tuition", amount: student.tuitionFeePaid, installmentNumber: 1, paidAt: new Date("2025-09-02"), recordedBy: "admin01" },
                        { feeType: "registration", amount: student.registrationFeePaid, installmentNumber: 1, paidAt: new Date("2025-09-02"), recordedBy: "admin01" },
                    ],
                },
            },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );
        studentRecords.push(doc);
    }

    const classIds = Array.from(createdClassIds.values());
    const studentCountsByClass = await Student.aggregate([
        { $match: { classId: { $in: classIds } } },
        { $group: { _id: "$classId", count: { $sum: 1 } } },
    ]);
    const studentCountMap = new Map(studentCountsByClass.map((item) => [item._id, item.count]));
    await SchoolClass.bulkWrite(classIds.map((classId) => ({
        updateOne: {
            filter: { _id: classId },
            update: { $set: { studentCount: studentCountMap.get(classId) || 0 } },
        },
    })));
    const minimumStudentsPerClass = Math.min(...classIds.map((classId) => studentCountMap.get(classId) || 0));
    console.log(`Synchronized student counts for ${classIds.length} classes; minimum roster: ${minimumStudentsPerClass}`);

    const attendanceDates = [
        new Date("2025-09-02T00:00:00.000Z"),
        new Date("2025-09-03T00:00:00.000Z"),
        new Date("2025-09-04T00:00:00.000Z"),
        new Date("2026-01-12T00:00:00.000Z"),
        new Date("2026-01-13T00:00:00.000Z"),
        new Date("2026-01-14T00:00:00.000Z"),
        new Date("2026-05-05T00:00:00.000Z"),
        new Date("2026-05-06T00:00:00.000Z"),
        new Date("2026-05-07T00:00:00.000Z"),
    ];
    const attendanceStatuses = ["present", "late", "present", "present", "absent", "present", "present", "excused", "late"];

    const attendanceOperations = [];
    for (const [index, student] of studentRecords.entries()) {
        const classId = String(student.classId);
        for (let i = 0; i < attendanceDates.length; i += 1) {
            const status = attendanceStatuses[(i + index) % attendanceStatuses.length];
            const term = i < 3 ? "first" : i < 6 ? "second" : "third";
            const studentId = String(student._id);
            attendanceOperations.push({
                updateOne: {
                    filter: { studentId, date: attendanceDates[i], period: "day" },
                    update: {
                        $set: {
                            studentId,
                            classId,
                            date: attendanceDates[i],
                            period: "day",
                            status,
                            academicYear: ACADEMIC_YEAR,
                            term,
                            section: SECTION,
                            recordedBy: "admin01",
                            notes: "Seed attendance",
                        },
                    },
                    upsert: true,
                },
            });
        }
    }

    for (let offset = 0; offset < attendanceOperations.length; offset += 500) {
        await StudentAttendance.bulkWrite(attendanceOperations.slice(offset, offset + 500), { ordered: false });
    }
    console.log(`Seeded ${attendanceOperations.length} student attendance records across all terms.`);

    for (const [index, teacher] of teacherUsers.slice(0, 3).entries()) {
        await TeacherAttendance.findOneAndUpdate(
            { teacherId: teacher._id, date: attendanceDates[0] },
            { $set: { teacherId: teacher._id, date: attendanceDates[0], section: SECTION, checkIn: "07:40", checkOut: "15:30", status: "present", hoursWorked: 7.5, periodsTaught: 6, notes: "Seed attendance", academicYear: ACADEMIC_YEAR, term: "first" } },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );
    }

    for (const teacher of teacherUsers) {
        await TeacherSalary.findOneAndUpdate(
            { teacherId: teacher._id, month: "September", year: "2025", section: SECTION },
            { $set: { teacherId: teacher._id, section: SECTION, month: "September", year: "2025", periodCounts: { firstCycle: 12, secondCycle: 8, total: 20 }, rates: { firstCycle: 500, secondCycle: 700 }, paymentMode: "hourly", monthlyAmount: 120000, classBreakdown: [], grossSalary: 120000, deductions: { total: 0, details: [] }, netSalary: 120000, attendance: { present: 18, absent: 0, late: 0, excused: 0 }, status: "pending", academicYear: ACADEMIC_YEAR, term: "first" } },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );
    }

    const salaryMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];
    for (const [teacherIndex, teacher] of teacherUsers.entries()) {
        for (const [monthIndex, month] of salaryMonths.entries()) {
            const firstCycle = 16 + ((teacherIndex + monthIndex) % 9);
            const secondCycle = 8 + ((teacherIndex * 2 + monthIndex) % 7);
            const grossSalary = (firstCycle * 500) + (secondCycle * 700);
            const absentDays = (teacherIndex + monthIndex) % 5 === 0 ? 1 : 0;
            const deductionTotal = absentDays * 5000;
            const isPastMonth = monthIndex < new Date().getMonth();
            const status = isPastMonth
                ? (teacherIndex % 3 === 0 ? "paid" : teacherIndex % 3 === 1 ? "partially_paid" : "pending")
                : "pending";
            const academicYear = monthIndex >= 8 ? "2026-2027" : "2025-2026";
            const term = monthIndex >= 8 && monthIndex <= 10
                ? "first"
                : monthIndex <= 2
                    ? "second"
                    : "third";

            await TeacherSalary.findOneAndUpdate(
                { teacherId: teacher._id, month, year: "2026", section: SECTION },
                {
                    $set: {
                        teacherId: teacher._id,
                        section: SECTION,
                        month,
                        year: "2026",
                        periodCounts: { firstCycle, secondCycle, total: firstCycle + secondCycle },
                        rates: { firstCycle: 500, secondCycle: 700 },
                        paymentMode: "hourly",
                        monthlyAmount: Number(teacher.monthlySalary) || 0,
                        classBreakdown: [],
                        grossSalary,
                        deductions: {
                            total: deductionTotal,
                            details: absentDays ? [{ type: "absence", amount: deductionTotal, description: `${absentDays} absence × 5,000 FRS` }] : [],
                        },
                        netSalary: grossSalary - deductionTotal,
                        attendance: { present: 20 - absentDays, absent: absentDays, late: (teacherIndex + monthIndex) % 2, excused: 0 },
                        status,
                        paymentDate: status === "paid" ? new Date(Date.UTC(2026, monthIndex, 25)) : undefined,
                        paymentMethod: status === "paid" ? (teacherIndex % 2 === 0 ? "mobile_money" : "bank_transfer") : undefined,
                        transactionId: status === "paid" ? `SAL-2026-${String(monthIndex + 1).padStart(2, "0")}-${teacher.username}` : "",
                        academicYear,
                        term,
                    },
                },
                { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
            );
        }
    }

    const markSequences = ["1st seq", "2nd seq", "3rd seq", "4th seq", "5th seq", "6th seq"];
    const markOperations = [];
    const existingMarkRows = await Mark.find({ academicyear: ACADEMIC_YEAR, section: SECTION })
        .select("studentId subjectId classId sequence section")
        .lean();
    const existingMarkKeys = new Set(existingMarkRows.map((mark) =>
        `${mark.studentId}|${mark.subjectId}|${mark.classId}|${mark.sequence}`
    ));
    for (const [studentIndex, student] of studentRecords.entries()) {
        const studentClass = classSeed.find((schoolClass) =>
            createdClassIds.get(getClassKey(schoolClass.className, schoolClass.department)) === String(student.classId)
        );
        if (!studentClass) continue;

        const assignedSubjects = subjectSeed.filter((subject) =>
            subject.classNames.includes(studentClass.className)
            && subject.departments.includes(studentClass.department)
        );

        for (const subject of assignedSubjects) {
            const subjectId = createdSubjectIds.get(subject.code);
            if (!subjectId) continue;

            const subjectHash = Array.from(subject.code).reduce((sum, character) => sum + character.charCodeAt(0), 0);
            const teacher = teacherUsers[(studentIndex + subjectHash) % teacherUsers.length];
            for (const [sequenceIndex, sequence] of markSequences.entries()) {
                const score = 8 + ((studentIndex * 7 + subjectHash + sequenceIndex * 3) % 13);
                const studentId = String(student._id);
                const classId = String(student.classId);
                const markKey = `${studentId}|${subjectId}|${classId}|${sequence}`;
                if (existingMarkKeys.has(markKey)) continue;
                existingMarkKeys.add(markKey);
                markOperations.push({
                    updateOne: {
                        filter: { studentId, subjectId, classId, sequence, academicyear: ACADEMIC_YEAR, section: SECTION },
                        update: {
                            $set: {
                                studentId,
                                subjectId,
                                classId,
                                sequence,
                                academicyear: ACADEMIC_YEAR,
                                section: SECTION,
                                score,
                                recordedBy: String(teacher._id),
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }
    }

    const markBatchSize = 100;
    for (let offset = 0; offset < markOperations.length; offset += markBatchSize) {
        const batch = markOperations.slice(offset, offset + markBatchSize);
        let attempt = 0;
        while (true) {
            try {
                await Mark.bulkWrite(batch, { ordered: false });
                break;
            } catch (error) {
                attempt += 1;
                if (attempt >= 3) throw error;
                console.warn(`Mark batch at ${offset} failed; reconnecting for retry ${attempt}/2.`);
                await mongoose.disconnect().catch(() => { });
                await mongoose.connect(mongoUri, {
                    serverSelectionTimeoutMS: 30000,
                    socketTimeoutMS: 120000,
                    maxPoolSize: 5,
                });
            }
        }
        if ((offset + markBatchSize) % 5000 < markBatchSize || offset + markBatchSize >= markOperations.length) {
            console.log(`Processed ${Math.min(offset + markBatchSize, markOperations.length)} / ${markOperations.length} student subject sequence marks.`);
        }
    }
    console.log(`Seeded ${markOperations.length} student subject sequence marks.`);

    const timetableSeed = [
        { teacherUsername: "teacher01", className: "Form 1", department: "General", subjectCode: "ENG", day: "Monday", startTime: "08:00", endTime: "08:45", periodNumber: 1, cycle: "first", room: "Room 101" },
        { teacherUsername: "teacher02", className: "Form 2", department: "General", subjectCode: "MTH", day: "Monday", startTime: "09:00", endTime: "09:45", periodNumber: 2, cycle: "first", room: "Room 102" },
        { teacherUsername: "teacher03", className: "Form 3", department: "Science", subjectCode: "BIO", day: "Tuesday", startTime: "08:00", endTime: "08:45", periodNumber: 1, cycle: "first", room: "Lab 1" },
        { teacherUsername: "teacher04", className: "Form 3", department: "Arts", subjectCode: "HIS", day: "Tuesday", startTime: "09:00", endTime: "09:45", periodNumber: 2, cycle: "first", room: "Room 201" },
        { teacherUsername: "teacher05", className: "Form 4", department: "Arts", subjectCode: "GEO", day: "Wednesday", startTime: "08:00", endTime: "08:45", periodNumber: 1, cycle: "first", room: "Room 202" },
        { teacherUsername: "teacher06", className: "Form 5", department: "Science", subjectCode: "PHY", day: "Wednesday", startTime: "09:00", endTime: "09:45", periodNumber: 2, cycle: "first", room: "Lab 2" },
        { teacherUsername: "teacher01", className: "Lower 6th", department: "Arts", subjectCode: "ENL", day: "Thursday", startTime: "08:00", endTime: "08:45", periodNumber: 1, cycle: "second", room: "Room 301" },
        { teacherUsername: "teacher02", className: "Upper 6th", department: "Science", subjectCode: "PMA", day: "Thursday", startTime: "09:00", endTime: "09:45", periodNumber: 2, cycle: "second", room: "Room 302" },
        { teacherUsername: "teacher04", className: "Lower 6th", department: "Arts", subjectCode: "PHI", day: "Friday", startTime: "08:00", endTime: "08:45", periodNumber: 1, cycle: "second", room: "Room 303" },
        { teacherUsername: "teacher06", className: "Upper 6th", department: "Science", subjectCode: "CSC", day: "Friday", startTime: "09:00", endTime: "09:45", periodNumber: 2, cycle: "second", room: "ICT Lab" },
    ];

    for (const item of timetableSeed) {
        const teacherId = teacherMap.get(item.teacherUsername);
        const classId = createdClassIds.get(getClassKey(item.className, item.department));
        const subjectId = createdSubjectIds.get(item.subjectCode);
        if (!teacherId || !classId || !subjectId) continue;

        await Timetable.findOneAndUpdate(
            { teacherId, classId, subjectId, day: item.day, startTime: item.startTime, academicYear: ACADEMIC_YEAR, section: SECTION },
            { $set: { teacherId, classId, subjectId, day: item.day, startTime: item.startTime, endTime: item.endTime, periodNumber: item.periodNumber, cycle: item.cycle, ratePerPeriod: item.cycle === "first" ? 500 : 700, room: item.room, academicYear: ACADEMIC_YEAR, section: SECTION, isActive: true } },
            { upsert: true, setDefaultsOnInsert: true, runValidators: true, returnDocument: "after" }
        );
    }

    const countSummary = {
        classes: await SchoolClass.countDocuments({ acedemicYear: ACADEMIC_YEAR, schoolSection: SECTION }),
        subjects: await Subject.countDocuments({ section: SECTION }),
        users: await User.countDocuments({ section: SECTION }),
        students: await Student.countDocuments({ section: SECTION }),
        classesWithStudents: studentCountMap.size,
        minimumStudentsPerClass,
        studentAttendance: await StudentAttendance.countDocuments({ academicYear: ACADEMIC_YEAR, section: SECTION }),
        teacherAttendance: await TeacherAttendance.countDocuments({ academicYear: ACADEMIC_YEAR, section: SECTION }),
        teacherSalary: await TeacherSalary.countDocuments({ academicYear: ACADEMIC_YEAR, section: SECTION }),
        marks: await Mark.countDocuments({ academicyear: ACADEMIC_YEAR, section: SECTION }),
        timetable: await Timetable.countDocuments({ academicYear: ACADEMIC_YEAR, section: SECTION }),
        settings: await SchoolSettings.countDocuments({ academicYear: ACADEMIC_YEAR, section: SECTION }),
    };

    console.log("Seed completed:", countSummary);
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error("Unable to seed all school data:", error);
    process.exit(1);
});
