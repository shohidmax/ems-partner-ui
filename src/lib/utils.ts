
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

  const day = date.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'Asia/Dhaka' });
  const month = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Asia/Dhaka' });
  const year = date.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Asia/Dhaka' });
  const time = date.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
  });

  return `${day}/${month}/${year} ${time}`;
}

export function formatToBDDate(dateString: string) {
    const date = getLocaleDate(dateString);
    if (!date) return dateString;

    const day = date.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'Asia/Dhaka' });
    const month = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Asia/Dhaka' });
    const year = date.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Asia/Dhaka' });

    return `${day}/${month}/${year}`;
}
