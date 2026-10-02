import express from "express";
import mongoose from "mongoose";
import Student from "../models/Students.js";
import SchoolClass from "../models/SchoolClass.js";
import {
    generateMatricule,
    previewMatricule,
    backfillMatricules,
    auditMatricules,
    getMatriculePrefix,
    enrollmentYearOf
} from "../services/matriculeService.js";

const router = express.Router();

/**
 * Clean the matricule coming from an update payload:
 * - an empty value is dropped (the student keeps the number he already has)
 * - a value already used by another student is rejected
 * @param {object} studentData the update payload
 * @param {string} [ignoreId] id of the student being updated
 * @returns {{payload: object, conflict?: {fullName: string, _id: any}}}
 */
const sanitizeMatriculePayload = async (studentData = {}, ignoreId = null) => {
    const payload = { ...studentData };
    if (!Object.prototype.hasOwnProperty.call(payload, "matricule")) return { payload };

    const value = payload.matricule ? String(payload.matricule).trim().toUpperCase() : "";
    if (!value) {
        delete payload.matricule;
        return { payload };
    }
    payload.matricule = value;

    const filter = { matricule: value };
    if (ignoreId) filter._id = { $ne: ignoreId };

    const conflict = await Student.findOne(filter).select("_id fullName").lean();
    if (conflict) return { payload, conflict };
    return { payload };
};


// ==================== GET ROUTES ====================

// GET all students
router.get("/students", async (req, res) => {
    try {
        const records = await Student.find().sort({ fullName: 1 }).lean();
        const students = records.map((student) => ({
            ...student,
            admissionNumber: student.matricule || ""
        }));
        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching students",
            error: error.message
        });
    }
});
// GET - matricule series info: prefix, the number the next student will get
// and how many students still have to be numbered. MUST stay declared before
// "/students/:id" (express matches in declaration order).
router.get("/students/next-matricule", async (req, res) => {
    try {
        const preview = await previewMatricule({
            enrollmentYear: req.query.enrollmentYear,
            registrationDate: req.query.registrationDate
        });
        res.status(200).json({ success: true, data: preview });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error previewing the next matricule", error: error.message });
    }
});

// GET - matricule health: prefix, coverage of the existing students
router.get("/students/matricule-info", async (req, res) => {
    try {
        const [withMatricule, withoutMatricule] = await Promise.all([
            Student.countDocuments({ matricule: { $nin: [null, ""] } }),
            Student.countDocuments({ $or: [{ matricule: null }, { matricule: "" }] })
        ]);

        const preview = await previewMatricule({ registrationDate: req.query.registrationDate });

        res.status(200).json({
            success: true,
            data: {
                prefix: getMatriculePrefix(),
                nextMatricule: preview.matricule,
                studentsWithMatricule: withMatricule,
                studentsWithoutMatricule: withoutMatricule
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching matricule info", error: error.message });
    }
});

// GET - a student by his matricule (exact match, then partial match)
router.get("/students/by-matricule/:matricule", async (req, res) => {
    try {
        const value = String(req.params.matricule || "").trim().toUpperCase();
        if (!value) {
            return res.status(400).json({ success: false, message: "A matricule is required" });
        }

        const exact = await Student.findOne({ matricule: value }).lean();
        if (exact) return res.status(200).json({ success: true, count: 1, data: exact });

        const partial = await Student.find({ matricule: { $regex: value, $options: "i" } })
            .sort({ matricule: 1 })
            .limit(20)
            .lean();

        if (!partial.length) {
            return res.status(404).json({ success: false, message: `No student with matricule ${value}` });
        }
        return res.status(200).json({ success: true, count: partial.length, data: partial });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error searching the matricule", error: error.message });
    }
});


// GET a single student by ID
router.get("/students/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID format"
            });
        }

        const student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        res.status(200).json({
            success: true,
            data: student
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching student",
            error: error.message
        });
    }
});

// GET students by gender
router.get("/students/gender/:gender", async (req, res) => {
    try {
        const { gender } = req.params;
        const students = await Student.find({ gender }).sort({ fullName: 1 });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching students by gender",
            error: error.message
        });
    }
});

