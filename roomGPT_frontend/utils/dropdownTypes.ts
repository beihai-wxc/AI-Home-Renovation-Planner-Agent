export type themeType =
  | "Modern"
  | "Vintage"
  | "Minimalist"
  | "Professional"
  | "Tropical";

export type roomType =
  | "Living Room"
  | "Dining Room"
  | "Bedroom"
  | "Bathroom"
  | "Office"
  | "Gaming Room";

export const themeLabels: Record<themeType, string> = {
  Modern: "现代风",
  Minimalist: "简约风",
  Professional: "商务风",
  Tropical: "热带风",
  Vintage: "复古风",
};

export const roomLabels: Record<roomType, string> = {
  "Living Room": "客厅",
  "Dining Room": "餐厅",
  Office: "办公室",
  Bedroom: "卧室",
  Bathroom: "浴室",
  "Gaming Room": "电竞房",
};

export const themes: themeType[] = [
  "Modern",
  "Minimalist",
  "Professional",
  "Tropical",
  "Vintage",
];
export const rooms: roomType[] = [
  "Living Room",
  "Dining Room",
  "Office",
  "Bedroom",
  "Bathroom",
  "Gaming Room",
];
