/**
 * `unitNumber` es String en BD, así que el orden de Prisma es alfabético
 * ("1", "10", "2"). Los reportes se entregan en orden natural de casa.
 */
export function compareUnitNumber(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  const aIsNum = Number.isFinite(na);
  const bIsNum = Number.isFinite(nb);

  if (aIsNum && bIsNum && na !== nb) return na - nb;
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

export function sortByUnitNumber<T>(
  items: T[],
  getUnitNumber: (item: T) => string,
): T[] {
  return [...items].sort((a, b) =>
    compareUnitNumber(getUnitNumber(a), getUnitNumber(b)),
  );
}
