import { getWeekDates } from './dateUtils';
/**
 * Excel Export Style Constants
 *
 * Brand colors, border helpers, and cell style builders for Excel exports.
 * Extracted from excelExport.ts to reduce its size.
 */
import * as XLSX from 'xlsx';

/**
 * 12-slot category palette for the Delight Bakehouse order form.
 *
 * Each entry: { header, row }
 *   header — col A category label (darker shade)
 *   row    — col B–M product rows  (lighter shade)
 *
 * Slots 1-6 match the reference template exactly.
 * Slots 7-12 are new distinct pastels for extra categories.
 * If admin adds more than 12 categories the palette cycles (% 12).
 */
export const DELIGHT_PALETTE: Array<{ header: string; row: string }> = [
  { header: 'B9CDE5', row: 'DBEEF4' }, //  1 Blue
  { header: 'E6B9B8', row: 'F2DCDB' }, //  2 Rose
  { header: 'FCD5B5', row: 'FDEADA' }, //  3 Orange
  { header: 'CCC1DA', row: 'E6E0EC' }, //  4 Purple
  { header: '388194', row: '93CDDD' }, //  5 Teal
  { header: 'FAC090', row: 'FDEADA' }, //  6 Peach
  { header: 'B8D4A8', row: 'DCF0D4' }, //  7 Green
  { header: 'FFE48C', row: 'FFF6CC' }, //  8 Yellow
  { header: 'F4B8D4', row: 'FAE0EC' }, //  9 Pink
  { header: 'A8C4A8', row: 'D4ECD4' }, // 10 Sage
  { header: 'C8B8E4', row: 'E4D8F4' }, // 11 Lavender
  { header: 'F4A080', row: 'FAD4C8' }, // 12 Coral
];

export const CAT_PALETTE: [string, string, string][] = [
  ["1565C0", "DCEEFB", "1565C0"], // deep blue   / sky
  ["2E7D32", "E8F5E9", "2E7D32"], // forest      / mint
  ["7B1FA2", "F3E5F5", "7B1FA2"], // deep purple / lavender
  ["E65100", "FFF3E0", "E65100"], // deep orange / peach
  ["00695C", "E0F2F1", "00695C"], // teal        / seafoam
  ["C62828", "FEECEB", "C62828"], // deep red     / blush
  ["37474F", "ECEFF1", "37474F"], // blue-grey   / fog
  ["F57F17", "FFFDE7", "F57F17"], // amber        / cream-yellow
  ["4527A0", "EDE7F6", "4527A0"], // deep violet / lilac
  ["00838F", "E0F7FA", "00838F"], // cyan        / ice
];

export const BRAND = {
  BLACK: "1A1A1A",
  WHITE: "FFFFFF",
  GOLD: "C9A84C",
  GOLD_LIGHT: "F5EDD0",
  GOLD_DARK: "7C5A1E",
};

export const STATUS_COLOUR: Record<string, string> = {
  pending: "FFF8E1",
  approved: "E8F5E9",
  rejected: "FEECEB",
  cancelled: "FFF3E0",
  completed: "E8F4FD",
  complete: "E8F4FD",
};
export const STATUS_TEXT: Record<string, string> = {
  pending: "D97706",
  approved: "2E7D32",
  rejected: "C62828",
  cancelled: "E65100",
  completed: "1565C0",
  complete: "1565C0",
};

// ── Border helpers ─────────────────────────────────────────────────────────
export const B = (
  style: string = "thin",
  color = "CCCCCC",
) => ({
  style,
  color: { rgb: color },
});
export const BORDER_ALL = (
  style: string = "thin",
  color = "CCCCCC",
) => ({
  top: B(style, color),
  bottom: B(style, color),
  left: B(style, color),
  right: B(style, color),
});
export const BORDER_MEDIUM = (color = BRAND.GOLD) =>
  BORDER_ALL("medium", color);
export const BORDER_THIN = (color = "DDDDDD") =>
  BORDER_ALL("thin", color);

// ── Cell style factory ─────────────────────────────────────────────────────
export function cs(
  bg: string,
  textColor: string,
  size: number,
  bold: boolean,
  halign: "left" | "center" | "right" = "center",
  border: any = BORDER_THIN(),
  extra: Record<string, any> = {},
): Record<string, any> {
  return {
    font: {
      name: "Calibri",
      sz: size,
      bold,
      color: { rgb: textColor },
    },
    fill: { fgColor: { rgb: bg } },
    alignment: {
      vertical: "center",
      horizontal: halign,
      wrapText: false,
    },
    border,
    ...extra,
  };
}

// ── Parse week dates ───────────────────────────────────────────────────────
export function parseWeekDates(
  weekRange: string | undefined,
): string[] {
  const raw = getWeekDates(weekRange ?? "");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return raw.map((d) => {
    const [m, day] = d.split("/");
    return `${months[parseInt(m) - 1]} ${day}`;
  });
}

// ── Single order export ────────────────────────────────────────────────────
