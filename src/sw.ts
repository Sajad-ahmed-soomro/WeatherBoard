/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import type { RouteHandlerCallback } from 'workbox-core/types';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  FETCHED_AT_HEADER,
  WEATHER_CACHE,
  cacheKeyFor,
  classifyWeatherRequest,
  isFullLoad,
  needsRevalidation,
  readFetchedAt,
  sameCoords,
  type WeatherRequestInfo,
  type WeatherUpdatedMessage,
} from './lib/pwa/weatherCacheRules';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Take control as soon as this worker activates, so a first visit's weather is cached too.
// Updates still wait for the user: a new worker only activates after SKIP_WAITING.
clientsClaim();

// App shell: every navigation resolves to the precached index.html so the app opens offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

/** Copies a network response with the time it was fetched, so the page can show its real age. */
async function stamp(response: Response, fetchedAt: number): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.set(FETCHED_AT_HEADER, String(fetchedAt));
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
}

/** Keeps only the last viewed city: drops every entry for other coordinates. */
async function keepOnly(cache: Cache, info: WeatherRequestInfo): Promise<void> {
  const keys = await cache.keys();
  await Promise.all(
    keys.map((key) => {
      const other = classifyWeatherRequest(key.url);
      return other && sameCoords(other, info) ? Promise.resolve(false) : cache.delete(key);
    }),
  );
}

async function fetchAndStore(request: Request, key: string, info: WeatherRequestInfo, cache: Cache): Promise<Response> {
  const response = await fetch(request);
  if (!response.ok) return response;
  const stamped = await stamp(response, Date.now());
  await cache.put(key, stamped.clone());
  if (isFullLoad(info.kind)) await keepOnly(cache, info);
  return stamped;
}

/** One background refresh per cache key at a time; repeat stale hits share it. */
const revalidating = new Map<string, Promise<void>>();

function revalidate(request: Request, key: string, info: WeatherRequestInfo, cache: Cache): Promise<void> {
  const running = revalidating.get(key);
  if (running) return running;
  const task = fetchAndStore(request, key, info, cache)
    .then((fresh) => (fresh.ok ? notifyUpdated(info) : undefined))
    .catch(() => undefined)
    .finally(() => revalidating.delete(key));
  revalidating.set(key, task);
  return task;
}

async function notifyUpdated(info: WeatherRequestInfo): Promise<void> {
  const message: WeatherUpdatedMessage = { type: 'WEATHER_UPDATED', lat: info.lat, lon: info.lon };
  const windows = await self.clients.matchAll({ type: 'window' });
  for (const client of windows) client.postMessage(message);
}

/**
 * Stale-while-revalidate for the last viewed city. A cached response is returned at once;
 * if it is over a minute old, a background fetch refreshes the cache and tells open pages.
 * With nothing cached, it goes to the network (and stores the result).
 */
const handleWeather: RouteHandlerCallback = async ({ request, event, url }) => {
  const info = classifyWeatherRequest(url.href);
  if (!info) return fetch(request);
  const key = cacheKeyFor(url.href);
  const cache = await caches.open(WEATHER_CACHE);
  const cached = await cache.match(key);
  if (!cached) return fetchAndStore(request, key, info, cache);

  if (needsRevalidation(readFetchedAt(cached.headers), Date.now()) && event instanceof FetchEvent) {
    event.waitUntil(revalidate(request, key, info, cache));
  }
  return cached;
};

// Mini temperatures for favourites use cache: 'no-store' and go straight to the network,
// so they never replace the last city's offline copy.
registerRoute(
  ({ request, url }) => request.method === 'GET' && request.cache !== 'no-store' && classifyWeatherRequest(url.href) !== null,
  handleWeather,
);

function isSkipWaiting(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'type' in data && data.type === 'SKIP_WAITING';
}

// Sent by the page's "Reload" button (workbox-window posts { type: 'SKIP_WAITING' }).
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (isSkipWaiting(event.data)) void self.skipWaiting();
});