// GET students by class ID
router.get("/students/class/:classId", async (req, res) => {
    try {
        const { classId } = req.params;
        const students = await Student.find({ classId }).sort({ fullName: 1 });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching students by class",
            error: error.message
        });
    }
});

// GET students by department
router.get("/students/department/:department", async (req, res) => {
    try {
        const { department } = req.params;
        const students = await Student.find({ department }).sort({ fullName: 1 });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching students by department",
            error: error.message
        });
    }
});

// GET students by parent phone
router.get("/students/parent-phone/:parentPhone", async (req, res) => {
    try {
        const { parentPhone } = req.params;
        const students = await Student.find({ parentPhone });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching students by parent phone",
            error: error.message
        });
    }
});

// GET students with outstanding fees
router.get("/students/outstanding-fees", async (req, res) => {
    try {
        const students = await Student.find({
            feesDue: { $gt: 0 }
        }).sort({ feesDue: -1 });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching students with outstanding fees",
            error: error.message
        });
    }
});

// GET students with fully paid fees
router.get("/students/fully-paid", async (req, res) => {
    try {
        const students = await Student.find({
            feesDue: 0
        }).sort({ fullName: 1 });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching students with fully paid fees",
            error: error.message
        });
    }
});

// GET search students by name or matricule
router.get("/students/search/:name", async (req, res) => {
    try {
        const { name } = req.params;
        const students = await Student.find({
            $or: [
                { fullName: { $regex: name, $options: 'i' } },
                { matricule: { $regex: name, $options: 'i' } }
            ]
        }).sort({ fullName: 1 });

        res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error searching students",
            error: error.message
        });
    }
});

