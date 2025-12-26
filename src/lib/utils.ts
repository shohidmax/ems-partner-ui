
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatToBDTime(dateString: string) {
  if (!dateString) return 'N/A';
  // The dateString is now the exact dateTime string from the device.
  // We will format it to a consistent 'en-GB' format for display.
  try {
     // Attempt to parse the date string. It might be in 'DD-MM-YYYY HH:mm:ss A' or ISO format.
     const date = new Date(dateString.replace(/-/g, '/').replace(' ', 'T'));
     if (isNaN(date.getTime())) return dateString; // Return original string if parsing fails

     // Format to 'dd/mm/yy, hh:mm:ss am/pm' and then clean it up.
     return date.toLocaleString('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).replace(/\//g, '-').replace(',', '');
  } catch(e) {
    return dateString; // Fallback to original string
  }
}



    