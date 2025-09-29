/**
 * Utility per sanitizzare i log e rimuovere informazioni sensibili
 */

// Pattern per identificare informazioni sensibili
const SENSITIVE_PATTERNS = [
  // JWT tokens
  /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9-_]+/gi,
  // Password nei parametri
  /password[=:]\S+/gi,
  // Email con password
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}.*password/gi,
];

// Chiavi sensibili da oscurare negli oggetti
const SENSITIVE_KEYS = [
  'password',
  'token',
  'jwt',
  'authorization',
  'auth',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'session',
  'cookie',
];

/**
 * Sanitizza una stringa rimuovendo informazioni sensibili
 */
export function sanitizeString(str: string): string {
  let sanitized = str;
  
  // Applica tutti i pattern di sanitizzazione
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
}

/**
 * Sanitizza un oggetto rimuovendo valori sensibili
 */
export function sanitizeObject(obj: any, depth = 0, maxDepth = 5): any {
  // Evita ricorsione infinita
  if (depth > maxDepth) {
    return '[MAX_DEPTH_REACHED]';
  }

  // Gestisci valori primitivi
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Gestisci array
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1, maxDepth));
  }

  // Gestisci oggetti
  const sanitized: any = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();
      
      // Controlla se la chiave è sensibile
      if (SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        sanitized[key] = '[REDACTED]';
      } else {
        // Ricorsivamente sanitizza il valore
        sanitized[key] = sanitizeObject(obj[key], depth + 1, maxDepth);
      }
    }
  }
  
  return sanitized;
}

/**
 * Logger sicuro che sanitizza automaticamente i log
 */
export const secureLog = {
  log: (...args: any[]) => {
    const sanitizedArgs = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : sanitizeString(String(arg))
    );
    console.log(...sanitizedArgs);
  },
  
  error: (...args: any[]) => {
    const sanitizedArgs = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : sanitizeString(String(arg))
    );
    console.error(...sanitizedArgs);
  },
  
  warn: (...args: any[]) => {
    const sanitizedArgs = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : sanitizeString(String(arg))
    );
    console.warn(...sanitizedArgs);
  },
  
  info: (...args: any[]) => {
    const sanitizedArgs = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : sanitizeString(String(arg))
    );
    console.info(...sanitizedArgs);
  },
  
  debug: (...args: any[]) => {
    // Debug logs solo in development
    if (process.env.NODE_ENV !== 'production') {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'object' ? sanitizeObject(arg) : sanitizeString(String(arg))
      );
      console.debug(...sanitizedArgs);
    }
  }
};

/**
 * Sanitizza un URL rimuovendo parametri sensibili
 */
export function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url, 'http://dummy.com'); // Aggiungi base per URL relativi
    const params = new URLSearchParams(urlObj.search);
    
    // Lista di parametri sensibili
    const sensitiveParams = ['token', 'auth', 'key', 'secret', 'password', 'jwt'];
    
    sensitiveParams.forEach(param => {
      if (params.has(param)) {
        params.set(param, '[REDACTED]');
      }
    });
    
    urlObj.search = params.toString();
    
    // Rimuovi il dominio dummy se era un URL relativo
    if (url.startsWith('/')) {
      return urlObj.pathname + urlObj.search + urlObj.hash;
    }
    
    return urlObj.toString();
  } catch {
    // Se il parsing fallisce, sanitizza come stringa normale
    return sanitizeString(url);
  }
}

/**
 * Crea un messaggio di log sicuro per richieste HTTP
 */
export function logHttpRequest(method: string, url: string, headers?: Record<string, string>) {
  const sanitizedUrl = sanitizeUrl(url);
  const sanitizedHeaders = headers ? sanitizeObject(headers) : undefined;
  
  return {
    method,
    url: sanitizedUrl,
    headers: sanitizedHeaders,
    timestamp: new Date().toISOString()
  };
}