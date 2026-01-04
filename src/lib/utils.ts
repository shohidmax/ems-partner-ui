
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const getLocaleDate = (dateString: string) => {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            const cleanedString = dateString.replace(/-/g, '/').replace(' ', 'T');
            const fallbackDate = new Date(cleanedString);
            if (isNaN(fallbackDate.getTime())) return null;
            return fallbackDate;
        }
        return date;
    } catch(e) {
        return null;
    }
};


export function formatToBDTime(dateString: string) {
  const date = getLocaleDate(dateString);
  if (!date) return dateString;

  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour12: true,
  }).replace(',', '');
}

export function formatToBDDate(dateString: string) {
    const date = getLocaleDate(dateString);
    if (!date) return dateString;

    return date.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Dhaka'
    });
}
