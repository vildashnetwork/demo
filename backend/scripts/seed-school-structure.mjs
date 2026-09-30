import "dotenv/config";
import mongoose from "mongoose";
import SchoolClass from "../models/SchoolClass.js";
import Subject from "../models/Subject.js";

const ACADEMIC_YEAR = "2025-2026";

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

const subjectSeed = [
    { name: "English Language", code: "ENG", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5"], departments: ["General", "Arts", "Science"], periodsPerWeek: 5 },
    { name: "French", code: "FRE", coefficient: 3, cycle: "1st Cycle", classNames: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5"], departments: ["General", "Arts", "Science"], periodsPerWeek: 4 },
    { name: "Mathematics", code: "MTH", coefficient: 5, cycle: "1st Cycle", classNames: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5"], departments: ["General", "Arts", "Science"], periodsPerWeek: 5 },
    { name: "Citizenship Education", code: "CIV", coefficient: 2, cycle: "1st Cycle", classNames: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5"], departments: ["General", "Arts", "Science"], periodsPerWeek: 2 },
    { name: "Information and Communication Technology", code: "ICT", coefficient: 3, cycle: "1st Cycle", classNames: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5"], departments: ["General", "Arts", "Science"], periodsPerWeek: 3 },
    { name: "Literature in English", code: "LIT", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "History", code: "HIS", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 4 },
    { name: "Geography", code: "GEO", coefficient: 4, cycle: "1st Cycle", classNames: ["Form 3", "Form 4", "Form 5"], departments: ["Arts"], periodsPerWeek: 4 },
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

async function main() {
    const mongoUri = process.env.MONGOURIOFFLINE || process.env.MONGOURI;
    if (!mongoUri) {
        throw new Error("Neither MONGOURIOFFLINE nor MONGOURI is defined in the environment.");
    }

    console.log(`Connecting to database: ${mongoUri}`);

    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 20000,
    });

    console.log("Connected to MongoDB");

    const createdClassIds = new Map();

    for (const schoolClass of classSeed) {
        const doc = await SchoolClass.findOneAndUpdate(
            { className: schoolClass.className, department: schoolClass.department, acedemicYear: ACADEMIC_YEAR },
            {
                $set: {
                    ...schoolClass,
                    acedemicYear: ACADEMIC_YEAR,
                    isActive: true,
                    studentCount: 0,
                    maxStudents: 45,
                    classMasterId: "",
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );

        const key = `${schoolClass.className}|${schoolClass.department}`;
        createdClassIds.set(key, doc._id.toString());
        console.log(`Seeded class: ${schoolClass.className} / ${schoolClass.department} (${doc._id})`);
    }

    let subjectCount = 0;

    for (const subject of subjectSeed) {
        const matchingClassIds = classSeed
            .filter((schoolClass) => subject.classNames.includes(schoolClass.className) && subject.departments.includes(schoolClass.department))
            .map((schoolClass) => createdClassIds.get(`${schoolClass.className}|${schoolClass.department}`))
            .filter(Boolean);

        const doc = await Subject.findOneAndUpdate(
            { code: subject.code },
            {
                $set: {
                    ...subject,
                    classIds: matchingClassIds,
                    teacherIds: [],
                    periodsByClass: {},
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );

        subjectCount += 1;
        console.log(`Seeded subject: ${subject.name} (${subject.code}) -> ${matchingClassIds.length} classes`);
    }

    const classTotal = await SchoolClass.countDocuments({ acedemicYear: ACADEMIC_YEAR });
    const subjectTotal = await Subject.countDocuments();

    console.log(`Seeding complete: ${classTotal} classes and ${subjectTotal} subjects for ${ACADEMIC_YEAR}.`);

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error("Unable to seed school structure:", error);
    process.exit(1);
});
