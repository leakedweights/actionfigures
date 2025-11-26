export class ApiError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const handleApiError = async (
  response: Response,
  defaultMessage: string
): Promise<never> => {
  try {
    const error = await response.json();
    let errorMessage = error.detail || defaultMessage;
    
    if (Array.isArray(errorMessage)) {
      errorMessage = errorMessage
        .map((e: any) => e.msg || JSON.stringify(e))
        .join(', ');
    } else if (typeof errorMessage === 'object') {
      errorMessage = JSON.stringify(errorMessage);
    }
    
    throw new ApiError(errorMessage, response.status, error);
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(defaultMessage, response.status);
  }
};
