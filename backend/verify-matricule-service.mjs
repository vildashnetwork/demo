import mongoose from "mongoose";
import Counter from "./models/Counter.js";
import Student from "./models/Students.js";
import {
    generateMatricule,
    previewMatricule,
    backfillMatricules,
    auditMatricules,
    getMatriculePrefix,
    enrollmentYearOf
} from "./services/matriculeService.js";

// Isolated scratch database (the local mongod is only used as an engine).
const URI = "mongodb://127.0.0.1:27017/matricule_service_test";
const YEAR = new Date().getFullYear();
const PREFIX = getMatriculePrefix();

let passed = 0;
let failed = 0;
const check = (label, ok, extra = "") => {
    if (ok) { passed += 1; console.log(`PASS  ${label} ${extra}`); }
    else { failed += 1; console.log(`FAIL  ${label} ${extra}`); }
};

const mk = (name, extra = {}) => ({
    fullName: name,
    gender: "female",
    dob: new Date("2015-01-01"),
    classId: "TEST-CLASS",
    department: "General",
    parentName: "Test Parent",
    parentPhone: `+2376000${Math.floor(Math.random() * 100000)}`,
    address: "Test Address",
    registrationDate: new Date(`${YEAR}-09-01`),
    feesPaid: 0,
    feesDue: 0,
    ...extra
});

await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });
console.log("connected to", URI, "| prefix:", PREFIX);

await Promise.all([Student.deleteMany({}), Counter.deleteMany({})]);

// ---- A. concurrent creation must be sequential and unique -----------------
const created = await Promise.all(
    Array.from({ length: 5 }, (_, i) => Student.create(mk(`Concurrent ${i + 1}`)))
);
const listA = created.map((s) => s.matricule).sort();
check("A concurrent saves are unique", new Set(listA).size === 5, listA.join(","));
check("A numbers are 0001..0005", listA.join(",") === [1, 2, 3, 4, 5].map((n) => `${PREFIX}-${YEAR}-000${n}`).join(","), listA.join(","));
const counterA = await Counter.findOne({ key: `matricule:${PREFIX}-${YEAR}` }).lean();
check("A counter seq == 5", counterA?.seq === 5, `seq=${counterA?.seq}`);

// ---- B. preview must not reserve -----------------------------------------
const p1 = await previewMatricule({});
const p2 = await previewMatricule({});
check("B preview is stable", p1.matricule === p2.matricule && p1.matricule === `${PREFIX}-${YEAR}-0006`, `${p1.matricule} / ${p2.matricule}`);
const b = await Student.create(mk("Preview Taken"));
check("B next save consumes the preview", b.matricule === p1.matricule, b.matricule);

// ---- C. manual matricule is kept, duplicates rejected --------------------
const manual = await Student.create(mk("Manual Number", { matricule: `${PREFIX}-${YEAR}-7777` }));
check("C manual matricule kept", manual.matricule === `${PREFIX}-${YEAR}-7777`, manual.matricule);
check("C virtual alias mirrors matricule", manual.admissionNumber === manual.matricule);
let dupRejected = false;
try {
    await Student.create(mk("Dup Manual", { matricule: `${PREFIX}-${YEAR}-7777` }));
} catch (err) {
    dupRejected = err?.name === "DuplicateMatricule";
}
check("C duplicate manual rejected by model", dupRejected);
const lower = await Student.create(mk("Lower Case", { matricule: ` ${PREFIX.toLowerCase()}-${YEAR}-8888  ` }));
check("C manual normalised (trim + upper)", lower.matricule === `${PREFIX}-${YEAR}-8888`, lower.matricule);

// ---- D. counter repaired to the highest matricule already stored ---------
await Counter.updateOne({ key: `matricule:${PREFIX}-${YEAR}` }, { $set: { seq: 1 } });
const afterReset = await Student.create(mk("After Counter Reset"));
const resetSeq = Number(afterReset.matricule.split("-").pop());
check("D counter behind does not collide", resetSeq > 8888, afterReset.matricule);
const dupGroupsNow = await Student.aggregate([{ $group: { _id: "$matricule", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]);
check("D no duplicate in collection", dupGroupsNow.length === 0, JSON.stringify(dupGroupsNow));

// ---- E. backfill for legacy students (no matricule) ----------------------
await Student.collection.insertMany([
    { ...mk("Legacy One"), matricule: "", registrationDate: new Date(`${YEAR}-01-05`) },
    { ...mk("Legacy Two"), matricule: "", registrationDate: new Date(`${YEAR}-01-06`) }
]);
const dry = await backfillMatricules({ dryRun: true });
check("E dry run reports 2 pending", dry.scanned === 2 && dry.assigned === 2, JSON.stringify(dry.students.map((s) => s.matricule)));
check("E dry run writes nothing", (await Student.countDocuments({ matricule: "" })) === 2);
const filled = await backfillMatricules();
check("E backfill assigns 2", filled.assigned === 2, JSON.stringify(filled.students.map((s) => `${s.fullName}:${s.matricule}`)));
check("E nothing pending afterwards", (await Student.countDocuments({ $or: [{ matricule: "" }, { matricule: null }] })) === 0);
check("E oldest student first", filled.students[0]?.fullName === "Legacy One", JSON.stringify(filled.students.map((s) => `${s.fullName}=${s.matricule}`)));
check("E re-running backfill assigns nobody", (await backfillMatricules()).assigned === 0);