// GET student statistics
router.get("/students/stats/summary", async (req, res) => {
    try {
        const students = await Student.find();

        const genderCount = { male: 0, female: 0 };
        const classCount = {};
        const departmentCount = {};

        students.forEach(student => {
            if (student.gender === 'male') genderCount.male++;
            else if (student.gender === 'female') genderCount.female++;

            classCount[student.classId] = (classCount[student.classId] || 0) + 1;
            departmentCount[student.department] = (departmentCount[student.department] || 0) + 1;
        });

        const totalFeesPaid = students.reduce((sum, student) => sum + student.feesPaid, 0);
        const totalFeesDue = students.reduce((sum, student) => sum + student.feesDue, 0);
        const studentsWithOutstandingFees = students.filter(s => s.feesDue > 0).length;
        const fullyPaidStudents = students.filter(s => s.feesDue === 0).length;

        res.status(200).json({
            success: true,
            data: {
                totalStudents: students.length,
                genderDistribution: genderCount,
                classDistribution: classCount,
                departmentDistribution: departmentCount,
                feeSummary: {
                    totalFeesCollected: totalFeesPaid,
                    totalFeesOutstanding: totalFeesDue,
                    studentsWithOutstandingFees,
                    fullyPaidStudents
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching student statistics",
            error: error.message
        });
    }
});

// ==================== POST ROUTES ====================

// POST - Create a new student (NO DUPLICATE CHECK)
router.post("/students", async (req, res) => {
    try {
        const studentData = req.body;

        const schoolClass = await SchoolClass.findById(studentData.classId);
        if (!schoolClass) {
            return res.status(400).json({ success: false, message: "Select a valid class before enrolling the student" });
        }
        if (schoolClass.className !== "Graduated" && Number(schoolClass.tuitionFee) <= 0) {
            return res.status(400).json({ success: false, message: "Configure tuition for this class before enrolling students" });
        }
        const tuitionPaid = Number(studentData.tuitionFeePaid ?? studentData.feesPaid) || 0;
        const registrationFeeRequired = Boolean(schoolClass.registrationFeeRequired);
        const registrationFeeAmount = registrationFeeRequired ? Number(schoolClass.registrationFeeAmount) || 0 : 0;
        const registrationPaid = Number(studentData.registrationFeePaid) || 0;
        if (tuitionPaid > Number(schoolClass.tuitionFee) || registrationPaid > registrationFeeAmount) {
            return res.status(400).json({ success: false, message: "Initial payments cannot exceed the configured class fees" });
        }
        Object.assign(studentData, {
            tuitionFee: Number(schoolClass.tuitionFee) || 0,
            tuitionInstallments: Number(schoolClass.tuitionInstallments) || 1,
            tuitionFeePaid: tuitionPaid,
            tuitionInstallmentsPaid: Number(studentData.tuitionInstallmentsPaid) || 0,
            registrationFeeRequired,
            registrationFeeAmount,
            registrationFeePaid: registrationPaid,
            feesPaid: tuitionPaid + registrationPaid,
            feesDue: Math.max(0, Number(schoolClass.tuitionFee) - tuitionPaid + registrationFeeAmount - registrationPaid),
        });

        // NO DUPLICATE CHECK - Students can have the same name and parent phone
        // (Siblings can have same parent phone, different students can have same name)

        const student = new Student(studentData);
        await student.save();

        res.status(201).json({
            success: true,
            message: "Student created successfully",
            data: student
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: errors
            });
        }

        // A matricule supplied by the client is already taken
        if (error.name === "DuplicateMatricule") {
            return res.status(409).json({
                success: false,
                message: error.message,
                matricule: error.matricule,
                conflict: error.conflict
            });
        }

        res.status(500).json({
            success: false,
            message: "Error creating student",
            error: error.message
        });
    }
});

// POST - Create multiple students (bulk insert)
router.post("/students/bulk", async (req, res) => {
    try {
        const studentsData = req.body;

        if (!Array.isArray(studentsData)) {
            return res.status(400).json({
                success: false,
                message: "Expected an array of students"
            });
        }

        // Validate each student
        const validationErrors = [];
        const validStudents = [];

        studentsData.forEach((student, index) => {
            const requiredFields = [
                'fullName', 'gender', 'dob', 'classId', 'department',
                'parentName', 'parentPhone', 'address', 'registrationDate',
                'feesPaid', 'feesDue'
            ];
            const missingFields = requiredFields.filter((field) => {
                const value = student[field];
                return value === undefined || value === null || (typeof value === "string" && !value.trim());
            });

            if (missingFields.length > 0) {
                validationErrors.push({
                    index,
                    student,
                    error: `Missing required fields: ${missingFields.join(', ')}`
                });
            } else {
                validStudents.push(student);
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation errors in some students",
                errors: validationErrors
            });
        }

        // insertMany() does NOT run the "save" middleware, so the matricules
        // have to be reserved explicitly here.
        const numberedStudents = [];
        for (const data of validStudents) {
            const payload = { ...data };
            const schoolClass = await SchoolClass.findById(payload.classId);
            if (!schoolClass) {
                return res.status(400).json({ success: false, message: `Invalid class for ${payload.fullName}` });
            }
            if (schoolClass.className !== "Graduated" && Number(schoolClass.tuitionFee) <= 0) {
                return res.status(400).json({ success: false, message: `Configure tuition for ${schoolClass.className} before bulk enrollment` });
            }
            const tuitionPaid = Number(payload.tuitionFeePaid ?? payload.feesPaid) || 0;
            const registrationFeeRequired = Boolean(schoolClass.registrationFeeRequired);
            const registrationFeeAmount = registrationFeeRequired ? Number(schoolClass.registrationFeeAmount) || 0 : 0;
            const registrationPaid = Number(payload.registrationFeePaid) || 0;
            Object.assign(payload, {
                tuitionFee: Number(schoolClass.tuitionFee) || 0,
                tuitionInstallments: Number(schoolClass.tuitionInstallments) || 1,
                tuitionFeePaid: tuitionPaid,
                tuitionInstallmentsPaid: Number(payload.tuitionInstallmentsPaid) || 0,
                registrationFeeRequired,
                registrationFeeAmount,
                registrationFeePaid: registrationPaid,
                feesPaid: tuitionPaid + registrationPaid,
                feesDue: Math.max(0, Number(schoolClass.tuitionFee) - tuitionPaid + registrationFeeAmount - registrationPaid),
            });
            if (!payload.enrollmentYear) payload.enrollmentYear = enrollmentYearOf(payload);
            if (!payload.matricule) {
                // eslint-disable-next-line no-await-in-loop
                payload.matricule = await generateMatricule(payload);
            }
            numberedStudents.push(payload);
        }

        const createdStudents = await Student.insertMany(numberedStudents);

        res.status(201).json({
            success: true,
            message: `${createdStudents.length} students created successfully`,
            data: createdStudents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error creating students in bulk",
            error: error.message
        });
    }
});

// POST - Record fee payment
router.post("/students/:id/pay-fees", async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, feeType = "tuition", installmentNumber, recordedBy = "admin" } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID format"
            });
        }

        if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid payment amount"
            });
        }
        if (!["tuition", "registration"].includes(feeType)) {
            return res.status(400).json({ success: false, message: "Payment type must be tuition or registration" });
        }

        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const paymentAmount = Number(amount);
        const schoolClass = await SchoolClass.findById(student.classId);
        const tuitionFee = Number(student.tuitionFee ?? schoolClass?.tuitionFee ?? (student.feesPaid + student.feesDue));
        const installmentCount = Number(student.tuitionInstallments ?? schoolClass?.tuitionInstallments ?? 1);
        const registrationRequired = Boolean(student.registrationFeeRequired ?? schoolClass?.registrationFeeRequired);
        const registrationFeeAmount = registrationRequired
            ? Number(student.registrationFeeAmount ?? schoolClass?.registrationFeeAmount ?? 0)
            : 0;
        let tuitionPaid = student.tuitionFeePaid == null
            ? Number(student.feesPaid) || 0
            : Number(student.tuitionFeePaid) || 0;
        let installmentsPaid = Number(student.tuitionInstallmentsPaid) || 0;
        let registrationPaid = Number(student.registrationFeePaid) || 0;
        let installment = null;

        if (feeType === "registration") {
            if (!registrationRequired || registrationFeeAmount <= 0) {
                return res.status(400).json({ success: false, message: "This class does not require a registration fee" });
            }
            const registrationDue = Math.max(0, registrationFeeAmount - registrationPaid);
            if (paymentAmount > registrationDue) {
                return res.status(400).json({ success: false, message: `Registration payment exceeds the remaining ${registrationDue} XAF` });
            }
            registrationPaid += paymentAmount;
        } else {
            if (registrationRequired && registrationPaid < registrationFeeAmount) {
                return res.status(400).json({ success: false, message: "Pay the required registration fee before tuition installments" });
            }
            if (installmentsPaid >= installmentCount) {
                return res.status(400).json({ success: false, message: "All tuition installments are already paid" });
            }
            installment = installmentsPaid + 1;
            if (installmentNumber && Number(installmentNumber) !== installment) {
                return res.status(400).json({ success: false, message: `The next tuition payment is installment ${installment}` });
            }
            const remainingTuition = Math.max(0, tuitionFee - tuitionPaid);
            const expectedAmount = installment === installmentCount
                ? remainingTuition
                : Math.min(remainingTuition, Math.round((tuitionFee / installmentCount) * 100) / 100);
            if (Math.abs(paymentAmount - expectedAmount) > 0.01) {
                return res.status(400).json({ success: false, message: `Installment ${installment} must be ${expectedAmount.toLocaleString()} XAF` });
            }
            tuitionPaid += paymentAmount;
            installmentsPaid += 1;
        }

        student.tuitionFee = tuitionFee;
        student.tuitionInstallments = installmentCount;
        student.tuitionFeePaid = tuitionPaid;
        student.tuitionInstallmentsPaid = installmentsPaid;
        student.registrationFeeRequired = registrationRequired;
        student.registrationFeeAmount = registrationFeeAmount;
        student.registrationFeePaid = registrationPaid;
        student.feesPaid = tuitionPaid + registrationPaid;
        student.feesDue = Math.max(0, (tuitionFee - tuitionPaid) + (registrationFeeAmount - registrationPaid));
        student.feePayments.push({
            feeType,
            amount: paymentAmount,
            installmentNumber: installment,
            recordedBy: String(recordedBy),
        });

        await student.save();

        res.status(200).json({
            success: true,
            message: "Fee payment recorded successfully",
            data: {
                student: student,
                paymentAmount: paymentAmount,
                feeType,
                installmentNumber: installment,
                newBalance: student.feesDue
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error processing fee payment",
            error: error.message
        });
    }
});
// POST - give a matricule to every student that does not have one yet
// body: { dryRun?: boolean }
router.post("/students/backfill-matricules", async (req, res) => {
    try {
        const dryRun = req.body?.dryRun === true || req.query.dryRun === "true";
        const result = await backfillMatricules({ dryRun });

        res.status(200).json({
            success: true,
            message: dryRun
                ? `${result.assigned} student(s) would receive a matricule`
                : `${result.assigned} matricule(s) generated`,
            data: result
        });
    } catch (error) {
        console.error("Error backfilling matricules:", error);
        res.status(500).json({ success: false, message: "Error generating the missing matricules", error: error.message });
    }
});

