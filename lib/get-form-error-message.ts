import axios from 'axios';

export const getFormErrorMessage = (error: unknown, fallback = 'Įvyko klaida.') => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    if (typeof data === 'string' && data.trim().length > 0) {
      return data;
    }

    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message;

      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    if (error.message) {
      return error.message;
    }
  }

  return fallback;
};
