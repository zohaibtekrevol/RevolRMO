import type { Grade, SalaryGradeBand } from "./schema";

// Builds the list of salary grade bands eligible for a manual appraisal
// override assignment: starting at the employee's CURRENT band and moving
// upward, spanning across designations (an override is a manual promotion
// decision, unlike normal auto-generation which snaps within the current
// designation only). Designations are ordered by sortOrder (then name);
// bands within a designation by sortOrder (then salaryAmount). If the
// current band can't be located, falls back to every band from the current
// designation onward. Shared by both the client dropdown and the server's
// override-save validation so they always agree on what's assignable.
export function buildAscendingGradeCandidates(
  bands: SalaryGradeBand[],
  grades: Grade[],
  currentGradeBandId: string | null | undefined,
  currentDesignationId: string | null | undefined,
): SalaryGradeBand[] {
  const sortedGrades = [...grades].sort((a, b) => {
    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return so !== 0 ? so : (a.name || "").localeCompare(b.name || "");
  });

  const bandsByDesignation = new Map<string, SalaryGradeBand[]>();
  for (const b of bands) {
    const key = b.designationId || "";
    if (!bandsByDesignation.has(key)) bandsByDesignation.set(key, []);
    bandsByDesignation.get(key)!.push(b);
  }
  Array.from(bandsByDesignation.values()).forEach((list) => {
    list.sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return parseFloat(a.salaryAmount || "0") - parseFloat(b.salaryAmount || "0");
    });
  });

  const orderedDesignationIds = sortedGrades.map((g) => g.id);
  Array.from(bandsByDesignation.keys()).forEach((key) => {
    if (key && !orderedDesignationIds.includes(key)) orderedDesignationIds.push(key);
  });

  const flat: SalaryGradeBand[] = [];
  for (const designationId of orderedDesignationIds) {
    flat.push(...(bandsByDesignation.get(designationId) || []));
  }

  const currentIdx = currentGradeBandId
    ? flat.findIndex((b) => b.id === currentGradeBandId)
    : -1;

  if (currentIdx >= 0) return flat.slice(currentIdx);

  // Fallback: no current band on record — show from the current designation onward.
  const desigIdx = currentDesignationId ? orderedDesignationIds.indexOf(currentDesignationId) : -1;
  if (desigIdx >= 0) {
    const fromDesignation: SalaryGradeBand[] = [];
    for (const designationId of orderedDesignationIds.slice(desigIdx)) {
      fromDesignation.push(...(bandsByDesignation.get(designationId) || []));
    }
    return fromDesignation;
  }
  return flat;
}
