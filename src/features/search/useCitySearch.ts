import { useCallback, useEffect, useRef, useState } from 'react';
import { createCitySearchClient, type CitySearchClient } from '../../lib/api/citySearch';
import { isAbortError, toAppError, type AppError } from '../../lib/api/errors';
import type { City } from '../../lib/api/types';

export type CitySearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'retrying'; query: string }
  | { status: 'results'; query: string; cities: City[] }
  | { status: 'empty'; query: string }
  | { status: 'error'; query: string; error: AppError };

interface UseCitySearchOptions {
  client?: CitySearchClient;
  debounceMs?: number;
  minChars?: number;
}

/** One client per app session, so the throttle and cache survive remounts. */
const sharedClient = createCitySearchClient();

function settled(query: string, cities: City[]): CitySearchState {
  return cities.length > 0 ? { status: 'results', query, cities } : { status: 'empty', query };
}

/**
 * Debounced city lookup. Loading shows as soon as the user types; cached queries
 * resolve synchronously with no loading flash. Every new keystroke aborts the
 * previous request, and responses that arrive late are ignored.
 */
export function useCitySearch({ client = sharedClient, debounceMs = 300, minChars = 2 }: UseCitySearchOptions = {}) {
  const [state, setState] = useState<CitySearchState>({ status: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const latestRequest = useRef(0);
  const lastQuery = useRef('');

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    controller.current?.abort();
    controller.current = null;
    latestRequest.current += 1;
  }, []);

  const run = useCallback(
    (query: string) => {
      const requestId = ++latestRequest.current;
      const isCurrent = () => requestId === latestRequest.current;
      const abort = new AbortController();
      controller.current = abort;

      client
        .search(query, {
          signal: abort.signal,
          onRetry: () => {
            if (isCurrent()) setState({ status: 'retrying', query });
          },
        })
        .then((cities) => {
          if (isCurrent()) setState(settled(query, cities));
        })
        .catch((err: unknown) => {
          if (!isCurrent() || isAbortError(err)) return;
          setState({ status: 'error', query, error: toAppError(err, 'search') });
        })
        .finally(() => {
          if (controller.current === abort) controller.current = null;
        });
    },
    [client],
  );

  const search = useCallback(
    (input: string) => {
      cancel();
      const query = input.trim();
      lastQuery.current = query;
      if (query.length < minChars) {
        setState({ status: 'idle' });
        return;
      }
      const cached = client.peek(query);
      if (cached) {
        setState(settled(query, cached));
        return;
      }
      setState({ status: 'loading', query });
      timer.current = setTimeout(() => {
        timer.current = null;
        run(query);
      }, debounceMs);
    },
    [cancel, client, debounceMs, minChars, run],
  );

  /** Re-run the current query immediately (no debounce), e.g. from a Retry button. */
  const retry = useCallback(() => {
    const query = lastQuery.current;
    if (query.length < minChars) return;
    cancel();
    setState({ status: 'loading', query });
    run(query);
  }, [cancel, minChars, run]);

  const reset = useCallback(() => {
    cancel();
    lastQuery.current = '';
    setState({ status: 'idle' });
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { state, search, retry, reset };
}
