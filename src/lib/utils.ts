
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatToBDTime(dateString: string) {
  if (!dateString) return 'N/A';
  
  try {
     // Handle different possible date string formats, including ISO strings
     const date = new Date(dateString);
     if (isNaN(date.getTime())) {
        // Fallback for custom 'DD-MM-YYYY HH:mm:ss A' format if new Date() fails
        const cleanedString = dateString.replace(/-/g, '/').replace(' ', 'T');
        const fallbackDate = new Date(cleanedString);
        if (isNaN(fallbackDate.getTime())) return dateString; // Return original if all parsing fails
        
        return fallbackDate.toLocaleString('en-GB', {
            timeZone: 'Asia/Dhaka',
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        }).replace(/\//g, '-').replace(',', '');
     }

     // Format to 'dd-mm-yy, hh:mm:ss am/pm'
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
