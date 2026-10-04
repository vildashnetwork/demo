#!/usr/bin/env python3
"""Build the BCHS DOUALA user manual as a Word document.

The people who will read this manual may never have used a computer before,
so the wording is kept simple and every step says exactly what to click.
Everyday staff never see technical words such as "route" or "server".

Run it from any folder with:
    python generate_user_manual.py

It saves User_Manual.docx next to this script. The list of screens and the
job (role) table are read straight from the application so the manual stays
in step with the software. All of the words the reader sees are written in
the TAB_GUIDE, ROLE_GUIDANCE, WORKFLOWS, COMPUTER_BASICS, GLOSSARY,
HELP_TOPICS, QUICK_TASKS and GOOD_PRACTICES sections below, so those are the
parts to edit when you want to change the wording for your school.
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
        "purpose": "The first screen you see after signing in. It shows a summary of the whole school: how many students and teachers there are, how the classes are doing, and the best students.",
        "steps": [
            "On the left side of the screen, click Dashboard.",
            "To change the class or subject shown in the chart, use the Class and Subject boxes near the top.",
            "Read the coloured cards for the school totals.",
            "Look at the chart to compare class and subject averages.",
            "Scroll down to see the best-performing students.",
            "If a part of the page does not load, click the Try again button.",
        ],
        "careful": [
            "The Dashboard only shows information. It does not change any records.",
            "The numbers update as soon as new marks, attendance, or payments are saved.",
        ],
    },
    "Students": {
        "purpose": "The place where you keep the details of every student: name, class, parent or guardian phone number, photo, and fees.",
        "steps": [
            "Click Students on the left.",
            "To find a student quickly, type a name in the Search box. You can also choose a class in the Class box, or a payment status in the Fees box.",
            "To add a new student, click the Add Student button at the top right. Fill in the form one page at a time and click Continue. On the last page, click Add Student to save.",
            "To change a student's details, click the Edit button on that student's row.",
            "To remove a student, click the Delete button on the row and confirm the message that appears.",
        ],
        "careful": [
            "The admission number (matricule) is created automatically. Do not invent one.",
            "Check the spelling of the student's name and the parent's phone number before you save.",
            "Delete removes a record for good. If you are not sure, edit the record instead of deleting it.",
        ],
    },
    "ID Cards": {
        "purpose": "Makes student identity cards and saves them as a file you can print.",
        "steps": [
            "Click ID Cards on the left.",
            "Choose a class in the Class box, or type a name in the Search box.",
            "Choose a card size from the list, or type your own width and height.",
            "Look at the preview on the screen to check the card looks correct.",
            "Click Download PDF. The file is saved on your computer, usually in the Downloads folder.",
            "Open the file and print it. There is one card on each page.",
        ],
        "careful": [
            "The file is a PDF. It always looks the same on every computer and is made for printing.",
        ],
    },
    "Teachers": {
        "purpose": "The place where you keep the details of every teacher: name, qualification, phone number, the subjects they teach, and the classes they are given.",
        "steps": [
            "Click Teachers on the left.",
            "Use the Search box to find a teacher.",
            "Click Add Teacher to add a new teacher, or the Edit button on a row to change details.",
            "In the form, tick the subjects the teacher teaches and the classes the teacher is given.",
            "Click Save.",
        ],
        "careful": [
            "The timetable and the salary calculation both use these choices, so keep them up to date.",
        ],
    },
    "Classes & Subjects": {
        "purpose": "Sets up the building blocks of the school: the classes, the subjects that are taught, and how much each class pays.",
        "steps": [
            "Click Classes & Subjects on the left.",
            "Start with the classes. Click Add Class and fill in the class name, the section, the cycle, the academic year, and the fee.",
            "Then work on the subjects. Click Add Subject and fill in the subject name, its code, its coefficient, and how many periods a week it is taught.",
            "Give each subject to the teachers and the classes that teach it.",
            "Use the Search box and the filter boxes to check your work.",
        ],
        "careful": [
            "Set up the classes and the subjects before you add students, marks, or a timetable.",
            "The coefficient decides how much a subject counts in a student's average. Ask the school office for the correct values.",
        ],
    },
    "Mark Entry": {
        "purpose": "The place where teachers type the marks the students scored in a subject for a sequence or a term.",
        "steps": [
            "Click Mark Entry on the left.",
            "Choose the Class, the Subject, and the Sequence in the boxes at the top.",
            "Type each student's mark out of 20 in the box next to their name.",
            "Your work is kept safe while you type, even before you save.",
            "Click Save Marks to send everything to the school's central computer, and wait for the message that says the marks were saved.",
        ],
        "careful": [
            "Marks are out of 20. Type numbers only; do not add the percent sign or letters.",
            "Do not close the page until you see the message that the marks are saved.",
            "If the page still says there are changes that are not saved, click Save Marks again.",
        ],
    },
    "Student Attendance": {
        "purpose": "The class register. Here you mark each student present or absent for the school week.",
        "steps": [
            "Click Student Attendance on the left.",
            "Choose the Class and the Date at the top. The whole week is shown across the screen.",
            "For each student and each day, click the box to mark the student present.",
            "You cannot mark a day that has not happened yet.",
            "Click Save Attendance, then check the totals shown at the bottom of the screen.",
        ],
        "careful": [
            "Mark the attendance every day, because the report cards show it.",
        ],
    },
    "Teacher Timetable": {
        "purpose": "For teachers. It shows the lessons a teacher must teach this week, and lets the teacher say when they are free to teach.",
        "steps": [
            "Click Teacher Timetable on the left.",
            "Read today's lessons, or scroll down to see the whole week.",
            "To say when you are free, open the availability part of the page and tick the times you can teach.",
            "Click the Save button to send your availability. You can send it only once.",
            "If the timetable looks wrong, speak to the school office.",
        ],
        "careful": [
            "The availability form can be sent only once, so check it carefully before you click Save.",
            "Teachers cannot add, change, or delete timetable entries here. The school office does that.",
        ],
    },
    "Teacher Attendance": {
        "purpose": "Records which teachers came to work, when they arrived and left, and how many periods they taught.",
        "steps": [
            "Click Teacher Attendance on the left.",
            "Choose the day, or the period, that you want to record.",
            "For each teacher, choose Present, Absent, Late, or Excused.",
            "If the school asks for it, fill in the arrival time, the departure time, the hours, the periods, or a short note.",
            "Click Save, then check the summary.",
        ],
        "careful": [
            "Teacher pay is worked out from this screen, so the information must be correct.",
        ],
    },
    "Report Cards": {
        "purpose": "Shows one student's results and makes the report card (bulletin) for that student.",
        "steps": [
            "Click Report Cards on the left.",
            "Choose the Academic Year, the Class, the Term, and the Student.",
            "Read the marks, the average, the position in the class, and the attendance.",
            "Click Print or Download PDF to make the report card.",
        ],
        "careful": [
            "Read the report card carefully before you print it or send it to a parent.",
        ],
    },
    "Bulk Report Cards": {
        "purpose": "Makes the report cards for a whole class at one time.",
        "steps": [
            "Click Bulk Report Cards on the left.",
            "Choose the Academic Year, the Class, and the Term.",
            "Look at the list and check that no student is missing.",
            "Click Download PDF or Print to make all the report cards together.",
        ],
        "careful": [
            "Save all the marks first. A report card made before the marks are saved will be incomplete.",
        ],
    },
    "Class Lists": {
        "purpose": "Makes printable class lists and mark sheets (marksheets) for a class.",
        "steps": [
            "Click Class Lists on the left.",
            "Choose the Class and the Term, then choose the sequence or the type of list you want.",
            "Read the list on the screen and check the students and the marks.",
            "Click Download or Print to save or print the list.",
        ],
        "careful": [
            "Check the class and the term before printing, so you do not print the wrong list.",
        ],
    },
    "Promotion": {
        "purpose": "Helps you decide which students move up to the next class at the end of the year.",
        "steps": [
            "Click Promotion on the left.",
            "Choose the Academic Year, the Class, and the Term.",
            "Read the summary cards and the list of students, which is in order from the highest average to the lowest.",
            "After the results have been checked, click the promotion button you need, or download the PDF.",
        ],
        "careful": [
            "Check the results carefully. Promotion decisions should be agreed with the school leadership before you act.",
        ],
    },
    "Fees & Finance": {
        "purpose": "Shows how much each student has paid and how much is still owed, and lets you record payments.",
        "steps": [
            "Click Fees & Finance on the left.",
            "Find the student with the Search box, or by choosing a class or a payment status.",
            "Click the payment button on the student's row.",
            "Choose the fee type (for example Tuition or Registration) and type the amount received.",
            "Click Save, then check the new balance shown for the student.",
            "To keep a record, use the Export or Print buttons.",
        ],
        "careful": [
            "Type the amount you really received, using numbers only.",
            "Check the balance after saving. If it is wrong, tell the administrator at once.",
            "Where possible, have a second person check the money that you record.",
        ],
    },
    "Teacher Salaries": {
        "purpose": "Works out how much each teacher should be paid, using their attendance, the periods they taught, and their rate.",
        "steps": [
            "Click Teacher Salaries on the left.",
            "Choose the period you are paying for.",
            "Check the periods, the rates, and the deductions for each teacher.",
            "Create the salary records.",
            "Record the payment, then print or download the payslip.",
        ],
        "careful": [
            "Record a payment only after you have checked the teacher's name and the amount.",
        ],
    },
    "Timetable": {
        "purpose": "The school timetable: which teacher teaches which subject, to which class, at which time.",
        "steps": [
            "Click Timetable on the left.",
            "First check the school hours, the breaks, the school days, and the periods per day. If they are wrong, change them in School Settings.",
            "Click Auto-Generate and follow the steps on the screen to fill the timetable automatically.",
            "Read the list of problems (conflicts) and correct them.",
            "If you need to, you can also add or change a period by hand.",
            "Click Print or Download to make the timetable.",
        ],
        "careful": [
            "A teacher cannot be in two classes at the same time. Fix every problem before you print.",
        ],
    },
    "School Settings": {
        "purpose": "The control room of the whole system: the school year, the school hours, the teacher pay rules, and the user accounts. Only administrators should change things here.",
        "steps": [
            "Click School Settings on the left.",
            "On School Setup, choose the Academic Year, then set the school start and end time, the break times, the school days, and the number of periods in a day.",
            "Choose how teachers are paid (for each period they teach, or a fixed amount each month), and fill in the rates.",
            "Open User Management to add a new staff account.",
            "Type the person's full name, a user name, and a password, then choose their job (role) and click Save.",
        ],
        "careful": [
            "Changing the academic year, the school hours, or the user accounts affects everybody. Make these changes only when the school office has agreed them.",
            "Give each person their own account. Never share a password.",
        ],
    },
}

ROLE_GUIDANCE = {
    "super_admin": "The person who looks after the whole system. This account can see every screen.",
    "admin": "The school office or head teacher. This account sees the school setup, the user accounts, the student and teacher records, the reports, the fees, the attendance, and the timetable.",
    "teacher": "A teacher. This account sees Mark Entry, Student Attendance, and Teacher Timetable.",
    "bursar": "The bursar (finance officer). This account sees the Dashboard, Students, Class Lists, Fees & Finance, and Teacher Salaries.",
    "parent": "A parent or a student. This account sees the Dashboard only, and can only look at it, not change it.",
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
        "Setting up a new school year (school office)",
        [
            "Open School Settings and check the academic year, the school hours, the breaks, the school days, and how teachers are paid.",
            "Open Classes & Subjects and create the classes, then the subjects.",
            "Open Teachers and add each teacher, choosing the subjects and the classes they teach.",
            "Open Timetable and click Auto-Generate, then fix any problems until the timetable is complete.",
            "Open Students and add the students, checking the class, the parent's phone number, and the fees.",
            "During the term, keep the attendance and the marks up to date. At the end of the term, make the report cards and check Promotion.",
        ],
    ),
    (
        "A teacher: a normal week",
        [
            "Sign in with the user name the school gave you.",
            "Open Teacher Timetable and send your availability once. Later changes are made by the school office.",
            "Open Mark Entry to type the marks for your class, subject, and sequence, then click Save Marks.",
            "Open Student Attendance to mark the class register for the week, then click Save Attendance.",
            "Tell the school office if anything looks wrong with your classes or your timetable.",
        ],
    ),
    (
        "The bursar: record a fee payment",
        [
            "Open Fees & Finance and find the student with the Search box or the filter boxes.",
            "Click the payment button on the student's row.",
            "Choose the fee type, type the amount the parent paid, and click Save.",
            "Check the new balance, then print or export the receipt if the school uses one.",
        ],
    ),
    (
        "A parent: look at the school overview",
        [
            "Sign in with the user name the school gave you.",
            "Open the Dashboard to see the school summary.",
            "For a report card or a change to your details, speak to the school office.",
        ],
    ),
]


HOW_TO_USE = [
    ("Numbered steps", "Do the numbered steps in order, one after the other. Each step is one small action."),
    ("Blue boxes", "A 'Good to know' note that makes the work easier. Always worth reading."),
    ("Orange boxes", "A 'Be careful' warning. Read it before you continue."),
    ("Bold words", "The exact name of a button or a box on the screen. Look for the same word on your own screen."),
    ("The left-hand menu", "The list of names down the left side of the screen. Every guide below begins by telling you which name to click."),
]

COMPUTER_BASICS = [
    ("What is a web browser?", "A web browser is the program you use to look at websites. On most computers it is called Chrome, Edge, or Firefox. The school portal opens in the browser, just like any other website."),
    ("Opening the portal", "Type the school's web address (the school will give it to you) into the long white bar at the top of the browser, then press the Enter key."),
    ("Clicking", "To click, press the LEFT button of the mouse one time. On a phone or a tablet, tap the screen once with one finger."),
    ("Typing", "Use the keyboard to type. If you make a mistake, press the Backspace key to rub out the last letter."),
    ("Scrolling", "Some pages are taller than the screen. Turn the small wheel in the middle of the mouse, or slide your finger up and down on the screen, to see the rest of the page."),
    ("The left-hand menu", "Down the left side of the screen is a list of the screens you can use. Click a name in that list to open it. On a phone, first tap the small menu button at the top left."),
    ("Saving your work", "When you click a Save button, your work is sent to the school's central computer and kept safely. If you close the page before saving, your work can be lost."),
    ("Signing out", "Always click Sign out when you finish, especially on a computer that other people also use."),
]


GLOSSARY = [
    ("Account", "What you use to sign in. Every member of staff has their own account."),
    ("User name", "The short name the school gave you for signing in."),
    ("Password", "The secret word that only you should know."),
    ("Sign in (log in)", "Typing your user name and password to open your account."),
    ("Role", "Your job in the system, for example teacher or bursar. The role decides which screens you can see."),
    ("Menu (navigation)", "The list of screens down the left side of the page."),
    ("Button", "The coloured shape you click to make something happen."),
    ("Search box", "The white box where you type a name to find it in a long list."),
    ("Filter", "A box that shows fewer rows, for example only one class."),
    ("Row", "One line in a list, for example one line for one student."),
    ("Save", "To keep what you typed in the school's central computer."),
    ("Download", "To copy a file from the system onto your own computer. It usually goes to a folder called Downloads."),
    ("Print", "To send a page to the printer."),
    ("PDF", "A type of file that always looks the same on every computer. It is the file most often used for printing."),
    ("Academic year", "The school year, for example 2025/2026."),
    ("Term", "A part of the school year used for reporting marks."),
    ("Sequence", "A shorter reporting period inside a term."),
    ("Matricule (admission number)", "The official number of a student in the school."),
    ("Coefficient", "How much a subject counts when the student's average is worked out."),
    ("Average", "A student's overall mark."),
    ("Report card (bulletin)", "The paper that shows a student's marks and average."),
    ("Register (attendance)", "The list on which you mark who came to school."),
    ("Conflict", "A problem in the timetable, for example one teacher placed in two classes at the same time."),
    ("The server", "The school's central computer, where all the records are kept. You never touch it; the system sends your work to it when you click Save."),
]

HELP_TOPICS = [
    ["I cannot sign in", "Check that the CAPS LOCK key is not on, and that you typed the user name exactly as the school gave it. If it still fails, ask the school office to reset your password."],
    ["A menu name is missing", "Your job (role) decides which menu names you can see. Ask the school office to check your role."],
    ["A list on the screen is empty", "Clear the Search box, set the class and the other boxes back to 'All', and try again. The class may simply have no students yet."],
    ["My marks did not save", "Look for the message on the screen. If it shows a problem, click Save Marks again. Check that the computer is still connected to the internet."],
    ["Nothing happens when I click", "Wait a few seconds, then click once more. Do not click many times. If it is still stuck, press the F5 key to refresh the page."],
    ["I cannot change a teacher's availability", "Teacher availability can be sent only once. Ask the school office to make the change."],
    ["A report card is missing marks", "The marks were probably not saved. Open Mark Entry, check the marks, and click Save Marks. Then make the report card again."],
    ["The timetable shows a problem", "Two lessons clash. Check the teacher, the class, and the time, then change one of them. Use the list of problems on the Timetable page."],
    ["A payment is not showing", "Wait for the message after saving, then refresh the page. If it is still wrong, tell the administrator before you do anything else."],
]


QUICK_TASKS = [
    ["Add a new student", "Students", "Click Add Student, fill in the form, then click Add Student to save."],
    ["Find a student quickly", "Students", "Type the name in the Search box."],
    ["Type marks for a class", "Mark Entry", "Choose the class, subject and sequence, type the marks out of 20, then click Save Marks."],
    ["Mark the class register", "Student Attendance", "Choose the class and the date, mark each student, then click Save Attendance."],
    ["Print one report card", "Report Cards", "Choose the year, class, term and student, then click Print or Download PDF."],
    ["Print report cards for a whole class", "Bulk Report Cards", "Choose the year, class and term, then click Download PDF."],
    ["Record a fee payment", "Fees & Finance", "Find the student, click the payment button, choose the fee type and the amount, then click Save."],
    ["Make a student ID card", "ID Cards", "Choose a class or search for a student, pick a size, then click Download PDF."],
    ["Build the timetable", "Timetable", "Click Auto-Generate, fix any problems, then click Print or Download."],
    ["Add a new staff account", "School Settings", "Open User Management, type the name, user name and password, choose the role, then click Save."],
]

GOOD_PRACTICES = [
    "Check the academic year and the class before you type marks, attendance, or a payment.",
    "Use the student's official matricule, and check the spelling of names and phone numbers.",
    "In Mark Entry, wait for the message that says the marks are saved before you leave the page.",
    "When you record money, type the exact amount and check the balance afterwards.",
    "Read a report card or a list before you print it or give it to a parent.",
    "Keep student information private. Share it only through a channel the school has approved.",
    "Never share your password. Sign out when you leave a computer that other people use.",
    "Tell the school office at once if you see information that is wrong or missing.",
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


def add_bullet(document: Document, text: str) -> None:
    paragraph = document.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.add_run(text)


def add_numbered(document: Document, items) -> None:
    """Write a numbered list that always starts again at 1.

    Word's built-in numbered style keeps counting all the way through the
    document, which is confusing in a guide for beginners, so the numbers are
    written here instead.
    """
    for index, text in enumerate(items, start=1):
        paragraph = document.add_paragraph()
        paragraph.paragraph_format.left_indent = Inches(0.42)
        paragraph.paragraph_format.first_line_indent = Inches(-0.26)
        paragraph.paragraph_format.space_after = Pt(3)
        paragraph.add_run(f"{index}.  {text}")


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
        "A simple, step-by-step guide for the people who use the BCHS DOUALA "
        "school portal every day: the school office, teachers, the bursar, and parents."
    )
    note = document.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    note.paragraph_format.space_before = Pt(12)
    note_run = note.add_run("No computer experience needed. Every step tells you exactly what to click.")
    note_run.font.size = Pt(10)
    note_run.italic = True
    note_run.font.color.rgb = RGBColor.from_string(MUTED)
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

    document.add_heading("What is in this manual", level=1)
    document.add_paragraph(
        "This manual is written for the people who use the BCHS DOUALA school portal, even if they "
        "have never used a computer before. You do not need to know anything about how the system "
        "works. Follow the steps one at a time."
    )
    contents_rows = [
        ["Part 1 - Getting started", "How to open the portal, sign in, and find your way around the screen."],
        ["Part 2 - What each screen is for", "A simple guide to every name in the left-hand menu, with the steps to follow."],
        ["Part 3 - Everyday jobs", "Step-by-step tasks for the school office, teachers, the bursar, and parents."],
        ["Part 4 - Help", "Words you will see, what to do when something goes wrong, and a quick reference page."],
        ["Part 5 - For the school's computer person", "Technical notes for whoever looks after the system. Everyday users can ignore this part."],
    ]
    add_table(document, ["Part", "What it covers"], contents_rows, [2.1, 4.7])

    document.add_page_break()
    document.add_heading("Part 1. Getting Started", level=1)
    document.add_heading("Who this manual is for", level=2)
    document.add_paragraph(
        "This manual explains how to use the BCHS DOUALA school portal. It is written for everyone "
        "who works with student records, marks, attendance, report cards, fees, or staff pay: the "
        "school office, teachers, the bursar, and parents."
    )
    document.add_paragraph(
        "The manual uses plain words on purpose. Where a technical word cannot be avoided, it is "
        "explained the first time it appears, and you will also find it in the list of "
        "'Words you will see' in Part 4."
    )
    add_callout(
        document,
        "You cannot break anything by looking.",
        "Clicking a menu name only opens a screen. Nothing is changed until you click a Save button. "
        "If you are not sure, look first and save later.",
    )

    document.add_heading("How to read this manual", level=2)
    add_table(document, ["What you will see", "What it means"], [list(entry) for entry in HOW_TO_USE], [1.7, 5.1])

    document.add_heading("A few computer ideas, explained simply", level=2)
    document.add_paragraph(
        "If you have never used a computer, read this short section once. After that, you can go "
        "straight to the guide for the screen you need."
    )
    add_table(document, ["Question", "Plain answer"], [list(entry) for entry in COMPUTER_BASICS], [1.7, 5.1])

    document.add_heading("Signing in", level=2)
    sign_in_steps = [
        "Open the web browser on your computer (for example Chrome, Edge, or Firefox).",
        "Type the school's web address into the long white bar at the top, then press the Enter key.",
        "The sign-in page appears. Type your user name in the first box.",
        "Type your password in the second box. The dots hide it as you type.",
        "Click the Sign in button.",
        "The Dashboard opens. You are now signed in.",
    ]
    add_numbered(document, sign_in_steps)
    document.add_paragraph(
        "Do not share your password with anyone. When you have finished, click Sign out. This is "
        "especially important on a computer that other people also use."
    )
    add_callout(
        document,
        "If the password does not work:",
        "check that the CAPS LOCK key is not switched on. The password is case sensitive, so a "
        "capital letter and a small letter are not the same. If it still fails, ask the school "
        "office to reset your password.",
        fill="FFF5E8",
    )

    document.add_heading("Finding your way around the screen", level=2)
    for item in (
        "The left-hand menu is a list of the screens you can open. Click a name in the list to open that screen. On a phone or tablet, tap the small menu button at the top left first.",
        "The bar across the top shows the name of the screen you are on, and a bell shape for notifications.",
        "Every action has a button with a clear name, such as 'Add Student', 'Save Marks', or 'Download PDF'. Look for the same words on your screen.",
        "While the system is working it may show a short message, such as 'Saving...'. Wait for it to finish before you click again.",
    ):
        add_bullet(document, item)

    document.add_heading("What you can see depends on your job", level=2)
    document.add_paragraph(
        "Each person signs in with their own account. Every account has a job, called a 'role', and "
        "the role decides which names appear in the left-hand menu. This means each person sees only "
        "the screens their work needs. If a screen you need is missing, ask the school office to "
        "check your role."
    )
    role_rows = []
    for role, description in ROLE_GUIDANCE.items():
        visible = [str(item["label"]) for item in nav if role in item["roles"]]
        role_rows.append([
            ROLE_LABELS.get(role, role.replace("_", " ").title()),
            description,
            ", ".join(visible) if visible else "No screens found",
        ])
    add_table(document, ["Job (role)", "Who this is", "Screens this job can see"], role_rows, [1.1, 3.0, 2.7])

    document.add_page_break()
    document.add_heading("Part 2. What Each Screen Is For", level=1)
    document.add_paragraph(
        "This part explains every name in the left-hand menu, in the order the menu shows them. "
        "For each screen you will find what it is for, the exact steps to follow, and the things "
        "to watch out for."
    )
    document.add_paragraph(
        "You do not have to remember all of this. Find the name of the screen you need in the list "
        "below and read only that part."
    )

    for item in nav:
        label = str(item["label"])
        roles = ", ".join(
            ROLE_LABELS.get(str(role), str(role).replace("_", " ").title()) for role in item["roles"]
        )
        guide = TAB_GUIDE.get(label, {
            "purpose": "This screen shows the school records for this part of the work.",
            "steps": [
                "Click the name of this screen in the left-hand menu.",
                "Look at the list, and use the Search box to find the record you need.",
                "Make the change you need, then click Save.",
            ],
        })
        document.add_heading(label, level=2)

        purpose = document.add_paragraph()
        purpose.paragraph_format.space_after = Pt(3)
        lead = purpose.add_run("What it is for: ")
        lead.bold = True
        purpose.add_run(str(guide["purpose"]))

        meta = document.add_paragraph()
        meta.paragraph_format.space_after = Pt(5)
        r = meta.add_run(f"Name in the menu: {label}   |   Who can see it: {roles}")
        r.font.size = Pt(8)
        r.font.color.rgb = RGBColor.from_string(MUTED)

        steps_lead = document.add_paragraph()
        steps_lead.paragraph_format.space_after = Pt(2)
        steps_lead.add_run("Step by step:").bold = True
        add_numbered(document, [str(step) for step in guide["steps"]])

        careful = guide.get("careful") or []
        if careful:
            add_callout(
                document,
                "Be careful:",
                "\n".join(f"- {note}" for note in careful),
                fill="FFF5E8",
            )

    document.add_page_break()
    document.add_heading("Part 3. Everyday Jobs", level=1)
    document.add_paragraph(
        "These tasks come up again and again. Each one is a short list of steps that you can follow "
        "from beginning to end."
    )
    for title, steps in WORKFLOWS:
        document.add_heading(title, level=2)
        add_numbered(document, list(steps))

    document.add_page_break()
    document.add_heading("Part 4. Help", level=1)

    document.add_heading("Quick reference: where do I go to...?", level=2)
    document.add_paragraph("If you remember only one page of this manual, remember this one.")
    add_table(document, ["What you want to do", "Screen", "First step"], QUICK_TASKS, [2.1, 1.4, 3.3])

    document.add_heading("Words you will see", level=2)
    document.add_paragraph(
        "These are the words the portal uses. Each one is explained here in everyday language."
    )
    add_table(document, ["Word", "What it means"], [list(entry) for entry in GLOSSARY], [1.7, 5.1])

    document.add_heading("If something goes wrong", level=2)
    document.add_paragraph(
        "Most problems have a simple answer. Look for your problem in the table below. If you "
        "cannot solve it, tell the school office, and write down exactly what you were doing and "
        "what message appeared on the screen."
    )
    add_table(document, ["What happened", "What to do"], HELP_TOPICS, [2.0, 4.8])

    document.add_heading("Good habits for accurate records", level=2)
    for item in GOOD_PRACTICES:
        add_bullet(document, item)

    document.add_page_break()
    document.add_heading("Part 5. For the School's Computer Person", level=1)
    add_callout(
        document,
        "Everyday users can stop here.",
        "This part is technical. It is for the person who installs, updates, or repairs the school "
        "portal. It does not describe any task that the school staff need to do.",
        fill="FFF5E8",
    )

    document.add_heading("Appendix A. Menu names and who can see them", level=2)
    document.add_paragraph(
        "This list is read automatically from the application every time this manual is built, so it "
        "always matches the software."
    )
    map_rows = []
    for item in nav:
        label = str(item["label"])
        route = str(item["route"])
        map_rows.append([
            label,
            route,
            ", ".join(ROLE_LABELS.get(str(role), str(role).replace("_", " ").title()) for role in item["roles"]),
            routes.get(route, "Not found in App.tsx"),
        ])
    add_table(document, ["Menu name", "Web address in the app", "Who can see it", "Program file"], map_rows, [1.3, 1.5, 1.75, 2.25])

    document.add_heading("Appendix B. Service inventory", level=2)
    document.add_paragraph(
        "A summary of the parts of the system, counted directly from the source files."
    )
    counts_text = ", ".join(f"{count} {name}" for name, count in source_counts.items())
    document.add_paragraph(f"Source files currently in the project: {counts_text}.")
    api_rows = []
    for module, counts in api_inventory:
        totals = ", ".join(f"{method}: {counts[method]}" for method in ("GET", "POST", "PUT", "PATCH", "DELETE") if counts[method])
        api_rows.append([module, totals])
    add_table(document, ["Backend route module", "Declared endpoint counts"], api_rows, [2.2, 4.6])

    document.add_heading("Appendix C. Rebuilding this manual", level=2)
    document.add_paragraph(
        "This manual is built by a script called generate_user_manual.py, which sits in the same "
        "folder as the application. The script reads the menu from frontend/src/pages/AppLayout.tsx, "
        "the screen list from frontend/src/App.tsx, and the service list from backend/routes/*.js, "
        "then writes User_Manual.docx next to itself."
    )
    document.add_paragraph(
        "To rebuild it, open a command window in that folder and run: python generate_user_manual.py"
    )
    document.add_paragraph(
        "The words that the reader sees are kept in the TAB_GUIDE, ROLE_GUIDANCE, WORKFLOWS, "
        "COMPUTER_BASICS, GLOSSARY, HELP_TOPICS, QUICK_TASKS and GOOD_PRACTICES sections near the "
        "top of the script. Edit those sections to change the wording for your school, then run the "
        "script again."
    )

    document.core_properties.title = "BCHS DOUALA School Management System User Manual"
    document.core_properties.subject = "A plain-language guide to the BCHS DOUALA school portal"
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