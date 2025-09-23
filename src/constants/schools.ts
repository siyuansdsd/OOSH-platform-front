export const APPROVED_SCHOOLS = [
  "The Y Panania OSHC",
  "Eastwood Before & After School Care Centre Inc",
  "Randwick Out of School Hours Care (Randwick OOSH)",
  "Crown Street Out of School Hours Care (OSHC)",
  "The Y Oakhill Drive OSHC",
  "Max Hacker Tech Club",
] as const;

export type ApprovedSchool = (typeof APPROVED_SCHOOLS)[number];