// POST - check the matricule series; body: { fix?: boolean } re-issues the
// duplicates and fills the missing numbers.
router.post("/students/audit-matricules", async (req, res) => {
    try {
        const fix = req.body?.fix === true || req.query.fix === "true";
        const result = await auditMatricules({ fix });

        res.status(200).json({
            success: true,
            message: fix
                ? `Matricules repaired (${result.reassigned.length} reassigned, ${result.backfilled} generated)`
                : `${result.missing.length} student(s) without matricule, ${result.duplicates.length} duplicate(s)`,
            data: result
        });
    } catch (error) {
        console.error("Error auditing matricules:", error);
        res.status(500).json({ success: false, message: "Error auditing the matricules", error: error.message });
    }
});

// POST - (re)assign the matricule of one student
// body: { force?: boolean } — without force, an existing matricule is kept.
router.post("/students/:id/assign-matricule", async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.body?.force === true;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid student ID format" });
        }

        const student = await Student.findById(id);
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });

        if (student.matricule && !force) {
            return res.status(200).json({
                success: true,
                message: "Student already has a matricule",
                data: student
            });
        }

        student.enrollmentYear = enrollmentYearOf(student);
        student.matricule = await generateMatricule(student);
        await student.save();

        res.status(200).json({
            success: true,
            message: `Matricule ${student.matricule} assigned to ${student.fullName}`,
            data: student
        });
    } catch (error) {
        console.error("Error assigning a matricule:", error);
        res.status(500).json({ success: false, message: "Error assigning the matricule", error: error.message });
    }
});


