export type AppErrorKind = 'network' | 'rate_limit' | 'not_found' | 'unknown';

/** What the UI should offer the user. The UI decides how to perform it. */
export interface RecoveryAction {
  id: 'retry' | 'edit_search';
  label: string;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly action: RecoveryAction | null;

  constructor(kind: AppErrorKind, message: string, action: RecoveryAction | null) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.action = action;
  }
}

/** The server answered with a non-2xx status. */
export class HttpError extends Error {
  readonly status: number;
  /** Parsed Retry-After header, if the server sent one. */
  readonly retryAfterMs: number | null;

  constructor(status: number, retryAfterMs: number | null = null) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** The request never got an HTTP response (offline, DNS, CORS, timeout). */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** The response arrived but did not have the shape we rely on. */
export class ParseError extends Error {
  constructor(path: string) {
    super(`Unexpected response shape at ${path}`);
    this.name = 'ParseError';
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export function abortError(reason = 'The operation was aborted'): DOMException {
  return new DOMException(reason, 'AbortError');
}

export type ErrorContext = 'search' | 'weather';

const SERVICE: Record<ErrorContext, string> = {
  search: 'City search',
  weather: 'The weather service',
};

const RETRY: RecoveryAction = { id: 'retry', label: 'Try again' };
const EDIT_SEARCH: RecoveryAction = { id: 'edit_search', label: 'Search for another city' };

/** Turns any thrown value into a user-facing AppError with a specific message and next step. */
export function toAppError(err: unknown, context: ErrorContext): AppError {
  if (err instanceof AppError) return err;
  const service = SERVICE[context];

  if (err instanceof NetworkError) {
    return new AppError('network', `${service} couldn't be reached. Check your internet connection, then try again.`, RETRY);
  }

  if (err instanceof HttpError) {
    if (err.status === 429) {
      return new AppError('rate_limit', `${service} is getting too many requests. Wait a few seconds, then try again.`, RETRY);
    }
    if (err.status === 404) {
      return context === 'weather'
        ? new AppError('not_found', 'No weather data exists for this location. Try a nearby city.', EDIT_SEARCH)
        : new AppError('not_found', "City search didn't recognise that request. Try different spelling.", EDIT_SEARCH);
    }
    if (err.status === 401 || err.status === 403) {
      return new AppError('unknown', `${service} rejected this app's API key. A new key can take up to 2 hours to activate, so try again later.`, RETRY);
    }
    if (err.status >= 500) {
      return new AppError('unknown', `${service} is having problems right now (error ${err.status}). Try again in a minute.`, RETRY);
    }
    return new AppError('unknown', `${service} returned an unexpected error (${err.status}). Try again.`, RETRY);
  }

  if (err instanceof ParseError) {
    return new AppError('unknown', `${service} sent data this app couldn't read. Try again in a moment.`, RETRY);
  }

  return new AppError('unknown', `${service} failed for an unexpected reason. Try again.`, RETRY);
}
