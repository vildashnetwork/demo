// ============================================================================
// MOCK DATA - 5 000 students for the BCHS Douala demo database
// ----------------------------------------------------------------------------
// Standalone seeding script: all the mock data lives in THIS file, nothing
// else in the project is touched. It only ever INSERTS new students, and the
// optional --wipe flag deletes exactly the students this script created
// (tracked in scripts/mock-students-5k.manifest.json).
//
// Usage (from the backend folder):
//   node scripts/seed-5000-students.mjs                  # top the englophone section up to 5 000 students
//   node scripts/seed-5000-students.mjs --dry-run        # show the plan, write nothing
//   node scripts/seed-5000-students.mjs --count=250      # add 250 brand new students
//   node scripts/seed-5000-students.mjs --total=8000     # other target size
//   node scripts/seed-5000-students.mjs --wipe           # remove what this script created
//   node scripts/seed-5000-students.mjs --offline        # write to the local MongoDB instead
//
// Options:
//   --total=N     target number of students in the englophone section (default 5000)
//   --count=N     add exactly N new students instead of topping up to --total
//   --batch=N     insert batch size (default 500)
//   --series=X    force the matricule series, e.g. --series=BCHS-2025-2026
//                 (default: the series already used by the students in the DB)
//   --dry-run     print what would happen, never write anything
//   --wipe        delete the students created by previous runs of this script
//   --no-resize   never raise a class "maxStudents" when its roster grows past it
//   --offline     use MONGOURIOFFLINE (local MongoDB) instead of MONGOURI (Atlas)
//
// Safe by design: it only INSERTS students, and the only records it ever
// updates are the class rosters/capacities and the matricule counter, both of
// which --wipe puts back the way it found them.
// ============================================================================
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

// Load backend/.env BEFORE the models are imported: the model modules read
// process.env at import time (MONGOURI, MATRICULE_PREFIX, ...) and ESM
// evaluates every import before the body of this module runs.
const BACKEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(BACKEND_DIR, ".env") });

const mongoose = (await import("mongoose")).default;
const Student = (await import("../models/Students.js")).default;
const SchoolClass = (await import("../models/SchoolClass.js")).default;
const Counter = (await import("../models/Counter.js")).default;
const User = (await import("../models/User.js")).default;
const { srvToStandardUri } = await import("../db/dbManager.js");
const { getMatriculePrefix } = await import("../services/matriculeService.js");

const SECTION = "englophone";
const MANIFEST_PATH = resolve(BACKEND_DIR, "scripts", "mock-students-5k.manifest.json");
const CONNECT_OPTIONS = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 120000,
    maxPoolSize: 10,
};

