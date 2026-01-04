
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatToBDTime(dateString: string) {
  if (!dateString) return 'N/A';
  
  try {
     const date = new Date(dateString);
     if (isNaN(date.getTime())) {
        // Fallback for custom formats if new Date() fails.
        // This is a robust way to handle potentially non-standard date strings.
        const cleanedString = dateString.replace(/-/g, '/').replace(' ', 'T');
        const fallbackDate = new Date(cleanedString);
        if (isNaN(fallbackDate.getTime())) return dateString; // Return original if all parsing fails
        
        // Using 'en-GB' locale forces the DD/MM/YYYY format.
        return fallbackDate.toLocaleString('en-GB', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        }).replace(/\//g, '-').replace(',', '');
     }

     // Using 'en-GB' locale forces the DD/MM/YYYY format.
     return date.toLocaleString('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).replace(/\//g, '-').replace(',', '');
  } catch(e) {
    return dateString; // Fallback to original string on any error
  }
}
