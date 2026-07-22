/**
 * Splits an array into smaller chunks of a specified size
 * @param array The array to be split into chunks
 * @param size The size of each chunk
 * @returns An array containing the chunks of the original array
 * @example
 * const arr = [1, 2, 3, 4, 5];
 * const chunks = chunkArray(arr, 2);
 * Result: [[1,2], [3,4], [5]]
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, (i + 1) * size),
  );
}