// ============================================================================
// Command line options
// ============================================================================
const OPTIONS = (() => {
    const argv = new Map();
    for (const raw of process.argv.slice(2)) {
        const [rawKey, rawValue = "true"] = raw.replace(/^--?/, "").split("=");
        argv.set(rawKey.trim().toLowerCase(), rawValue.trim());
    }
    const number = (key, fallback) => {
        const value = Number(argv.get(key));
        return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    return {
        total: number("total", 5000),
        count: argv.has("count") ? number("count", 0) : null,
        batchSize: Math.max(1, number("batch", 500)),
        series: argv.get("series") || null,
        dryRun: argv.has("dry-run"),
        wipe: argv.has("wipe"),
        resizeCapacity: !argv.has("no-resize"),
        useOffline: argv.has("offline"),
    };
})();
// ============================================================================
// MOCK SOURCE DATA (Cameroon / Douala flavoured)
// ============================================================================
const MALE_NAMES = [
    "Emmanuel", "Arnaud", "Boris", "Christian", "Cyrille", "Denis", "Derek", "Divine", "Eric", "Fabrice",
    "Franck", "Gaetan", "Georges", "Ghislain", "Herve", "Idriss", "Ivan", "Jacques", "Joel", "Jordan",
    "Jules", "Kelvin", "Kennedy", "Landry", "Leonel", "Marc", "Marvin", "Michael", "Ndip", "Ngwa",
    "Olivier", "Patrick", "Paul", "Pascal", "Prince", "Raymond", "Rodrigue", "Samuel", "Serge", "Simon",
    "Stephane", "Sylvester", "Tanyi", "Valery", "Wilfried", "Yannick", "Zachee", "Alain", "Bertrand", "Cedric"
];

const FEMALE_NAMES = [
    "Adeline", "Aicha", "Alice", "Anita", "Audrey", "Bernadette", "Blandine", "Brenda", "Carine", "Celine",
    "Chantal", "Clarisse", "Cynthia", "Delphine", "Diane", "Dorine", "Estelle", "Eunice", "Flora", "Gaelle",
    "Grace", "Henriette", "Jeannette", "Josiane", "Judith", "Kareen", "Laure", "Liliane", "Linda", "Marceline",
    "Marie", "Mireille", "Nadege", "Nathalie", "Noella", "Olga", "Patience", "Pauline", "Prisca", "Rachel",
    "Rolande", "Sandrine", "Sonia", "Stella", "Sylvie", "Vanessa", "Yvonne", "Zita", "Emilienne", "Marlyse"
];

const MIDDLE_NAMES = [
    "Bih", "Enow", "Fon", "Ivo", "Jato", "Keng", "Loic", "Mola", "Ndie", "Obi", "Pef", "Sama",
    "Tabe", "Wung", "Anye", "Bote", "Chia", "Epie", "Fomum", "Gaius", "Haman", "Junior"
];

const SURNAMES = [
    "Atangana", "Ayissi", "Bakang", "Bakari", "Bello", "Bikoi", "Bilong", "Bissong", "Djoumessi", "Ekane",
    "Ekwalla", "Enow", "Essomba", "Etame", "Etoa", "Eyong", "Fokou", "Fotso", "Fru", "Gemandze",
    "Kalla", "Kamdem", "Ketchemen", "Kuate", "Kwedi", "Manga", "Manfouo", "Mbappe", "Mbarga", "Mboma",
    "Mendouga", "Mefire", "Mfouapon", "Mvondo", "Ndam", "Ndongo", "Ndzana", "Ngando", "Ngassa", "Ngono",
    "Ngoumou", "Njike", "Njoya", "Nkodo", "Nkoulou", "Nnama", "Nyobe", "Obiang", "Onana", "Owona",
    "Sadi", "Saidou", "Tchoumi", "Tchoupo", "Teneng", "Tita", "Wandji", "Yombi", "Zoa", "Mbah",
    "Ngu", "Momo", "Tabi", "Bate", "Nfor", "Che", "Awah", "Efond", "Moki", "Njo"
];

const DOUALA_QUARTERS = [
    "Bonaberi", "Bepanda", "Mile 6", "Deido", "Akwa", "Bali", "New Bell", "Ndogbong", "Yassa", "Logbessou",
    "Makepe", "Bonamoussadi", "Kotto", "Cite des Palmiers", "Ndokotti", "Bonapriso", "Bwang Bakoko", "Sodiko",
    "Nyalla", "PK 12", "PK 14", "Japoma", "Bomabot", "Ndogpassi", "Mabanda", "Beedi"
];

// Typical age range per class level (used to build a believable date of birth)
const AGE_BY_LEVEL = {
    "Beginers1": [4, 5],
    "Beginers2": [5, 6],
    "Olevel 3": [6, 7],
    "Olevel 4": [7, 8],
    "Olevel 5": [8, 9],
    "Form 1": [11, 13],
    "Form 2": [12, 14],
    "Form 3": [13, 15],
    "Form 4": [14, 16],
    "Form 5": [15, 17],
    "Lower 6th": [16, 18],
    "Upper 6th": [17, 19],
    "Graduated": [18, 20]
};
const DEFAULT_AGE_RANGE = [12, 16];

// How much of the school fees a mock student has paid.
// "weight" is the share of the mock students using that profile.
const PAYMENT_PROFILES = [
    { name: "cleared", weight: 30, tuition: "full", registration: true },
    { name: "tuition-only", weight: 20, tuition: "full", registration: false },
    { name: "partial", weight: 35, tuition: "partial", registration: true },
    { name: "unpaid", weight: 15, tuition: "none", registration: false }
];
// ============================================================================
// Small helpers
// ============================================================================
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[randomInt(0, list.length - 1)];
const pad = (value, width) => String(value).padStart(width, "0");
const dayString = (year, month, day) => `${year}-${pad(month, 2)}-${pad(day, 2)}`;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shuffle = (list) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = randomInt(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

/** Pick a payment profile using the configured weights. */
const pickPaymentProfile = () => {
    const total = PAYMENT_PROFILES.reduce((sum, profile) => sum + profile.weight, 0);
    let ticket = randomInt(1, total);
    for (const profile of PAYMENT_PROFILES) {
        ticket -= profile.weight;
        if (ticket <= 0) return profile;
    }
    return PAYMENT_PROFILES[0];
};

/** Evenly spread the requested number of students over the available classes. */
const spreadOverClasses = (classes, count) => {
    const plan = [];
    let pool = [];
    while (plan.length < count) {
        if (!pool.length) pool = shuffle(classes.map((_, index) => index));
        plan.push(pool.pop());
    }
    return plan;
};

const connectUri = async () => {
    const uri = OPTIONS.useOffline ? process.env.MONGOURIOFFLINE : process.env.MONGOURI;
    if (!uri) {
        throw new Error(
            OPTIONS.useOffline
                ? "MONGOURIOFFLINE is not defined in backend/.env"
                : "MONGOURI is not defined in backend/.env"
        );
    }
    return uri.startsWith("mongodb+srv://") ? srvToStandardUri(uri) : uri;
};

// ============================================================================
// Database readers
// ============================================================================

/** Active classes of the most recent academic year present in the database. */
const loadTargetClasses = async () => {
    const active = await SchoolClass.find({ isActive: true, schoolSection: SECTION }).lean();
    if (!active.length) {
        throw new Error("No active class found. Seed the school structure first: npm run seed:all");
    }
    const academicYear = [...new Set(active.map((schoolClass) => schoolClass.acedemicYear))].sort().pop();
    const classes = active
        .filter((schoolClass) => schoolClass.acedemicYear === academicYear)
        .sort((a, b) => `${a.className} ${a.department}`.localeCompare(`${b.className} ${b.department}`));
    return { academicYear, classes };
};

/**
 * Highest sequence already used inside one series, e.g. series
 * "BCHS-2025-2026" -> 1200 for the matricule "BCHS-2025-2026-1200".
 */
const highestInSeries = async (series) => {
    const [row] = await Student.aggregate([
        { $match: { matricule: new RegExp(`^${escapeRegex(series)}-(\\d+)$`, "i") } },
        { $project: { digits: { $regexFind: { input: "$matricule", regex: "(\\d+)\\s*$" } } } },
        { $project: { seq: { $toInt: { $ifNull: [{ $arrayElemAt: ["$digits.captures", 0] }, "0"] } } } },
        { $group: { _id: null, max: { $max: "$seq" } } }
    ]);
    return row?.max || 0;
};

/**
 * The matricule series the school already uses for this section - either
 * "BCHS-2025-2026-####" (matricule = "BCHS-2025-2026-0001") or the simpler
 * "MFS-2026-####" produced by services/matriculeService.js. Detecting it keeps
 * the mock data inside the real numbering instead of opening a second series.
 */
const detectExistingSeries = async () => {
    const [row] = await Student.aggregate([
        { $match: { section: SECTION, matricule: { $regex: "^[A-Za-z][A-Za-z0-9]*-[0-9-]*\\d-\\d+$" } } },
        { $project: { found: { $regexFind: { input: "$matricule", regex: "^(.+)-(\\d+)$" } } } },
        { $project: { series: { $toUpper: { $arrayElemAt: ["$found.captures", 0] } } } },
        { $match: { series: { $ne: null } } },
        { $group: { _id: "$series", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
    ]);
    return row ? { series: row._id, count: row.count } : null;
};


// ============================================================================
// Mock student builder
// ============================================================================
const buildStudentDocument = ({ sequence, series, enrollmentYear, schoolClass, recordedBy }) => {
    const gender = Math.random() < 0.5 ? "male" : "female";
    const surname = pick(SURNAMES);
    const givenName = gender === "male" ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
    const firstNames = Math.random() < 0.45 ? `${givenName} ${pick(MIDDLE_NAMES)}` : givenName;
    const parentGivenName = gender === "male" ? pick(FEMALE_NAMES) : pick(MALE_NAMES);

    const [minimumAge, maximumAge] = AGE_BY_LEVEL[schoolClass.className] || DEFAULT_AGE_RANGE;
    const age = randomInt(minimumAge, maximumAge);
    const dob = dayString(enrollmentYear - age, randomInt(1, 12), randomInt(1, 28));
    const registrationDate = dayString(enrollmentYear, pick([9, 9, 9, 10, 10, 11]), randomInt(2, 28));

    // ---- fees -------------------------------------------------------------
    const tuitionFee = Number(schoolClass.tuitionFee) || 0;
    const installments = Math.min(Math.max(1, Number(schoolClass.tuitionInstallments) || 1), 12);
    const registrationFeeAmount = schoolClass.registrationFeeRequired
        ? Number(schoolClass.registrationFeeAmount) || 0
        : 0;
    const profile = pickPaymentProfile();
    const perInstallment = installments > 0 ? Math.floor(tuitionFee / installments) : 0;

    let installmentsPaid = 0;
    let tuitionFeePaid = 0;
    if (profile.tuition === "full") {
        installmentsPaid = installments;
        tuitionFeePaid = tuitionFee;
    } else if (profile.tuition === "partial") {
        if (installments > 1) {
            installmentsPaid = randomInt(1, installments - 1);
            tuitionFeePaid = perInstallment * installmentsPaid;
        } else {
            tuitionFeePaid = Math.round(tuitionFee * pick([0.25, 0.5, 0.75]));
        }
    }
    const registrationFeePaid = profile.registration ? registrationFeeAmount : 0;

    const feePayments = [];
    for (let installment = 1; installment <= installmentsPaid; installment += 1) {
        const isLast = installment === installments;
        const amount = isLast ? tuitionFee - perInstallment * (installments - 1) : perInstallment;
        if (amount <= 0) continue;
        feePayments.push({
            feeType: "tuition",
            amount,
            installmentNumber: installment,
            paidAt: new Date(Date.UTC(enrollmentYear, Math.min(11, 8 + installment), randomInt(2, 27))),
            recordedBy
        });
    }
    if (registrationFeePaid > 0) {
        feePayments.push({
            feeType: "registration",
            amount: registrationFeePaid,
            installmentNumber: 1,
            paidAt: new Date(Date.UTC(enrollmentYear, 8, randomInt(2, 27))),
            recordedBy
        });
    }
    return {
        fullName: `${firstNames} ${surname}`,
        matricule: `${series}-${pad(sequence, 4)}`,
        enrollmentYear,
        gender,
        dob,
        classId: String(schoolClass._id),
        section: SECTION,
        department: schoolClass.department,
        parentName: `${surname} ${parentGivenName}`,
        parentPhone: `+2376${randomInt(5, 9)}${pad(randomInt(0, 9999999), 7)}`,
        address: `${pick(DOUALA_QUARTERS)}, Douala`,
        photoUrl: "",
        registrationDate,
        feesPaid: tuitionFeePaid + registrationFeePaid,
        feesDue: Math.max(0, tuitionFee - tuitionFeePaid + registrationFeeAmount - registrationFeePaid),
        tuitionFee,
        tuitionInstallments: installments,
        tuitionFeePaid,
        tuitionInstallmentsPaid: installmentsPaid,
        registrationFeeRequired: registrationFeeAmount > 0,
        registrationFeeAmount,
        registrationFeePaid,
        feePayments
    };
};

// ============================================================================
// Class rosters
// ============================================================================

/**
 * Recompute SchoolClass.studentCount for the given classes.
 * With `resize`, a class whose roster is bigger than its maxStudents is
 * enlarged (its previous value is returned so --wipe can restore it).
 */
const refreshClassRosters = async (classIds, { resize = false } = {}) => {
    if (!classIds.length) return { counts: new Map(), resized: [], previousMax: {} };

    const rows = await Student.aggregate([
        { $match: { classId: { $in: classIds } } },
        { $group: { _id: "$classId", count: { $sum: 1 } } }
    ]);
    const counts = new Map(rows.map((row) => [String(row._id), row.count]));

    const classDocs = await SchoolClass.find({ _id: { $in: classIds } }).select("maxStudents").lean();
    const previousMax = {};
    const resized = [];
    const operations = [];

    for (const classId of classIds) {
        const studentCount = counts.get(classId) || 0;
        const maximum = Number(classDocs.find((doc) => String(doc._id) === classId)?.maxStudents) || 0;
        previousMax[classId] = maximum;

        const update = { studentCount };
        if (resize && studentCount > maximum) {
            const raised = Math.max(maximum, Math.ceil(studentCount / 5) * 5);
            update.maxStudents = raised;
            resized.push({ classId, from: maximum, to: raised, studentCount });
        }
        operations.push({ updateOne: { filter: { _id: classId }, update: { $set: update } } });
    }

    await SchoolClass.bulkWrite(operations);
    return { counts, resized, previousMax };
};

// The manifest tracks every batch this script created so --wipe can undo them.
// It is keyed by database name: { databases: { DEMO: { runs: [...] } } }
const loadManifest = () => {
    if (!existsSync(MANIFEST_PATH)) return { databases: {} };
    try {
        const parsed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
        if (parsed && typeof parsed === "object" && parsed.databases) return parsed;
        return { databases: {} };
    } catch (error) {
        throw new Error(`The manifest ${MANIFEST_PATH} is unreadable: ${error.message}`);
    }
};

const saveManifest = (manifest) => {
    if (!Object.keys(manifest.databases).length) {
        if (existsSync(MANIFEST_PATH)) unlinkSync(MANIFEST_PATH);
        return;
    }
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
};

/** Append a run to the manifest, keeping the ORIGINAL capacity of each class. */
const recordRun = (manifest, run) => {
    const bucket = manifest.databases[run.database] || { runs: [], classIds: [] };
    const originalCapacity = new Map();
    for (const previousRun of bucket.runs) {
        for (const entry of previousRun.classResize || []) {
            if (!originalCapacity.has(entry.classId)) originalCapacity.set(entry.classId, entry.from);
        }
    }
    run.classResize = (run.classResize || []).map((entry) => ({
        ...entry,
        from: originalCapacity.has(entry.classId) ? originalCapacity.get(entry.classId) : entry.from
    }));
    bucket.runs.push(run);
    bucket.classIds = [...new Set([...(bucket.classIds || []), ...(run.classIds || [])])];
    manifest.databases[run.database] = bucket;
    return manifest;
};

// ============================================================================
// Wipe the students created by a previous run of this script
// ============================================================================
const wipeMockStudents = async (database) => {
    const manifest = loadManifest();
    const bucket = manifest.databases[database];
    if (!bucket || !bucket.runs.length) {
        console.log(`Nothing to wipe: no mock batch recorded for "${database}".`);
        return;
    }
    const students = bucket.runs.flatMap((run) => run.students || []);
    const ids = students.map((student) => student.id).filter(Boolean);
    const matricules = students.map((student) => student.matricule).filter(Boolean);
    const runs = bucket.runs
        .map((run) => `${new Date(run.createdAt).toLocaleString()} (${run.createdCount})`)
        .join(", ");

    console.log(`Mock batches recorded for "${database}": ${runs}`);
    console.log(`That is ${students.length} student(s) to delete.`);
    if (OPTIONS.dryRun) {
        console.log("Dry run: nothing was deleted.");
        return;
    }

    // deleteMany() also records the sync tombstones, so the deletions travel to
    // the offline mirror on the next synchronization.
    const result = await Student.deleteMany({ _id: { $in: ids }, matricule: { $in: matricules } });
    console.log(`Deleted ${result.deletedCount} mock students.`);

    // Put back the class capacities this script raised (original value first seen)
    const originalCapacity = new Map();
    for (const run of bucket.runs) {
        for (const entry of run.classResize || []) {
            if (!originalCapacity.has(entry.classId)) originalCapacity.set(entry.classId, entry.from);
        }
    }
    for (const [classId, maxStudents] of originalCapacity) {
        // eslint-disable-next-line no-await-in-loop
        await SchoolClass.updateOne({ _id: classId }, { $set: { maxStudents } });
    }
    const classIds = [...new Set([...(bucket.classIds || []), ...originalCapacity.keys()])];
    await refreshClassRosters(classIds, { resize: false });
    console.log(`Rosters recalculated for ${classIds.length} classes.`);

    // Put the matricule counters back in step with the database: after the
    // deletion the highest number still in use is the right counter value, so
    // the next real student resumes exactly where the school had stopped.
    const seriesToFix = new Set(bucket.runs.map((run) => run.seriesKey || (run.series ? `matricule:${run.series}` : null)).filter(Boolean));
    for (const key of seriesToFix) {
        const remaining = await highestInSeries(key.replace(/^matricule:/i, ""));
        // eslint-disable-next-line no-await-in-loop
        await Counter.updateOne({ key }, { $set: { seq: remaining } }, { upsert: true });
        console.log(`Counter "${key}" set back to ${remaining} (next student: ${remaining + 1}).`);
    }

    delete manifest.databases[database];
    saveManifest(manifest);
    console.log("Mock batches cleared - the database is back to its pre-mock state.");
};

// ============================================================================
// Main
// ============================================================================
const formatMoney = (value) => `${Math.round(value).toLocaleString("en-US")} FCFA`;
const report = (label, value) => console.log(`   ${label.padEnd(17)}: ${value}`);

const accumulateStats = (stats, doc) => {
    stats.billed += (doc.tuitionFee || 0) + (doc.registrationFeeAmount || 0);
    stats.collected += doc.feesPaid || 0;
    if (!doc.feesPaid) stats.unpaid += 1;
    else if (!doc.feesDue) stats.cleared += 1;
    else stats.partial += 1;
};

async function main() {
    const uri = await connectUri();
    await mongoose.connect(uri, CONNECT_OPTIONS);
    const database = mongoose.connection.name;
    console.log(`Connected to the ${OPTIONS.useOffline ? "LOCAL" : "ATLAS"} database "${database}".`);

    if (OPTIONS.wipe) {
        await wipeMockStudents(database);
        await mongoose.disconnect();
        return;
    }

    const { academicYear, classes } = await loadTargetClasses();
    // Everything this script creates belongs to one section, so the target is
    // measured on that section (what the app's "Students" screen lists).
    // `--count=N` bypasses the calculation and adds exactly N students.
    const studentsBefore = await Student.countDocuments({ section: SECTION });
    const databaseBefore = await Student.countDocuments({});
    const toCreate = OPTIONS.count ?? Math.max(0, OPTIONS.total - studentsBefore);

    // Continue the matricule series the school already uses (detected on the
    // students of this section) so the mock data blends into the real
    // numbering instead of opening a second, parallel series.
    const detected = await detectExistingSeries();
    const academicStartYear = Number(String(academicYear).slice(0, 4)) || new Date().getFullYear();
    const defaultSeries = `${getMatriculePrefix()}-${academicStartYear}`;
    const series = OPTIONS.series ? OPTIONS.series.toUpperCase() : (detected?.series || defaultSeries);
    const enrollmentYear = academicStartYear;
    const seriesKey = `matricule:${series}`;
    const seriesSource = OPTIONS.series
        ? "forced from the command line"
        : detected
            ? `detected on ${detected.count} existing student(s)`
            : `new series (no matricule found; MATRICULE_PREFIX=${getMatriculePrefix()})`;
    const counter = await Counter.findOne({ key: seriesKey }).lean();
    const highestExisting = await highestInSeries(series);
    const startSequence = Math.max(Number(counter?.seq) || 0, highestExisting);

    console.log("");
    console.log("Plan");
    report("target", OPTIONS.count === null ? `${OPTIONS.total} students in section "${SECTION}"` : `${OPTIONS.count} new students`);
    report("database mode", OPTIONS.dryRun ? "DRY RUN (nothing is written)" : OPTIONS.useOffline ? "offline mirror" : "online (Atlas)");
    report("academic year", academicYear);
    report("classes used", classes.length);
    report("students before", `${studentsBefore} in section "${SECTION}" (${databaseBefore} in the database)`);
    report("students to add", toCreate);
    report("matricule series", `${series}-#### (resuming after ${startSequence})`);
    report("series source", seriesSource);
    console.log("");

    if (toCreate <= 0) {
        console.log(`Nothing to do: section "${SECTION}" already holds ${studentsBefore} students (target ${OPTIONS.total}).`);
        console.log("Use --count=N to add students anyway, or --total=N for a bigger target.");
        await mongoose.disconnect();
        return;
    }

    if (OPTIONS.dryRun) {
        const sample = spreadOverClasses(classes, Math.min(3, toCreate));
        sample.forEach((classIndex, index) => {
            console.log(JSON.stringify(buildStudentDocument({
                sequence: startSequence + index + 1,
                series,
                enrollmentYear,
                schoolClass: classes[classIndex],
                recordedBy: "dry-run"
            }), null, 2));
        });
        console.log("Dry run finished: no student was written.");
        await mongoose.disconnect();
        return;
    }
    // Whoever is on duty at the bursar's desk is credited with the payments
    const admin = await User.findOne({ role: "admin", section: SECTION }).select("username name").lean()
        || await User.findOne({ role: "admin" }).select("username name").lean();
    const recordedBy = admin?.username || admin?.name || "admin01";

    const plan = spreadOverClasses(classes, toCreate);
    const created = [];
    const skipped = [];
    const stats = { cleared: 0, partial: 0, unpaid: 0, billed: 0, collected: 0 };
    let sequence = startSequence;

    for (let offset = 0; offset < plan.length; offset += OPTIONS.batchSize) {
        const slice = plan.slice(offset, offset + OPTIONS.batchSize);
        const documents = slice.map((classIndex) => {
            sequence += 1;
            return buildStudentDocument({
                sequence,
                series,
                enrollmentYear,
                schoolClass: classes[classIndex],
                recordedBy
            });
        });

        try {
            const inserted = await Student.insertMany(documents, { ordered: false });
            for (const doc of inserted) {
                created.push({ id: String(doc._id), matricule: doc.matricule });
                accumulateStats(stats, doc);
            }
        } catch (error) {
            // One duplicate inside a batch makes insertMany throw: fall back to
            // one-by-one so the rest of the batch is still saved.
            for (const document of documents) {
                try {
                    const [doc] = await Student.insertMany([document], { ordered: false });
                    created.push({ id: String(doc._id), matricule: doc.matricule });
                    accumulateStats(stats, doc);
                } catch (innerError) {
                    skipped.push({
                        matricule: document.matricule,
                        reason: innerError?.code === 11000 ? "already in the database" : innerError.message
                    });
                }
            }
        }
        process.stdout.write(`\r  Inserting ${created.length + skipped.length} / ${plan.length} students...`);
    }
    process.stdout.write("\n");

    // Keep the class rosters (and, if needed, the capacities) in sync
    const classIds = [...new Set(classes.map((schoolClass) => String(schoolClass._id)))];
    const { resized } = await refreshClassRosters(classIds, { resize: OPTIONS.resizeCapacity });

    // Make sure the app's counter continues after the matricules we just used
    const maxCreatedSequence = created.reduce((max, entry) => {
        const digits = String(entry.matricule).match(/(\d+)\s*$/);
        return Math.max(max, digits ? Number(digits[1]) : 0);
    }, 0);
    if (maxCreatedSequence) await Counter.atLeast(seriesKey, maxCreatedSequence);
    // The manifest lets --wipe delete exactly what this script created, even
    // when it is run several times (each run is appended to the same file).
    const manifest = loadManifest();
    recordRun(manifest, {
        createdAt: new Date().toISOString(),
        database,
        mode: OPTIONS.useOffline ? "offline" : "online",
        academicYear,
        series,
        enrollmentYear,
        seriesKey,
        requested: toCreate,
        createdCount: created.length,
        skipped,
        classIds,
        classResize: resized,
        students: created
    });
    saveManifest(manifest);

    const studentsAfter = await Student.countDocuments({ section: SECTION });
    const databaseAfter = await Student.countDocuments({});
    const [duplicates] = await Student.aggregate([
        { $group: { _id: "$matricule", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: "duplicateMatricules" }
    ]);

    console.log("");
    console.log("Done");
    report("students before", `${studentsBefore} in section "${SECTION}"`);
    report("students added", created.length);
    report("students now", `${studentsAfter} in section "${SECTION}" (${databaseAfter} in the database)`);
    report("classes updated", classIds.length);
    report(
        "class capacity",
        OPTIONS.resizeCapacity && resized.length
            ? `${resized.length} class(es) enlarged to hold their new roster`
            : "left untouched"
    );
    report("fee mix (mock)", `${stats.cleared} cleared, ${stats.partial} partially paid, ${stats.unpaid} unpaid`);
    report("billed / paid", `${formatMoney(stats.billed)} billed / ${formatMoney(stats.collected)} collected`);
    report("next matricule", `${series}-${pad(maxCreatedSequence + 1, 4)}`);
    report(
        "duplicate check",
        duplicates ? `${duplicates.duplicateMatricules} duplicated matricule(s) - investigate` : "none"
    );
    if (skipped.length) report("skipped", `${skipped.length} (listed in the manifest)`);
    report("manifest", "scripts/mock-students-5k.manifest.json (required by --wipe)");
    console.log("");
    console.log("Open the app on the Students screen to see them.");
    console.log("Undo everything with: node scripts/seed-5000-students.mjs --wipe");

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error("Seeding failed:", error.message);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});








