function isPrimeJS(number: number): boolean {
  if (number <= 1) return false;
  if (number === 2) return true;
  if (number % 2 === 0) return false;

  const boundary = Math.sqrt(number);
  for (let i = 3; i <= boundary; i += 2) {
    if (number % i === 0) return false;
  }
  return true;
}

/**
 * Highly optimized sequential prime counter in JS
 */
export function countPrimesJS(limit: number): number {
  let count = 0;
  for (let i = 2; i <= limit; i++) {
    if (isPrimeJS(i)) {
      count++;
    }
  }
  return count;
}
