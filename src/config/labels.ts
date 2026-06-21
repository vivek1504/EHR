export const MEDICAL_ENTITIES = {
  CLINICAL_CONDITION: "Clinical Condition",
  MEDICATION_STATEMENT: "Medication Statement",
  CLINICAL_FINDING: "Clinical Finding",
  MEDICAL_PROCEDURE: "Medical Procedure",
} as const;

export type MedicalEntityEnumKey = keyof typeof MEDICAL_ENTITIES;

export type MedicalEntityDisplayName =
  (typeof MEDICAL_ENTITIES)[MedicalEntityEnumKey];

export function labelToEnum(
  displayName: string,
): MedicalEntityEnumKey | undefined {
  const entry = Object.entries(MEDICAL_ENTITIES).find(
    ([, v]) => v === displayName,
  );
  return entry?.[0] as MedicalEntityEnumKey | undefined;
}

export function enumToLabel(enumKey: string): string {
  return MEDICAL_ENTITIES[enumKey as MedicalEntityEnumKey] ?? enumKey;
}
