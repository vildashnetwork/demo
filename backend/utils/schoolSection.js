export function normalizeSchoolSection(value, fallback = "englophone") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === "anglophone") return "englophone";
  if (normalized === "englophone" || normalized === "francophone") return normalized;

  return fallback;
}

export function buildSchoolSectionFilter(req, fieldName = "section") {
  const section = normalizeSchoolSection(req?.query?.section ?? req?.get?.("x-school-section") ?? "", "");
  return section ? { [fieldName]: section } : {};
}