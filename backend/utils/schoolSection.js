export function normalizeSchoolSection(value, fallback = "englophone") {
    void value;
    void fallback;
    return "englophone";
}

export function buildSchoolSectionFilter(req, fieldName = "section") {
    const section = normalizeSchoolSection(req?.query?.section ?? req?.get?.("x-school-section") ?? "", "");
    return section ? { [fieldName]: section } : {};
}