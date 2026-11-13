// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { City } from '../../lib/api/types';
import { FavouriteToggle } from './FavouriteToggle';

const LAHORE: City = { id: 'l', type: 'CITY', name: 'Lahore', region: 'Punjab', country: 'Pakistan', countryCode: 'PK', lat: 31.55, lon: 74.34 };

afterEach(cleanup);

function renderToggle(props: { saved: boolean; atLimit: boolean }) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  render(<FavouriteToggle city={LAHORE} onAdd={onAdd} onRemove={onRemove} {...props} />);
  return { button: screen.getByRole('button', { name: 'Favourite' }), onAdd, onRemove };
}

describe('FavouriteToggle', () => {
  it('adds when not saved', () => {
    const { button, onAdd } = renderToggle({ saved: false, atLimit: false });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(onAdd).toHaveBeenCalledWith(LAHORE);
  });

  it('asks to remove when saved (even at the limit)', () => {
    const { button, onRemove } = renderToggle({ saved: true, atLimit: true });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledWith(LAHORE);
  });

  it('at the limit stays focusable, explains why, and does nothing on click', () => {
    const { button, onAdd } = renderToggle({ saved: false, atLimit: true });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    const hintId = button.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(hintId)?.textContent).toMatch(/up to 5 cities\. Remove one to add Lahore/);
    fireEvent.click(button);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
