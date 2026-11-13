import { AppError } from './errors';

type KeyName = 'VITE_OWM_KEY' | 'VITE_RAPIDAPI_KEY';

const SERVICE_NAME: Record<KeyName, string> = {
  VITE_OWM_KEY: 'Weather',
  VITE_RAPIDAPI_KEY: 'City search',
};

/** Reads a build-time API key. Keys are bundled into client JS; see README "Known limitations". */
export function requireKey(name: KeyName): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError('unknown', `${SERVICE_NAME[name]} isn't configured on this deployment (missing ${name}).`, null);
  }
  return value.trim();
}
