// Temporary: compare eslint results of the committed Students.tsx with the
// edited one, so we know whether any finding is pre-existing.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const TEMP = "frontend/src/pages/_OrigStudents.tsx";

// Raw bytes (PowerShell redirection would re-encode the file).
const originalBytes = execFileSync("git", ["show", "HEAD:frontend/src/pages/Students.tsx"], { maxBuffer: 20 * 1024 * 1024 });
fs.writeFileSync(TEMP, originalBytes);

const runEslint = (file) => {
    const args = ["eslint", file, "--format", "json"];
    try {
        return JSON.parse(execFileSync("npx", args, { cwd: "frontend", maxBuffer: 64 * 1024 * 1024, shell: true }).toString());
    } catch (error) {
        try {
            return JSON.parse(String(error.stdout || "[]"));
        } catch {
            return [];
        }
    }
};

const summarize = (report) => {
    const counts = {};
    for (const file of report) {
        for (const msg of file.messages) {
            const key = `${msg.severity === 2 ? "error" : "warning"} :: ${msg.ruleId || (msg.fatal ? "FATAL-PARSE" : "unknown")}`;
            counts[key] = (counts[key] || 0) + 1;
        }
    }
    return counts;
};

const before = summarize(runEslint("src/pages/_OrigStudents.tsx"));
const after = summarize(runEslint("src/pages/Students.tsx"));

fs.writeFileSync("eslint-compare.txt", [
    `HEAD (original) : ${JSON.stringify(before)}`,
    `WORKING (edited): ${JSON.stringify(after)}`
].join("\n"));
console.log("done");
