/**
 * Excepción para errores que NO deben ser reintentados
 * Ejemplos: validación, recursos no encontrados, errores de configuración
 */
export class NonRetryableError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * Excepción para errores que SÍ deben ser reintentados
 * Ejemplos: errores de red, rate limits, errores 5xx de APIs externas
 */
export class RetryableError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * Determina si un error debe ser reintentado
 */
export function isRetryableError(error: Error): boolean {
  return error instanceof RetryableError;
}
