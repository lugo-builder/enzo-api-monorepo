/**
 * Genera la key de S3 para la guía
 * @param trackingNumber - Número de guía/tracking
 * @param ecommerceType - Tipo de ecommerce
 * @returns Key para S3
 */
export function getGuideS3Key(
  trackingNumber: string,
  ecommerceType: string,
): string {
  const ecommerceName = (ecommerceType as string) || 'unknown';
  return `shipping-labels/${ecommerceName.toLowerCase()}/${trackingNumber}.pdf`;
}
