export interface DemoPatient {
  id: string;
  name: string;
  age: number;
  gender: "Female" | "Male";
  condition: string;
  assessmentDate: string;
  findings: string[];
  recommendedKit: string;
  kitTagline: string;
}

export const DEMO_PATIENTS: DemoPatient[] = [
  {
    id: "sara-sharma",
    name: "Sara Sharma",
    age: 32,
    gender: "Female",
    condition: "Female Pattern Hair Loss with PCOS",
    assessmentDate: "Today",
    findings: [
      "Diffuse thinning over the crown with a widening parting, consistent with female-pattern hair loss.",
      "Hormonal profile shows elevated androgenic activity associated with PCOS, contributing to follicular miniaturisation.",
      "Ferritin sits at the low end of the healthy range, limiting the energy available for active hair growth.",
    ],
    recommendedKit: "HairOS Recovery Kit — F-PCOS Protocol",
    kitTagline: "Tailored to female-pattern thinning with hormonal drivers.",
  },
  {
    id: "rahul-mehta",
    name: "Rahul Mehta",
    age: 34,
    gender: "Male",
    condition: "Male Pattern Hair Loss",
    assessmentDate: "Today",
    findings: [
      "Bitemporal recession with early vertex thinning, matching a classic Norwood III pattern.",
      "Trichoscopy confirms DHT-driven follicular miniaturisation as the primary mechanism.",
      "Family history of male-pattern loss reinforces a genetic susceptibility component.",
    ],
    recommendedKit: "HairOS Recovery Kit — MPHL Core Protocol",
    kitTagline: "DHT-focused therapy with follicle support and scalp recovery.",
  },
  {
    id: "priya-patel",
    name: "Priya Patel",
    age: 28,
    gender: "Female",
    condition: "Telogen Effluvium",
    assessmentDate: "Today",
    findings: [
      "Acute diffuse shedding starting roughly three months after a reported stress event, consistent with telogen effluvium.",
      "Ferritin and Vitamin D both sit below the threshold needed to support a healthy hair-growth cycle.",
      "No signs of androgenic pattern; underlying follicle density is preserved and recovery prognosis is strong.",
    ],
    recommendedKit: "HairOS Recovery Kit — TE Restore Protocol",
    kitTagline: "Nutritional repletion and stress-cycle recovery for diffuse shedding.",
  },
];

export function getDemoPatient(id: string): DemoPatient | undefined {
  return DEMO_PATIENTS.find((p) => p.id === id);
}
