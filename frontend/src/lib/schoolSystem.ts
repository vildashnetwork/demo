export type SchoolSection = "englophone" | "francophone";

const SCHOOL_SECTION_KEY = "school-section";

export function normalizeSchoolSection(value: string | null | undefined, fallback: SchoolSection = "englophone"): SchoolSection {
    const normalized = String(value ?? "").trim().toLowerCase();

    if (normalized === "anglophone") return "englophone";
    if (normalized === "englophone" || normalized === "francophone") return normalized;

    return fallback;
}

export function getStoredSchoolSection(): SchoolSection {
    if (typeof window === "undefined") return "englophone";
    const raw = window.localStorage.getItem(SCHOOL_SECTION_KEY);
    const normalized = normalizeSchoolSection(raw, "englophone");

    if (raw !== normalized) {
        window.localStorage.setItem(SCHOOL_SECTION_KEY, normalized);
    }

    return normalized;
}

export function setStoredSchoolSection(section: SchoolSection) {
    if (typeof window === "undefined") return;
    const previous = getStoredSchoolSection();
    if (previous === section) {
        window.dispatchEvent(new Event("school-section-change"));
        return;
    }
    window.localStorage.setItem(SCHOOL_SECTION_KEY, section);
    window.dispatchEvent(new Event("school-section-change"));
    window.location.reload();
}

export function getActiveSectionLabel(section: SchoolSection) {
    return section === "francophone" ? "Francophone" : "Anglophone";
}
