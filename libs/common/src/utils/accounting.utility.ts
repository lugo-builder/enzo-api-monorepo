import { isNumber } from 'class-validator';

export function roundAmount(amount: number, places: number = 2) {
  let roundValue: number = 0;
  try {
    roundValue = +(Math.round(Number(amount + 'e+' + places)) + 'e-' + places);
  } catch (error) {
    console.error(
      `Catch error - roundAmount error :: ${JSON.stringify({ amount, places })}`,
    );
    roundValue = amount;
  }
  return roundValue;
}

export function formatTwoDecimals(value: number): number {
  value = isNumber(value) ? value : 0;
  return parseFloat(value.toFixed(2));
}

export function parseAmount(amount: string): number {
  if (!amount || amount.trim() === '') {
    return 0.0;
  }
  const parsedAmount = parseFloat(amount);
  return parseFloat(parsedAmount.toFixed(2));
}

export function calculateTaxRate(price: number, tax: number): number {
  if (price === 0 || tax === 0) {
    return 0.0;
  }
  const taxRate = (tax / price) * 100;
  return parseFloat(taxRate.toFixed(2));
}

export function calculateUnitPriceByQuantity(
  price: number,
  quantity: number,
): number {
  if (quantity === 0) {
    return 0;
  }
  const unitPrice = price / quantity;
  return parseFloat(unitPrice.toFixed(2));
}

/**
 * Calcula el precio sin IVA a partir de un precio con IVA y una tasa de impuesto
 * @param priceWithTax Precio con IVA incluido
 * @param taxRate Tasa de impuesto en porcentaje (ej: 16 para 16%)
 * @returns Precio sin IVA, redondeado a 2 decimales
 */
export function calculatePriceWithoutTax(
  priceWithTax: number,
  taxRate: number,
): number {
  if (!taxRate || taxRate <= 0 || !priceWithTax || priceWithTax <= 0) {
    return formatTwoDecimals(priceWithTax || 0);
  }

  const taxMultiplier = 1 + taxRate / 100;
  const priceWithoutTax = priceWithTax / taxMultiplier;

  return formatTwoDecimals(priceWithoutTax);
}