// ==================== PUT ROUTES ====================

// PUT - Update an entire student (NO DUPLICATE CHECK)
// PUT - Update an entire student
router.put("/students/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const studentData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID format"
            });
        }

        const existingStudent = await Student.findById(id);
        if (!existingStudent) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        // Keep the matricule safe: an empty value never erases it, and a value
        // already used by another student is rejected.
        const { payload, conflict } = await sanitizeMatriculePayload(studentData, id);
        if (conflict) {
            return res.status(409).json({
                success: false,
                message: `Matricule ${payload.matricule} is already used by ${conflict.fullName}`,
                matricule: payload.matricule,
                conflict
            });
        }

        // Self-heal: a student created before the matricule series receives
        // his number the first time his record is edited.
        if (!payload.matricule && !existingStudent.matricule) {
            payload.enrollmentYear = payload.enrollmentYear || enrollmentYearOf(existingStudent);
            payload.matricule = await generateMatricule(payload);
        }

        if (payload.classId) {
            const schoolClass = await SchoolClass.findById(payload.classId);
            if (!schoolClass) {
                return res.status(400).json({ success: false, message: "Select a valid class" });
            }
            if (schoolClass.className !== "Graduated" && Number(schoolClass.tuitionFee) <= 0) {
                return res.status(400).json({ success: false, message: "Configure tuition for this class before assigning students" });
            }
            const tuitionPaid = existingStudent.tuitionFeePaid == null
                ? Number(existingStudent.feesPaid) || 0
                : Number(existingStudent.tuitionFeePaid) || 0;
            const registrationFeeRequired = Boolean(schoolClass.registrationFeeRequired);
            const registrationFeeAmount = registrationFeeRequired ? Number(schoolClass.registrationFeeAmount) || 0 : 0;
            const registrationPaid = Number(existingStudent.registrationFeePaid) || 0;
            payload.tuitionFee = Number(schoolClass.tuitionFee) || 0;
            payload.tuitionInstallments = Number(schoolClass.tuitionInstallments) || 1;
            payload.tuitionFeePaid = tuitionPaid;
            payload.tuitionInstallmentsPaid = Number(existingStudent.tuitionInstallmentsPaid) || 0;
            payload.registrationFeeRequired = registrationFeeRequired;
            payload.registrationFeeAmount = registrationFeeAmount;
            payload.registrationFeePaid = registrationPaid;
            payload.feesPaid = tuitionPaid + registrationPaid;
            payload.feesDue = Math.max(0, payload.tuitionFee - tuitionPaid + registrationFeeAmount - registrationPaid);
        }

        const updatedStudent = await Student.findByIdAndUpdate(
            id,
            payload,
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: "Student updated successfully",
            data: updatedStudent
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: errors
            });
        }

        res.status(500).json({
            success: false,
            message: "Error updating student",
            error: error.message
        });
    }
});

