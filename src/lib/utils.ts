
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatToBDTime(dateString: string) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    // Manually add 6 hours
    date.setHours(date.getHours() + 6);
    return date.toLocaleString('en-GB', {
      timeZone: 'UTC', // Display the modified time as is
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).replace(/, /g, ' ');
  } catch (error) {
    console.error('Invalid date string for formatToBDTime:', dateString);
    return 'Invalid Date';
  }
}

