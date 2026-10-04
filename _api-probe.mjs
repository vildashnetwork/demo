// Temporary probe for the paginated GET /students endpoint.
import fs from "node:fs";

const BASE = "http://localhost:5000/api";
const lines = [];

const probe = async (label, qs) => {
    const started = Date.now();
    try {
        const res = await fetch(`${BASE}/students?${qs}`);
        const json = await res.json();
        const ms = Date.now() - started;
        const rows = Array.isArray(json.data) ? json.data : [];
        lines.push(
            `${label.padEnd(22)} status=${res.status} count=${json.count} total=${json.total} page=${json.page}/${json.pages} limit=${json.limit} ms=${ms} first=${rows[0]?.fullName ?? "-"} last=${rows.at(-1)?.fullName ?? "-"}`
        );
        return json;
    } catch (error) {
        lines.push(`${label.padEnd(22)} ERROR ${error.message}`);
        return null;
    }
};

const first = await probe("page2/limit3", "section=englophone&page=2&limit=3");
await probe("page1/limit50", "section=englophone&page=1&limit=50");
await probe("page1/limit200", "section=englophone&page=1&limit=200");
await probe("search 'mar'", "section=englophone&page=1&limit=5&search=mar");
await probe("feeStatus=paid", "section=englophone&page=1&limit=5&feeStatus=paid");
await probe("feeStatus=owing", "section=englophone&page=1&limit=5&feeStatus=owing");
await probe("feeStatus=partial", "section=englophone&page=1&limit=5&feeStatus=partial");
await probe("feeStatus=paid+search", "section=englophone&page=1&limit=5&feeStatus=paid&search=a");
const classId = first?.data?.[0]?.classId;
if (classId) await probe("classId filter", `section=englophone&page=1&limit=5&classId=${classId}`);
await probe("out-of-range page", "section=englophone&page=9999&limit=50");
await probe("legacy (no page)", "section=englophone");

fs.writeFileSync("api-report.txt", lines.join("\n") + "\n");
console.log(lines.join("\n"));
