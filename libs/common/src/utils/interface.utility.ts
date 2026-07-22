export function mirrorKeys<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: K } {
  const result = {} as { [K in keyof T]: K };
  (Object.keys(obj) as (keyof T)[]).forEach((key) => {
    result[key] = key;
  });
  return result;
}
