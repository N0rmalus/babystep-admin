import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Returns a copy of `items` with the item at `from` moved to `to`
export const moveItem = <T>(items: T[], { from, to }: { from: number; to: number }): T[] => {
  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  return reordered;
};

export const formatter = new Intl.NumberFormat('lt-LT', {
  style: 'currency',
  currency: 'EUR',
});
