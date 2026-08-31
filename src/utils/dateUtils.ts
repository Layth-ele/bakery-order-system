/**
 * Date utility functions for week date calculations
 */

/**
 * Parses a week range string (e.g., "Apr 7-13, 2025") and returns an array of formatted dates
 * @param weekRange - The week range string in format "Month DD-DD, YYYY"
 * @returns Array of date strings in format "M/D" (e.g., ["4/7", "4/8", ...])
 */
export function getWeekDates(weekRange: string): string[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates: string[] = [];
  
  try {
    const match = weekRange.match(/(\w+)\s+(\d+)-(\d+),\s+(\d+)/);
    if (match) {
      const [, month, startDay, endDay, year] = match;
      const monthMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const startDate = new Date(parseInt(year), monthMap[month], parseInt(startDay));
      
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        dates.push(`${currentDate.getMonth() + 1}/${currentDate.getDate()}`);
      }
    }
  } catch (error) {
    // Return empty strings if parsing fails
    return days.map(() => '');
  }
  
  return dates.length > 0 ? dates : days.map(() => '');
}

/**
 * Formats a date string with relative labels for Today and Yesterday
 * @param dateString - The date string to format
 * @returns "Today", "Yesterday", or formatted date string (e.g., "Feb 15, 2026")
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Gets the day names for a week
 * @returns Array of abbreviated day names
 */
export function getWeekDayNames(): string[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

/**
 * Gets the full day names for a week
 * @returns Array of full day names
 */
export function getFullWeekDayNames(): string[] {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
}