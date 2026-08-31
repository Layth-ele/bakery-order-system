/**
 * Cart Types — shared between hooks and services
 * 
 * Defined here (not in a hook) so services can import without
 * creating a hook→service circular/layering violation.
 */

export interface DayQuantities {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export const emptyWeek: DayQuantities = {
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
};
