import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardEdit,
  FileText, Wallet, Settings, LogOut, Menu, X, Bell, ArrowUpRight,
  Calendar, DollarSign, Download,
} from "lucide-react";
import { currentUser, logout } from "@/lib/auth";
import { getStoredSchoolSection, setStoredSchoolSection } from "@/lib/schoolSystem";
import type { SchoolSection } from "@/lib/schoolSystem";
import { useLanguage } from "@/lib/language";
import type { User, Role } from "@/lib/types";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  roles: Role[];
};
const ALL: Role[] = ["super_admin", "admin", "teacher", "bursar", "parent"];

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ["super_admin", "admin", "bursar", "parent"] },
  { to: "/app/students", label: "Students", icon: Users, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/teachers", label: "Teachers", icon: GraduationCap, roles: ["super_admin", "admin"] },
  { to: "/app/classes", label: "Classes & Subjects", icon: BookOpen, roles: ["super_admin", "admin"] },
  { to: "/app/mark-entry", label: "Mark Entry", icon: ClipboardEdit, roles: ["super_admin", "admin", "teacher"] },
  { to: "/app/student-attendance", label: "Student Attendance", icon: Calendar, roles: ["super_admin", "admin", "teacher"] },
  { to: "/app/teacher-timetable", label: "Teacher Timetable", icon: Calendar, roles: ["teacher"] },
  { to: "/app/teacher-attendance", label: "Teacher Attendance", icon: Calendar, roles: ["super_admin", "admin"] },
  { to: "/app/report-cards", label: "Report Cards", icon: FileText, end: true, roles: ["super_admin", "admin"] },
  { to: "/app/report-cards/bulk", label: "Bulk Report Cards", icon: FileText, roles: ["super_admin", "admin"] },
  { to: "/app/class-lists", label: "Class Lists", icon: Download, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/promotion", label: "Promotion", icon: ArrowUpRight, roles: ["super_admin", "admin"] },
  { to: "/app/fees", label: "Fees & Finance", icon: Wallet, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/teacher-salaries", label: "Teacher Salaries", icon: DollarSign, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/timetable", label: "Timetable", icon: Calendar, roles: ["super_admin", "admin"] },
  { to: "/app/settings", label: "School Settings", icon: Settings, roles: ["super_admin", "admin"] },
];

const navText = getStoredSchoolSection() === "francophone"
  ? {
    dashboard: "Tableau de bord",
    students: "Élèves",
    teachers: "Enseignants",
    classes: "Classes & matières",
    markEntry: "Saisie des notes",
    studentAttendance: "Présence des élèves",
    teacherTimetable: "Emploi du temps enseignant",
    teacherAttendance: "Présence enseignants",
    reportCards: "Bulletins",
    bulkReportCards: "Bulletins en masse",
    classLists: "Listes de classes",
    promotion: "Promotion",
    fees: "Frais & finance",
    teacherSalaries: "Salaires enseignants",
    timetable: "Emploi du temps",
    settings: "Paramètres de l’école",
    overview: "Vue d’ensemble",
    signOut: "Déconnexion",
  }
  : {
    dashboard: "Dashboard",
    students: "Students",
    teachers: "Teachers",
    classes: "Classes & Subjects",
    markEntry: "Mark Entry",
    studentAttendance: "Student Attendance",
    teacherTimetable: "Teacher Timetable",
    teacherAttendance: "Teacher Attendance",
    reportCards: "Report Cards",
    bulkReportCards: "Bulk Report Cards",
    classLists: "Class Lists",
    promotion: "Promotion",
    fees: "Fees & Finance",
    teacherSalaries: "Teacher Salaries",
    timetable: "Timetable",
    settings: "School Settings",
    overview: "Overview Dashboard",
    signOut: "Sign out",
  };

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { section, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const u = currentUser();
    if (!u) { navigate("/login", { replace: true }); return; }
    setUser(u);
  }, [navigate]);

  const items = useMemo(() => user ? NAV.filter((n) => n.roles.includes(user.role)) : [], [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-[#121212] flex">
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-[#121212] text-white p-2 rounded-lg shadow-lg"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[#121212] text-white flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="size-9 bg-brand rounded-lg grid place-items-center">
            <GraduationCap className="size-4 text-white" />
          </div>
          <div>
            <div className="font-display font-bold uppercase tracking-tight">BCHS DOUALA</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">SCHOOL PORTAL</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const translatedLabel = getStoredSchoolSection() === "francophone"
              ? item.to === "/app" ? navText.dashboard :
                item.to === "/app/students" ? navText.students :
                  item.to === "/app/teachers" ? navText.teachers :
                    item.to === "/app/classes" ? navText.classes :
                      item.to === "/app/mark-entry" ? navText.markEntry :
                        item.to === "/app/student-attendance" ? navText.studentAttendance :
                          item.to === "/app/teacher-timetable" ? navText.teacherTimetable :
                            item.to === "/app/teacher-attendance" ? navText.teacherAttendance :
                              item.to === "/app/report-cards" ? navText.reportCards :
                                item.to === "/app/report-cards/bulk" ? navText.bulkReportCards :
                                  item.to === "/app/class-lists" ? navText.classLists :
                                    item.to === "/app/promotion" ? navText.promotion :
                                      item.to === "/app/fees" ? navText.fees :
                                        item.to === "/app/teacher-salaries" ? navText.teacherSalaries :
                                          item.to === "/app/timetable" ? navText.timetable :
                                            item.to === "/app/settings" ? navText.settings : item.label
              : item.label;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-brand/15 text-brand" : "text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                <item.icon className="size-4" />
                {translatedLabel}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-9 bg-brand/20 text-brand rounded-full grid place-items-center font-bold text-sm">
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest">{user.role.replace("_", " ")}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white/60 hover:text-white border border-white/10 hover:border-white/30 py-2 rounded-lg transition-colors"
          >
            <LogOut className="size-3.5" /> {navText.signOut}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-stone-200 px-6 lg:px-8 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <div className="text-xs text-black/40 font-medium">BCHS DOUALA · School Portal</div>
            <div className="text-sm font-semibold">{getPageTitle(pathname)}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-1" aria-label={t("School System")}>
              {(["englophone", "francophone"] as SchoolSection[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={section === option}
                  onClick={() => {
                    if (option === section) return;
                    setStoredSchoolSection(option);
                    window.location.reload();
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${section === option ? "bg-white text-brand shadow-sm" : "text-black/55 hover:text-black"}`}
                >
                  {option === "englophone" ? t("Anglophone") : t("Francophone")}
                </button>
              ))}
            </div>
            <button className="size-9 grid place-items-center rounded-lg border border-stone-200 hover:bg-stone-50">
              <Bell className="size-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-full">
              <span className="size-2 bg-brand rounded-full" />
              <span className="text-xs font-semibold">{getStoredSchoolSection() === "francophone" ? "En direct" : "Live"}</span>
            </div>
          </div>
        </header>
        <div className="p-6 lg:p-8"><Outlet /></div>
      </main>
    </div>
  );
}

function getPageTitle(p: string) {
  const isFrancophoneMode = getStoredSchoolSection() === "francophone";
  if (p === "/app") return isFrancophoneMode ? "Vue d’ensemble" : "Overview Dashboard";
  if (p.startsWith("/app/students")) return isFrancophoneMode ? "Élèves" : "Students";
  if (p.startsWith("/app/teachers")) return isFrancophoneMode ? "Enseignants" : "Teachers";
  if (p.startsWith("/app/teacher-attendance")) return isFrancophoneMode ? "Présence enseignants" : "Teacher Attendance";
  if (p.startsWith("/app/teacher-salaries")) return isFrancophoneMode ? "Salaires enseignants" : "Teacher Salaries";
  if (p.startsWith("/app/teacher-timetable")) return isFrancophoneMode ? "Emploi du temps enseignant" : "Teacher Timetable";
  if (p.startsWith("/app/classes")) return isFrancophoneMode ? "Classes & matières" : "Classes & Subjects";
  if (p.startsWith("/app/mark-entry")) return isFrancophoneMode ? "Saisie des notes" : "Mark Entry";
  if (p.startsWith("/app/student-attendance")) return isFrancophoneMode ? "Présence des élèves" : "Student Attendance";
  if (p.startsWith("/app/report-cards")) return isFrancophoneMode ? "Bulletins" : "Report Cards";
  if (p.startsWith("/app/class-lists")) return isFrancophoneMode ? "Listes de classes" : "Class Lists";
  if (p.startsWith("/app/promotion")) return isFrancophoneMode ? "Promotion" : "Promotion";
  if (p.startsWith("/app/fees")) return isFrancophoneMode ? "Frais & finance" : "Fees & Finance";
  if (p.startsWith("/app/settings")) return isFrancophoneMode ? "Paramètres de l’école" : "School Settings";
  return "BCHS DOUALA";
}