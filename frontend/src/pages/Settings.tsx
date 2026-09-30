import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Shield, Database, Plus, Pencil, Trash2, Search, X, Users, UserCog, Loader2, Save, CalendarClock, DollarSign } from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

type SchoolSettingsForm = {
  academicYear: string;
  schoolStartTime: string;
  schoolEndTime: string;
  breakStart: string;
  breakEnd: string;
  periodDurationMinutes: number;
  periodsPerDay: number;
  schoolDays: string[];
  teacherPaymentMode: "hourly" | "monthly";
};

type PayrollClass = {
  id: string;
  className: string;
  department: string;
  cycle: string;
  ratePerPeriod: number;
};

const currentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const DEFAULT_SCHOOL_SETTINGS: SchoolSettingsForm = {
  academicYear: currentAcademicYear(),
  schoolStartTime: "08:00",
  schoolEndTime: "14:00",
  breakStart: "10:15",
  breakEnd: "10:30",
  periodDurationMinutes: 45,
  periodsPerDay: 6,
  schoolDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  teacherPaymentMode: "hourly",
};

interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: "teacher" | "admin" | "bursar";
  qualification?: string;
  subjectIds?: string[];
  classIds?: string[];
  acedemicYear: string;
  monthlySalary?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<User | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"school" | "users">("school");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettingsForm>(DEFAULT_SCHOOL_SETTINGS);
  const [classes, setClasses] = useState<PayrollClass[]>([]);
  const [monthlySalaryDrafts, setMonthlySalaryDrafts] = useState<Record<string, number>>({});
  const [savingSchoolSettings, setSavingSchoolSettings] = useState(false);
  const [savingClassRates, setSavingClassRates] = useState(false);
  const [savingTeacherRates, setSavingTeacherRates] = useState(false);

  // Check if ID is a MongoDB ObjectId
  const isDatabaseId = (id: string) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/users`);
      if (response.data.success) {
        const mappedUsers = response.data.data.map((user: any) => ({
          id: user._id,
          name: user.name,
          username: user.username,
          phone: user.phone,
          role: user.role || "teacher",
          qualification: user.qualification || "",
          subjectIds: user.subjectIds || [],
          classIds: user.classIds || [],
          monthlySalary: Number(user.monthlySalary) || 0,
          acedemicYear: user.acedemicYear,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }));
        setUsers(mappedUsers);
        console.log("📚 Users loaded:", mappedUsers.length);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSchoolSettings();
  }, []);

  const fetchSchoolSettings = async () => {
    try {
      const [settingsResponse, classesResponse] = await Promise.all([
        axios.get(`${API_BASE}/settings`),
        axios.get(`${API_BASE}/classes`),
      ]);
      if (settingsResponse.data.success) {
        setSchoolSettings({
          ...DEFAULT_SCHOOL_SETTINGS,
          ...settingsResponse.data.data,
          teacherPaymentMode: settingsResponse.data.data.teacherPaymentMode === "monthly" ? "monthly" : "hourly",
        });
      }
      if (classesResponse.data.success) {
        setClasses(classesResponse.data.data.map((item: any) => ({
          id: item._id,
          className: item.className,
          department: item.department,
          cycle: item.cycle,
          ratePerPeriod: Number(item.ratePerPeriod ?? (item.cycle === "1st Cycle" ? 500 : 700)),
        })));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load school settings");
    }
  };

  useEffect(() => {
    setMonthlySalaryDrafts(Object.fromEntries(
      users.filter((user) => user.role === "teacher").map((teacher) => [teacher.id, Number(teacher.monthlySalary) || 0])
    ));
  }, [users]);

  const saveSchoolSettings = async () => {
    setSavingSchoolSettings(true);
    try {
      const response = await axios.post(`${API_BASE}/settings`, schoolSettings);
      setSchoolSettings({ ...schoolSettings, ...response.data.data });
      toast.success("School settings saved");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not save school settings");
    } finally {
      setSavingSchoolSettings(false);
    }
  };

  const saveClassRates = async () => {
    setSavingClassRates(true);
    try {
      await Promise.all(classes.map((schoolClass) => axios.put(
        `${API_BASE}/classes/${schoolClass.id}`,
        { ratePerPeriod: schoolClass.ratePerPeriod }
      )));
      toast.success("Class period rates saved");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not save class period rates");
    } finally {
      setSavingClassRates(false);
    }
  };

  const saveTeacherMonthlyAmounts = async () => {
    const teachers = users.filter((user) => user.role === "teacher");
    if (teachers.some((teacher) => Number(monthlySalaryDrafts[teacher.id] ?? 0) <= 0)) {
      toast.error("Enter a positive monthly amount for every teacher");
      return;
    }
    setSavingTeacherRates(true);
    try {
      await Promise.all(teachers.map((teacher) => axios.patch(
        `${API_BASE}/users/${teacher.id}`,
        { monthlySalary: Number(monthlySalaryDrafts[teacher.id]) }
      )));
      setUsers((previous) => previous.map((user) => user.role === "teacher"
        ? { ...user, monthlySalary: Number(monthlySalaryDrafts[user.id]) }
        : user
      ));
      toast.success("Monthly teacher amounts saved");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not save teacher monthly amounts");
    } finally {
      setSavingTeacherRates(false);
    }
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Search filter
      if (searchTerm && !`${user.name} ${user.username} ${user.phone}`.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Role filter
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [users, searchTerm, roleFilter]);

  // Create user
  const createUser = async (userData: any) => {
    try {
      const response = await axios.post(API_BASE, userData);
      if (response.data.success) {
        toast.success(`${userData.role} added successfully`);
        await fetchUsers();
        setShowNew(false);
        return true;
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create user");
      }
      return false;
    }
  };

  // Update user
  const updateUser = async (id: string, userData: any) => {
    try {
      const response = await axios.put(`${API_BASE}/${id}`, userData);
      if (response.data.success) {
        toast.success(`${userData.role} updated successfully`);
        await fetchUsers();
        setEditing(null);
        return true;
      }
    } catch (error: any) {
      console.error("Error updating user:", error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to update user");
      }
      return false;
    }
  };

  // Delete user
  const deleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    setDeleteLoading(id);
    try {
      const response = await axios.delete(`${API_BASE}/${id}`);
      if (response.data.success) {
        toast.success("User deleted successfully");
        await fetchUsers();
      }
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.response?.data?.message || "Failed to delete user");
    } finally {
      setDeleteLoading(null);
    }
  };

  // Handle save (create or update)
  const handleSave = async (user: User) => {
    const userData = {
      name: user.name,
      username: user.username,
      phone: user.phone,
      role: user.role,
      acedemicYear: user.acedemicYear,
      qualification: user.qualification || "",
      subjectIds: user.subjectIds || [],
      classIds: user.classIds || []
    };

    const isExisting = user.id && isDatabaseId(user.id);

    if (isExisting) {
      return await updateUser(user.id, userData);
    } else {
      return await createUser(userData);
    }
  };

  // Get role badge color
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-700";
      case "bursar":
        return "bg-blue-100 text-blue-700";
      case "teacher":
        return "bg-green-100 text-green-700";
      default:
        return "bg-stone-100 text-stone-700";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-black/60">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">School Settings</h1>
          <p className="text-sm text-black/60 mt-1">Configure the school calendar, teacher pay, and user access.</p>
        </div>
        <div className="inline-flex w-fit rounded-xl border border-stone-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab("school")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "school" ? "bg-[#121212] text-white" : "text-black/60 hover:bg-stone-50"}`}
          >
            School Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "users" ? "bg-[#121212] text-white" : "text-black/60 hover:bg-stone-50"}`}
          >
            User Management
          </button>
        </div>
      </div>

      {activeTab === "school" ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CalendarClock className="size-5 text-brand" />
                <div>
                  <h2 className="font-display font-bold">School Schedule & Pay Mode</h2>
                  <p className="text-xs text-black/50">Settings apply to the selected academic year.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={saveSchoolSettings}
                disabled={savingSchoolSettings}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#121212] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                <Save className="size-4" /> {savingSchoolSettings ? "Saving..." : "Save School Settings"}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SettingsField label="Academic Year">
                <input value={schoolSettings.academicYear} onChange={(event) => setSchoolSettings((current) => ({ ...current, academicYear: event.target.value }))} className={settingsInputClass} placeholder="2026-2027" />
              </SettingsField>
              <SettingsField label="School Starts">
                <input type="time" value={schoolSettings.schoolStartTime} onChange={(event) => setSchoolSettings((current) => ({ ...current, schoolStartTime: event.target.value }))} className={settingsInputClass} />
              </SettingsField>
              <SettingsField label="School Ends">
                <input type="time" value={schoolSettings.schoolEndTime} onChange={(event) => setSchoolSettings((current) => ({ ...current, schoolEndTime: event.target.value }))} className={settingsInputClass} />
              </SettingsField>
              <SettingsField label="Break Starts">
                <input type="time" value={schoolSettings.breakStart} onChange={(event) => setSchoolSettings((current) => ({ ...current, breakStart: event.target.value }))} className={settingsInputClass} />
              </SettingsField>
              <SettingsField label="Break Ends">
                <input type="time" value={schoolSettings.breakEnd} onChange={(event) => setSchoolSettings((current) => ({ ...current, breakEnd: event.target.value }))} className={settingsInputClass} />
              </SettingsField>
              <SettingsField label="Period Duration (minutes)">
                <input type="number" min={10} max={120} value={schoolSettings.periodDurationMinutes} onChange={(event) => setSchoolSettings((current) => ({ ...current, periodDurationMinutes: Number(event.target.value) }))} className={settingsInputClass} />
              </SettingsField>
              <SettingsField label="Periods Per Day">
                <input type="number" min={1} max={12} value={schoolSettings.periodsPerDay} onChange={(event) => setSchoolSettings((current) => ({ ...current, periodsPerDay: Number(event.target.value) }))} className={settingsInputClass} />
              </SettingsField>
              <SettingsField label="Teacher Payment">
                <select value={schoolSettings.teacherPaymentMode} onChange={(event) => setSchoolSettings((current) => ({ ...current, teacherPaymentMode: event.target.value as SchoolSettingsForm["teacherPaymentMode"] }))} className={settingsInputClass}>
                  <option value="hourly">Per period</option>
                  <option value="monthly">Monthly</option>
                </select>
              </SettingsField>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-black/50">School Days</p>
              <div className="flex flex-wrap gap-2">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => {
                  const selected = schoolSettings.schoolDays.includes(day);
                  return (
                    <label key={day} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${selected ? "border-brand/30 bg-brand/5 text-brand" : "border-stone-200 text-black/60"}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setSchoolSettings((current) => ({
                          ...current,
                          schoolDays: selected ? current.schoolDays.filter((item) => item !== day) : [...current.schoolDays, day],
                        }))}
                        className="accent-emerald-600"
                      />
                      {day}
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          {schoolSettings.teacherPaymentMode === "hourly" ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="size-5 text-brand" />
                  <div>
                    <h2 className="font-display font-bold">Rate Per Period by Class</h2>
                    <p className="text-xs text-black/50">Hourly payroll uses the rate attached to each scheduled class.</p>
                  </div>
                </div>
                <button type="button" onClick={saveClassRates} disabled={savingClassRates || !classes.length} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50 disabled:opacity-50">
                  {savingClassRates ? "Saving..." : "Save Rates"}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {classes.map((schoolClass) => (
                  <label key={schoolClass.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-stone-50/70 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{schoolClass.className} {schoolClass.department}</span>
                      <span className="text-[11px] text-black/45">{schoolClass.cycle}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <input type="number" min={0} step={50} value={schoolClass.ratePerPeriod} onChange={(event) => setClasses((current) => current.map((item) => item.id === schoolClass.id ? { ...item, ratePerPeriod: Math.max(0, Number(event.target.value) || 0) } : item))} className="w-24 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-right text-sm font-semibold" aria-label={`${schoolClass.className} ${schoolClass.department} rate per period`} />
                      <span className="text-xs text-black/50">FRS</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="size-5 text-brand" />
                  <div>
                    <h2 className="font-display font-bold">Monthly Amount by Teacher</h2>
                    <p className="text-xs text-black/50">Set each teacher’s monthly salary amount.</p>
                  </div>
                </div>
                <button type="button" onClick={saveTeacherMonthlyAmounts} disabled={savingTeacherRates} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50 disabled:opacity-50">
                  {savingTeacherRates ? "Saving..." : "Save Amounts"}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {users.filter((user) => user.role === "teacher").map((teacher) => (
                  <label key={teacher.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-stone-50/70 px-3 py-2.5">
                    <span className="truncate text-sm font-semibold">{teacher.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <input type="number" min={0} step={1000} value={monthlySalaryDrafts[teacher.id] ?? 0} onChange={(event) => setMonthlySalaryDrafts((current) => ({ ...current, [teacher.id]: Math.max(0, Number(event.target.value) || 0) }))} className="w-28 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-right text-sm font-semibold" aria-label={`${teacher.name} monthly amount`} />
                      <span className="text-xs text-black/50">FRS</span>
                    </span>
                  </label>
                ))}
              </div>
              {users.every((user) => user.role !== "teacher") && <p className="text-sm text-black/50">No teachers available.</p>}
            </section>
          )}
        </div>
      ) : (
        <>

          {/* Users Section */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <UserCog className="size-5 text-brand" />
                <h3 className="font-display font-bold">User Management</h3>
                <span className="text-xs text-black/40">({filteredUsers.length} users)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNew(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors"
                >
                  <Plus className="size-4" /> Add User
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b border-stone-200 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, username, phone..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="bursar">Bursar</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Username</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Academic Year</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-black/40">
                        No users found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3 font-semibold">{user.name}</td>
                        <td className="px-5 py-3 text-sm">{user.username}</td>
                        <td className="px-5 py-3 text-sm">{user.phone}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${getRoleBadge(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm">{user.acedemicYear}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setEditing(user)}
                              className="size-8 grid place-items-center rounded-lg hover:bg-stone-100 text-black/60 transition-colors"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id, user.name)}
                              disabled={deleteLoading === user.id}
                              className="size-8 grid place-items-center rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deleteLoading === user.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Cards */}
          <div className="grid gap-4">
            <Card icon={Shield} title="Security & Roles" desc="Teachers see Mark Entry, Classes and Report Cards only. Settings, Teachers and Promotion are hidden from non-admin roles.">
              <span className="text-xs px-2 py-1 rounded-full bg-brand/10 text-brand font-bold">Active</span>
            </Card>
          </div>
        </>
      )}

      {/* User Dialog */}
      {activeTab === "users" && (editing || showNew) && (
        <UserDialog
          initial={editing ?? {
            id: "u_" + Math.random().toString(36).slice(2, 9),
            name: "",
            username: "",
            phone: "",
            role: "teacher",
            acedemicYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
            qualification: "",
            subjectIds: [],
            classIds: []
          }}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setShowNew(false); }}
        />
      )}
    </div>
  );
}

// User Dialog Component
function UserDialog({
  initial,
  onSave,
  onCancel
}: {
  initial: User;
  onSave: (user: User) => Promise<boolean | void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<User>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const set = <K extends keyof User>(k: K, v: User[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Clear error for this field
    if (errors[k]) {
      setErrors((e) => ({ ...e, [k]: "" }));
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!form.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!form.username.trim()) {
      newErrors.username = "Username is required";
    } else if (form.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }
    if (!form.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[0-9+\-\s()]{8,}$/.test(form.phone)) {
      newErrors.phone = "Invalid phone number format";
    }
    if (!form.role) {
      newErrors.role = "Role is required";
    }
    if (!form.acedemicYear) {
      newErrors.acedemicYear = "Academic year is required";
    } else if (!/^\d{4}-\d{4}$/.test(form.acedemicYear)) {
      newErrors.acedemicYear = "Use format YYYY-YYYY (e.g., 2024-2025)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(form);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = initial.id && !initial.id.startsWith("u_");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-xl mb-1">
          {isEditing ? "Edit User" : "Add User"}
        </h3>
        <p className="text-xs text-black/50 mb-5">
          {isEditing ? "Update user details below." : "Create a new user account."}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Full Name*</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${errors.name ? 'border-red-500' : 'border-stone-200'} bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors`}
              placeholder="John Doe"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Username*</label>
            <input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${errors.username ? 'border-red-500' : 'border-stone-200'} bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors`}
              placeholder="johndoe"
            />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Phone*</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${errors.phone ? 'border-red-500' : 'border-stone-200'} bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors`}
              placeholder="+237 6XX XXX XXX"
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Role*</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value as "teacher" | "admin" | "bursar")}
              className={`w-full px-3 py-2 rounded-lg border ${errors.role ? 'border-red-500' : 'border-stone-200'} bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors`}
            >
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="bursar">Bursar</option>
            </select>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Academic Year*</label>
            <input
              value={form.acedemicYear}
              onChange={(e) => set("acedemicYear", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${errors.acedemicYear ? 'border-red-500' : 'border-stone-200'} bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors`}
              placeholder="2024-2025"
            />
            {errors.acedemicYear && <p className="text-xs text-red-500 mt-1">{errors.acedemicYear}</p>}
          </div>

          {form.role === "teacher" && (
            <div className="p-3 bg-stone-50 rounded-lg text-xs text-black/60">
              <p>Teachers can access: Mark Entry, Classes, Report Cards</p>
            </div>
          )}
          {form.role === "admin" && (
            <div className="p-3 bg-purple-50 rounded-lg text-xs text-purple-700">
              <p>Admins have full access to all features and settings.</p>
            </div>
          )}
          {form.role === "bursar" && (
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              <p>Bursars can manage fees, payments, and financial reports.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving..." : isEditing ? "Update User" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, desc, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 flex items-start gap-4">
      <div className="size-10 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold">{title}</h3>
        <p className="text-xs text-black/60 mt-1 max-w-md">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const settingsInputClass = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function SettingsField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}