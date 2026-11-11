const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

// Only the storefront may call the API from a browser. The admin's own requests are same-origin and need no CORS.
// Without a valid FRONTEND_STORE_URL no origin is allowed.
export const getCorsHeaders = (storeUrl: string | undefined): Record<string, string> => {
  const origin = getOrigin(storeUrl);
  const baseHeaders = {
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  };

  if (!origin) {
    return baseHeaders;
  }

  return { 'Access-Control-Allow-Origin': origin, ...baseHeaders };
};

const getOrigin = (url: string | undefined) => {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

export const corsHeaders = getCorsHeaders(process.env.FRONTEND_STORE_URL);
