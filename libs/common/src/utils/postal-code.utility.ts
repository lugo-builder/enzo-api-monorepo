export function getStateByPostalCode(postalCode: string): string | null {
  const states = [
    { name: 'AGUASCALIENTES', min: 20, max: 20 },
    { name: 'BAJA CALIFORNIA', min: 21, max: 22 },
    { name: 'BAJA CALIFORNIA SUR', min: 23, max: 23 },
    { name: 'CAMPECHE', min: 24, max: 24 },
    { name: 'CHIAPAS', min: 29, max: 30 },
    { name: 'CHIHUAHUA', min: 31, max: 31 },
    { name: 'COAHUILA', min: 27, max: 27 },
    { name: 'COLIMA', min: 28, max: 28 },
    { name: 'MEXICO CITY', min: 16, max: 16 },
    { name: 'DURANGO', min: 35, max: 35 },
    { name: 'GUANAJUATO', min: 38, max: 38 },
    { name: 'GUERRERO', min: 41, max: 41 },
    { name: 'HIDALGO', min: 43, max: 43 },
    { name: 'JALISCO', min: 49, max: 49 },
    { name: 'STATE OF MEXICO', min: 57, max: 57 },
    { name: 'MICHOACÁN', min: 61, max: 61 },
    { name: 'MORELOS', min: 62, max: 62 },
    { name: 'NAYARIT', min: 63, max: 63 },
    { name: 'NUEVO LEÓN', min: 67, max: 67 },
    { name: 'OAXACA', min: 71, max: 71 },
    { name: 'PUEBLA', min: 75, max: 75 },
    { name: 'QUERÉTARO', min: 76, max: 76 },
    { name: 'QUINTANA ROO', min: 77, max: 77 },
    { name: 'SAN LUIS POTOSÍ', min: 79, max: 79 },
    { name: 'SINALOA', min: 82, max: 82 },
    { name: 'SONORA', min: 85, max: 85 },
    { name: 'TABASCO', min: 86, max: 86 },
    { name: 'TAMAULIPAS', min: 88, max: 88 },
    { name: 'TLAXCALA', min: 89, max: 89 },
    { name: 'VERACRUZ', min: 91, max: 91 },
    { name: 'YUCATÁN', min: 97, max: 97 },
    { name: 'ZACATECAS', min: 99, max: 99 },
  ];

  const prefix = parseInt(postalCode.toString().substring(0, 2));

  const state = states.find((s) => prefix >= s.min && prefix <= s.max);

  return state ? state.name : null;
}
