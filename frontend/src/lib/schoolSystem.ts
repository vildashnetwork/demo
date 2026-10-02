export type SchoolSection = "englophone" | "francophone";

const SCHOOL_SECTION_KEY = "school-section";

export function getStoredSchoolSection(): SchoolSection {
    if (typeof window === "undefined") return "englophone";
    const stored = window.localStorage.getItem(SCHOOL_SECTION_KEY);
    return stored === "francophone" ? "francophone" : "englophone";
}

export function setStoredSchoolSection(section: SchoolSection) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCHOOL_SECTION_KEY, section);
    window.dispatchEvent(new Event("school-section-change"));
}

export function getActiveSectionLabel(section: SchoolSection) {
    return section === "francophone" ? "Francophone" : "Anglophone";
}
