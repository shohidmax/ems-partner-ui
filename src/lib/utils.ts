
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const getLocaleDate = (dateString: string): Date | null => {
    if (!dateString) return null;

    // First, try to parse it directly. This works for ISO 8601 formats (like from receivedAt).
    const directDate = new Date(dateString);
    if (!isNaN(directDate.getTime())) {
        // If the date is valid and doesn't seem to be from a 'dd-mm-yyyy' misinterpretation
        // (e.g., month is not > 12), we can probably trust it.
        // The main issue is with strings like "01-06-2026", which JS might parse as Jan 6th.
    }

    // Handle 'dd-mm-yyyy hh:mm:ss AM/PM' format specifically.
    const parts = dateString.match(/(\d{2})-(\d{2})-(\d{4})\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))?/);
    
    if (parts) {
        const day = parts[1];
        const month = parts[2];
        const year = parts[3];
        const time = parts[4] || '00:00:00'; // Default time if not present

        // Reconstruct into a format that new Date() can reliably parse (YYYY-MM-DDTHH:mm:ss)
        // Note: The 'T' is important.
        const isoLikeString = `${year}-${month}-${day}T${time.replace(/\s*(AM|PM)/, '')}`;
        
        const date = new Date(isoLikeString);
        if (!isNaN(date.getTime())) {
             // Handle AM/PM if it exists
            if (dateString.includes('PM') && date.getHours() < 12) {
                date.setHours(date.getHours() + 12);
            }
            if (dateString.includes('AM') && date.getHours() === 12) { // Midnight case
                date.setHours(0);
            }
            return date;
        }
    }

    // As a final fallback, return the direct parsing attempt, even if it might be wrong for some formats.
    if (!isNaN(directDate.getTime())) {
        return directDate;
    }

    return null; // Return null if all parsing fails.
};


export function formatToBDTime(dateString: string) {
  const date = getLocaleDate(dateString);
  if (!date) return dateString;

  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(',', '');
}

export function formatToBDDate(dateString: string) {
    const date = getLocaleDate(dateString);
    if (!date) return dateString;

    return date.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}
