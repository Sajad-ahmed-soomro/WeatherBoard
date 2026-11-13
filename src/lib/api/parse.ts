import { ParseError } from './errors';

/** Minimal runtime guards so provider responses are checked before they reach the UI. */

export function obj(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ParseError(path);
  return value as Record<string, unknown>;
}

export function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ParseError(path);
  return value;
}

export function num(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ParseError(path);
  return value;
}

export function str(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new ParseError(path);
  return value;
}

export function optionalStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
