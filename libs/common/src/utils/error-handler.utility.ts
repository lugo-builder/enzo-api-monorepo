import { CustomException } from './custom.exception';

/**
 * Extrae mensaje de error legible de diferentes tipos de errores
 * @param error - Error a procesar
 * @returns Mensaje de error legible
 */
export function extractErrorMessage(error: any): string {
  // CustomException (errores internos de la app)
  if (error instanceof CustomException) {
    const errorResponse = error.getResponse();
    if (typeof errorResponse === 'object' && 'errorData' in errorResponse) {
      const errorData = errorResponse.errorData;
      return typeof errorData === 'string' ? errorData : error.message;
    }
  }

  // Errores de axios con mensaje en response.data
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  // Fallback al mensaje del error
  return error.message || 'Unknown error';
}

/**
 * Determina si un error debe ser reintentado
 * @param error - Error a evaluar
 * @returns true si el error es reintentar, false si no
 */
export function shouldRetryError(error: any): boolean {
  // Errores de validación y not found NO se reintentan
  if (error instanceof CustomException) {
    return false;
  }

  // Errores de axios (API externa)
  if (error.response) {
    const status = error.response.status;
    // Rate limit (429) o errores 5xx se reintentan
    return status === 429 || status >= 500;
  }

  // Errores de red se reintentan
  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ECONNRESET'
  ) {
    return true;
  }

  // Por defecto, reintentar errores desconocidos
  return true;
}