// ==================== PATCH ROUTES ====================

// PATCH - Partially update a student (NO DUPLICATE CHECK)
router.patch("/students/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const studentData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID format"
            });
        }

        const existingStudent = await Student.findById(id);
        if (!existingStudent) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        // NO DUPLICATE CHECK - Students can have same name and parent phone
        // (the matricule, however, must stay unique)
        const { payload, conflict } = await sanitizeMatriculePayload(studentData, id);
        if (conflict) {
            return res.status(409).json({
                success: false,
                message: `Matricule ${payload.matricule} is already used by ${conflict.fullName}`,
                matricule: payload.matricule,
                conflict
            });
        }

        if (!payload.matricule && !existingStudent.matricule) {
            payload.enrollmentYear = payload.enrollmentYear || enrollmentYearOf(existingStudent);
            payload.matricule = await generateMatricule(payload);
        }

        const updatedStudent = await Student.findByIdAndUpdate(
            id,
            payload,
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: "Student updated successfully",
            data: updatedStudent
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: errors
            });
        }

        res.status(500).json({
            success: false,
            message: "Error updating student",
            error: error.message
        });
    }
});

// PATCH - Update student's class
router.patch("/students/:id/update-class", async (req, res) => {
    try {
        const { id } = req.params;
        const { classId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID format"
            });
        }

        if (!classId) {
            return res.status(400).json({
                success: false,
                message: "classId is required"
            });
        }

        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        student.classId = classId;
        await student.save();

        res.status(200).json({
            success: true,
            message: "Student's class updated successfully",
            data: student
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating student's class",
            error: error.message
        });
    }
});

// PATCH - Update student's photo
router.patch("/students/:id/update-photo", async (req, res) => {
    try {
        const { id } = req.params;
        const { photoUrl } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID format"
            });
        }

        if (!photoUrl) {
            return res.status(400).json({
                success: false,
                message: "photoUrl is required"
            });
        }

        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        student.photoUrl = photoUrl;
        await student.save();

        res.status(200).json({
            success: true,
            message: "Student's photo updated successfully",
            data: student
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating student's photo",
            error: error.message
        });
    }
});

// ==================== DELETE ROUTES ====================

// DELETE - Delete a student
router.delete("/students/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID format"
            });
        }

        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        await Student.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Student deleted successfully",
            data: student
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting student",
            error: error.message
        });
    }
});

// DELETE - Delete all students from a class
router.delete("/students/class/:classId", async (req, res) => {
    try {
        const { classId } = req.params;
        const result = await Student.deleteMany({ classId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "No students found for this class"
            });
        }

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} students deleted from class ${classId}`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting students by class",
            error: error.message
        });
    }
});

// DELETE - Delete all students (use with extreme caution)
router.delete("/students", async (req, res) => {
    try {
        const result = await Student.deleteMany({});

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} students deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting all students",
            error: error.message
        });
    }
});

export default router;