import { customAlphabet } from 'nanoid';

export function generateAlphanumeric(length: number) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let resultado = '';
  for (let i = 0; i < length; i++) {
    resultado += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length),
    );
  }
  return resultado;
}

/**
 * Genera un número de orden para el ERP
 * Utiliza nanoid con un alfabeto personalizado para generar un identificador único de 25 caracteres
 * @returns string - Número de orden único para el ERP
 */
export function generateOrderNumberErp(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const nanoid = customAlphabet(alphabet, 25);
  return nanoid();
}
