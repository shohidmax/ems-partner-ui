
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
        const cleanedString = dateString.replace(/-/g, '/').replace(' ', 'T');
        const fallbackDate = new Date(cleanedString);
        if (isNaN(fallbackDate.getTime())) return dateString; 
        
        return fallbackDate.toLocaleString('en-GB', {
            timeZone: 'Asia/Dhaka',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        }).replace(',', '');
     }

     return date.toLocaleString('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).replace(',', '');
  } catch(e) {
    return dateString; // Fallback to original string on any error
  }
}
