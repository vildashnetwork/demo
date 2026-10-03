#!/usr/bin/env python3
"""Generate a source-aware BCHS DOUALA user manual as a Word document.

Run from any directory with:
    python generate_user_manual.py

The output is written to User_Manual.docx beside this script. The generator
uses the frontend navigation and route declarations for its role/tab matrix,
and scans backend route files for the technical appendix.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

try:
    from docx import Document
    from docx.enum.section import WD_SECTION
    from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt, RGBColor
except ImportError as exc:
    raise SystemExit(
        "The Word document library is missing. Install it once with "
        "'python -m pip install python-docx', then rerun this script."
    ) from exc


ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend" / "src"
BACKEND = ROOT / "backend"
OUTPUT = ROOT / "User_Manual.docx"
BRAND = "155DAA"
INK = "17202B"
MUTED = "5B6573"
PALE_BLUE = "EAF2FB"
PALE_GRAY = "F3F6F9"


TAB_GUIDE = {
    "Dashboard": {
        "purpose": "Review school-wide totals, performance trends, class and subject averages, and the excellence board.",
        "steps": [
            "Open Dashboard from the left navigation.",
            "Use the Classes and Subjects controls to change the average chart.",
            "Review the trend and top-student summaries; use the available retry action if the summary cannot load.",
        ],
    },
    "Students": {
        "purpose": "Find and maintain student profiles, class placement, guardian contact details, photos, and fee balances.",
        "steps": [
            "Search by student or parent details, then narrow the list with class and fee filters.",
            "Choose Add Student to register a student, or use the row actions to edit or remove a profile.",
            "Confirm class, admission number, parent contact, fees, and photo before saving.",
        ],
    },
    "ID Cards": {
        "purpose": "Prepare student ID cards and download them as a PDF sized to the selected card dimensions.",
        "steps": [
            "Filter the roster by class or search by student name or matricule.",
            "Select a preset or enter custom width and height; review the card preview.",
            "Download the PDF. The current export puts one full-size card on each page for the filtered students.",
        ],
    },
    "Teachers": {
        "purpose": "Maintain teacher profiles, qualifications, contact information, subjects, and assigned classes.",
        "steps": [
            "Search the teacher list to locate an existing profile.",
            "Add or edit the profile, then assign the correct subjects and classes.",
            "Check assignments before building the timetable or calculating salary.",
        ],
    },
    "Classes & Subjects": {
        "purpose": "Set up school classes, departments, cycles, academic years, tuition, subjects, coefficients, and teaching assignments.",
        "steps": [
            "Create classes first, with the correct form, department, cycle, academic year, and fee settings.",
            "Create subjects and set their code, coefficient, and periods per week.",
            "Assign teachers and classes to subjects; use the search and filters to review the setup.",
        ],
    },
    "Mark Entry": {
        "purpose": "Record and review student marks by class, subject, and sequence.",
        "steps": [
            "Select a class, subject, and sequence, then locate students with search if needed.",
            "Enter marks on the 0 to 20 scale. The page saves a local draft while you work.",
            "Use Save to send pending changes to the server; check the saved or unsaved status message.",
        ],
    },
    "Student Attendance": {
        "purpose": "Take the weekly student register for a selected class and date.",
        "steps": [
            "Choose the date and class. The register displays the school week.",
            "Mark students present for each weekday. Future days cannot be marked.",
            "Save attendance and confirm the summary counts.",
        ],
    },
    "Teacher Timetable": {
        "purpose": "Let a teacher review their schedule and submit availability once for timetable planning.",
        "steps": [
            "Review today's or the weekly schedule and download the timetable if required.",
            "Submit availability from the availability panel. Availability is a one-time teacher submission.",
            "Contact an administrator for timetable changes; teachers do not edit or delete timetable entries here.",
        ],
    },
    "Teacher Attendance": {
        "purpose": "Record teacher attendance and review weekly or monthly attendance summaries.",
        "steps": [
            "Select a date or reporting period and review the teacher register.",
            "Record attendance status, check-in/check-out, hours, periods, or notes as applicable.",
            "Save the register and verify the summary before leaving the page.",
        ],
    },
    "Report Cards": {
        "purpose": "Review student results and generate an individual report card.",
        "steps": [
            "Select the academic year, class, term, and student.",
            "Review the student's marks, averages, position, and attendance details.",
            "Use the available print or PDF action to produce the report card.",
        ],
    },
    "Bulk Report Cards": {
        "purpose": "Prepare and export report cards for multiple students in a class.",
        "steps": [
            "Select the academic year, class, and term.",
            "Review the roster and report-card previews for missing or incorrect information.",
            "Download or print the generated set.",
        ],
    },
    "Class Lists": {
        "purpose": "Generate class lists and marksheets for a selected class and academic period.",
        "steps": [
            "Choose the class, term, and sequence or report options.",
            "Review the generated student and mark rows.",
            "Export or print the list using the page actions.",
        ],
    },
    "Promotion": {
        "purpose": "Review class performance, pass rates, ranked students, and promotion outcomes.",
        "steps": [
            "Select the academic year, class, and term.",
            "Review the summary cards and ranked student list before making promotion decisions.",
            "Use the available promotion and PDF actions after confirming the class results.",
        ],
    },
    "Fees & Finance": {
        "purpose": "Review student balances, record tuition or registration payments, and export fee reports.",
        "steps": [
            "Filter students by class, payment status, or search text.",
            "Open a student payment action, select the fee type, and enter the amount.",
            "Save the payment and verify the updated balance; export or print reports when needed.",
        ],
    },
    "Teacher Salaries": {
        "purpose": "Calculate teacher pay from attendance, scheduled periods, rates, and recorded salary payments.",
        "steps": [
            "Choose the reporting period and review the attendance/pay summaries.",
            "Check periods, rates, and deductions before generating or editing salary records.",
            "Record payments only after confirming teacher and amount.",
        ],
    },
    "Timetable": {
        "purpose": "Configure the weekly schedule, generate a timetable, resolve conflicts, and manage timetable entries.",
        "steps": [
            "Confirm school hours, breaks, days, classes, subjects, and teacher assignments.",
            "Use Auto-Generate to fill available periods; review conflict reports and suggestions.",
            "Add or edit periods as an administrator, then export or print the timetable.",
        ],
    },
    "School Settings": {
        "purpose": "Set the school calendar, academic year, period schedule, teacher payment mode, and user accounts.",
        "steps": [
            "On School Setup, choose the academic year and maintain school and break times, school days, and periods per day.",
            "Set hourly or monthly teacher payment. Maintain per-class rates or monthly teacher amounts as appropriate.",
            "On User Management, add or update user accounts and roles. Remove accounts only when authorized.",
        ],
    },
}

ROLE_GUIDANCE = {
    "super_admin": "System-wide administration. The current navigation exposes all school operations, setup, reports, and finance tabs.",
    "admin": "School administration. The current navigation exposes school setup, users, academic records, reports, fees, attendance, and timetable tools.",
    "teacher": "Teaching workflows. The current navigation exposes Mark Entry, Student Attendance, and Teacher Timetable.",
    "bursar": "Finance and records workflows. The current navigation exposes Dashboard, Students, Class Lists, Fees & Finance, and Teacher Salaries.",
    "parent": "Read-only school overview through the Dashboard tab in the current navigation.",
}

ROLE_LABELS = {
    "super_admin": "Super Admin",
    "admin": "School Admin",
    "teacher": "Teacher",
    "bursar": "Bursar",
    "parent": "Parent / Student",
}

WORKFLOWS = [
    (
        "School administrator: prepare an academic year",
        [
            "Open School Settings and confirm the academic year, school hours, breaks, days, and payment mode.",
            "Create classes and subjects, then add teachers and assign their classes and subjects.",
            "Build the timetable and resolve any uncovered periods or assignment conflicts.",
            "Register students, verify fees and contacts, then maintain attendance and marks during the term.",
            "Generate individual or bulk report cards and review promotion results at term end.",
        ],
    ),
    (
        "Teacher: submit availability and complete teaching records",
        [
            "Sign in with the username registered for the teacher account.",
            "Open Teacher Timetable and submit availability once; contact an administrator for later corrections.",
            "Use Mark Entry to enter class, subject, and sequence marks, then save pending changes.",
            "Use Student Attendance to record the class register for the selected school week.",
        ],
    ),
    (
        "Bursar: record a payment",
        [
            "Open Fees & Finance and locate the student using search, class, or payment filters.",
            "Choose the correct fee category (tuition or registration) and enter the verified amount.",
            "Save the transaction, confirm the student's balance, and export or print the required record.",
        ],
    ),
    (
        "Parent: review school overview",
        [
            "Sign in with the username associated with the parent account.",
            "Use the Dashboard for the overview currently exposed to the parent role.",
            "For report-card access or account corrections, contact the school administrator.",
        ],
    ),
]


def read_source(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return ""


def discover_nav() -> list[dict[str, object]]:
    source = read_source(FRONTEND / "pages" / "AppLayout.tsx")
    pattern = re.compile(
        r'\{\s*to:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)".*?roles:\s*\[([^\]]+)\]\s*\}',
        re.DOTALL,
    )
    items = []
    for route, label, role_source in pattern.findall(source):
        roles = re.findall(r'"([a-z_]+)"', role_source)
        items.append({"route": route, "label": label, "roles": roles})
    return items


def discover_routes() -> dict[str, str]:
    source = read_source(FRONTEND / "App.tsx")
    routes = {"/app": "Dashboard"}
    pattern = re.compile(r'<Route\s+path="([^"]+)"\s+element=\{<([A-Za-z0-9_]+)\s*/>\}\s*/>')
    for path, component in pattern.findall(source):
        if path in {"/", "/login"}:
            routes[path] = component
        elif path.startswith(":"):
            routes[f"/app/{path}"] = component
        else:
            routes[f"/app/{path}"] = component
    return routes


def discover_api_inventory() -> list[tuple[str, Counter[str]]]:
    inventory = []
    route_dir = BACKEND / "routes"
    if not route_dir.exists():
        return inventory
    pattern = re.compile(r'router\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']+)')
    for path in sorted(route_dir.glob("*.js")):
        counts: Counter[str] = Counter()
        for line in read_source(path).splitlines():
            if line.lstrip().startswith("//"):
                continue
            match = pattern.search(line)
            if match:
                counts[match.group(1).upper()] += 1
        if counts:
            inventory.append((path.stem, counts))
    return inventory


def discover_source_counts() -> dict[str, int]:
    def count_files(path: Path, pattern: str) -> int:
        return sum(1 for _ in path.rglob(pattern)) if path.exists() else 0

    return {
        "frontend page components": count_files(FRONTEND / "pages", "*.tsx"),
        "backend route modules": count_files(BACKEND / "routes", "*.js"),
        "database models": count_files(BACKEND / "models", "*.js"),
        "backend services": count_files(BACKEND / "services", "*.js"),
    }


def set_cell_shading(cell, fill: str) -> None:
    properties = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    properties.append(shading)


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110) -> None:
    properties = cell._tc.get_or_add_tcPr()
    margins = properties.first_child_found_in("w:tcMar")
    if margins is None:
        margins = OxmlElement("w:tcMar")
        properties.append(margins)
    for edge, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = margins.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            margins.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row) -> None:
    properties = row._tr.get_or_add_trPr()
    repeat = OxmlElement("w:tblHeader")
    repeat.set(qn("w:val"), "true")
    properties.append(repeat)


def style_document(document: Document) -> None:
    section = document.sections[0]
    section.top_margin = Inches(0.68)
    section.bottom_margin = Inches(0.68)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)

    normal = document.styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.08

    for style_name, size, color in (
        ("Title", 31, BRAND),
        ("Heading 1", 20, BRAND),
        ("Heading 2", 13, INK),
        ("Heading 3", 11, BRAND),
    ):
        style = document.styles[style_name]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.keep_with_next = True

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    header.text = "BCHS DOUALA  |  USER MANUAL"
    for run in header.runs:
        run.font.name = "Aptos"
        run.font.size = Pt(8)
        run.font.bold = True
        run.font.color.rgb = RGBColor.from_string(MUTED)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run("BCHS DOUALA  |  Page ")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(MUTED)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    result = OxmlElement("w:t")
    result.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for element in (begin, instruction, separate, result, end):
        run._r.append(element)


def add_table(document: Document, headers: list[str], rows: list[list[str]], widths: list[float] | None = None):
    table = document.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    table.style = "Table Grid"
    set_repeat_table_header(table.rows[0])

    for index, text in enumerate(headers):
        cell = table.rows[0].cells[index]
        cell.text = text
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_shading(cell, BRAND)
        set_cell_margins(cell)
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.name = "Aptos"
                run.font.size = Pt(9)
                run.font.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)

    for row_index, values in enumerate(rows):
        cells = table.add_row().cells
        for column, text in enumerate(values):
            cells[column].text = str(text)
            cells[column].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            set_cell_margins(cells[column])
            if row_index % 2 == 1:
                set_cell_shading(cells[column], PALE_GRAY)
            for paragraph in cells[column].paragraphs:
                paragraph.paragraph_format.space_after = Pt(1)
                for run in paragraph.runs:
                    run.font.name = "Aptos"
                    run.font.size = Pt(8.5)

    if widths:
        for row in table.rows:
            for index, width in enumerate(widths):
                row.cells[index].width = Inches(width)
    document.add_paragraph().paragraph_format.space_after = Pt(1)
    return table


def add_bullet(document: Document, text: str, numbered: bool = False) -> None:
    paragraph = document.add_paragraph(style="List Number" if numbered else "List Bullet")
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.add_run(text)


def add_callout(document: Document, title: str, text: str, fill: str = PALE_BLUE) -> None:
    table = document.add_table(rows=1, cols=1)
    table.autofit = True
    table.style = "Table Grid"
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    set_cell_margins(cell, 150, 180, 150, 180)
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(2)
    lead = paragraph.add_run(title + "\n")
    lead.bold = True
    lead.font.color.rgb = RGBColor.from_string(BRAND)
    paragraph.add_run(text)
    document.add_paragraph().paragraph_format.space_after = Pt(1)


def add_cover(document: Document) -> None:
    document.add_paragraph(" ")
    band = document.add_table(rows=1, cols=1)
    band.autofit = True
    cell = band.cell(0, 0)
    set_cell_shading(cell, BRAND)
    set_cell_margins(cell, 300, 300, 300, 300)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("BCHS DOUALA")
    run.font.name = "Aptos Display"
    run.font.size = Pt(18)
    run.font.bold = True
    run.font.color.rgb = RGBColor(255, 255, 255)

    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(68)
    title.paragraph_format.space_after = Pt(8)
    run = title.add_run("School Management System")
    run.font.name = "Aptos Display"
    run.font.size = Pt(31)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(BRAND)

    subtitle = document.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("USER MANUAL")
    run.font.size = Pt(15)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(MUTED)

    metadata = document.add_paragraph()
    metadata.alignment = WD_ALIGN_PARAGRAPH.CENTER
    metadata.paragraph_format.space_before = Pt(26)
    metadata.add_run(f"Prepared {date.today().strftime('%B %d, %Y')}\n")
    metadata.add_run("Student records  |  Teaching  |  Attendance  |  Results  |  Finance")

    summary = document.add_paragraph()
    summary.alignment = WD_ALIGN_PARAGRAPH.CENTER
    summary.paragraph_format.left_indent = Inches(0.6)
    summary.paragraph_format.right_indent = Inches(0.6)
    summary.paragraph_format.space_before = Pt(55)
    summary.add_run(
        "A practical guide for administrators, teachers, bursars, and parents "
        "using the BCHS DOUALA school portal."
    )
    document.add_page_break()


def build_manual() -> Path:
    nav = discover_nav()
    routes = discover_routes()
    api_inventory = discover_api_inventory()
    source_counts = discover_source_counts()
    if not nav:
        raise RuntimeError("Could not find the navigation menu in frontend/src/pages/AppLayout.tsx")

    document = Document()
    style_document(document)
    add_cover(document)

    document.add_heading("1. About the Portal", level=1)
    document.add_paragraph(
        "BCHS DOUALA is a school operations portal for maintaining student and teacher records, "
        "classes and subjects, marks, attendance, timetables, report cards, fees, and staff pay. "
        "The menu shown to each user is based on the role stored on that user's account."
    )
    counts_text = ", ".join(f"{count} {name}" for name, count in source_counts.items())
    document.add_paragraph(f"This manual is generated from the current source tree ({counts_text}).")
    add_callout(
        document,
        "Account access",
        "Sign in with the username issued by the school. The account's saved role controls which navigation tabs appear. "
        "The role tiles on the login screen are not a substitute for an account role or permission.",
    )

    document.add_heading("2. User Roles", level=1)
    document.add_paragraph(
        "This table reflects the tabs displayed by the current frontend navigation. "
        "A hidden tab is not a substitute for server-side authorization; protect accounts and credentials accordingly."
    )
    role_rows = []
    for role, description in ROLE_GUIDANCE.items():
        visible = [item["label"] for item in nav if role in item["roles"]]
        role_rows.append([ROLE_LABELS.get(role, role.replace("_", " ").title()), description, "; ".join(visible) or "No navigation tabs found"])
    add_table(document, ["Account role", "Primary use", "Tabs shown"], role_rows, [1.0, 2.25, 3.55])

    document.add_heading("3. Sign In and Navigation", level=1)
    for step in (
        "Open the school portal URL supplied by the school.",
        "Enter the registered username and select Sign in.",
        "Use the left navigation to open a tab. On a phone, tap the menu button to open navigation and tap a tab to close it.",
        "Use Sign out when finished on a shared device.",
    ):
        add_bullet(document, step, numbered=True)
    add_callout(
        document,
        "Teacher access note",
        "Teachers use Mark Entry, Student Attendance, and Teacher Timetable from the application routes. "
        "If sign-in returns to the public home page, ask the administrator to confirm the teacher account and use the app menu or school-provided link.",
        fill="FFF5E8",
    )

    document.add_heading("4. Tab-by-Tab Guide", level=1)
    for item in nav:
        label = str(item["label"])
        route = str(item["route"])
        roles = ", ".join(str(role).replace("_", " ").title() for role in item["roles"])
        component = routes.get(route, "Route registered in App.tsx")
        guide = TAB_GUIDE.get(label, {
            "purpose": "Open this workspace to review or maintain its school records.",
            "steps": ["Review the current list and filters.", "Make the required changes, then save or export using the page actions."],
        })
        document.add_heading(label, level=2)
        p = document.add_paragraph()
        p.paragraph_format.space_after = Pt(3)
        lead = p.add_run("Purpose: ")
        lead.bold = True
        p.add_run(str(guide["purpose"]))
        meta = document.add_paragraph()
        meta.paragraph_format.space_after = Pt(3)
        r = meta.add_run(f"Route: {route}   |   Visible to: {roles}   |   Screen: {component}")
        r.font.size = Pt(8)
        r.font.color.rgb = RGBColor.from_string(MUTED)
        for step in guide["steps"]:
            add_bullet(document, str(step))

    document.add_page_break()
    document.add_heading("5. Recommended Workflows", level=1)
    for title, steps in WORKFLOWS:
        document.add_heading(title, level=2)
        for step in steps:
            add_bullet(document, step, numbered=True)

    document.add_heading("6. Good Record-Keeping Practices", level=1)
    for item in (
        "Confirm the academic year and class before entering marks, attendance, or payments.",
        "Use the student's official matricule/admission number and verify spelling and guardian contacts.",
        "Record marks against the correct subject and sequence; review unsaved-draft indicators before leaving Mark Entry.",
        "Record payment category and amount accurately, then verify the balance shown after saving.",
        "Review report cards and exports before distributing them. Use a private school-approved channel for student records.",
        "Do not share account passwords. Sign out on shared devices and report incorrect access or missing data to the administrator.",
    ):
        add_bullet(document, item)

    document.add_heading("7. Troubleshooting", level=1)
    troubleshooting = [
        ["A tab is missing", "The current menu is role-based. Ask the administrator to confirm the account role and assignments."],
        ["A list is empty", "Clear search/filter values and confirm the class, academic year, and account assignments."],
        ["A mark is not visible", "Confirm class, subject, and sequence; in Mark Entry, check whether the draft is saved to the server."],
        ["A payment or attendance change is not shown", "Check the success/error message and reload the page after confirming the server connection."],
        ["Timetable has gaps or conflicts", "Review class, subject, teacher, availability, and school-hours settings; use the conflict suggestions in Timetable."],
        ["A teacher cannot change submitted availability", "Teacher availability is a one-time submission. An administrator manages timetable corrections."],
    ]
    add_table(document, ["Issue", "What to check"], troubleshooting, [2.0, 4.8])

    document.add_heading("Appendix A. Navigation and Source Map", level=1)
    document.add_paragraph(
        "The following matrix is parsed from the application's navigation source each time this generator runs. "
        "It is included so administrators can match visible tabs to the current screens."
    )
    map_rows = []
    for item in nav:
        label = str(item["label"])
        route = str(item["route"])
        map_rows.append([
            label,
            route,
            ", ".join(str(role).replace("_", " ").title() for role in item["roles"]),
            routes.get(route, "-"),
        ])
    add_table(document, ["Tab", "Route", "Visible roles", "Screen component"], map_rows, [1.35, 1.5, 1.7, 2.25])

    document.add_heading("Appendix B. Backend API Inventory", level=1)
    document.add_paragraph(
        "This summary is generated by scanning active Express route declarations. "
        "The full request/response contract is maintained in the route source and is not reproduced here."
    )
    api_rows = []
    for module, counts in api_inventory:
        totals = ", ".join(f"{method}: {counts[method]}" for method in ("GET", "POST", "PUT", "PATCH", "DELETE") if counts[method])
        api_rows.append([module, totals])
    add_table(document, ["Backend route module", "Declared endpoint counts"], api_rows, [2.2, 4.6])

    document.add_heading("Appendix C. Keeping This Manual Current", level=1)
    document.add_paragraph(
        "Run this generator after changing application navigation or route definitions. "
        "It reads frontend/src/pages/AppLayout.tsx, frontend/src/App.tsx, and backend/routes/*.js, "
        "then regenerates User_Manual.docx beside the script. Task instructions are maintained in "
        "TAB_GUIDE and WORKFLOWS near the top of generate_user_manual.py so user-facing behavior can be reviewed and edited explicitly."
    )

    document.core_properties.title = "BCHS DOUALA School Management System User Manual"
    document.core_properties.subject = "User guide generated from the BCHS DOUALA application source"
    document.core_properties.author = "BCHS DOUALA"
    document.core_properties.keywords = "school management, user manual, students, teachers, attendance, reports, fees"
    try:
        document.save(OUTPUT)
        return OUTPUT
    except PermissionError:
        versioned_output = ROOT / f"User_Manual_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        document.save(versioned_output)
        return versioned_output


if __name__ == "__main__":
    output_path = build_manual()
    print(f"Word manual saved to: {output_path}")