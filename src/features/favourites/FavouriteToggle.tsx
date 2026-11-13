import { useId } from 'react';
import { StarIcon } from '../../components/ui/icons';
import type { City } from '../../lib/api/types';
import { MAX_FAVOURITES } from './favourites';

interface FavouriteToggleProps {
  city: City;
  saved: boolean;
  atLimit: boolean;
  onAdd: (city: City) => void;
  onRemove: (city: City) => void;
}

/**
 * Toggle button with a fixed name ("Favourite") and aria-pressed for the state. At the limit it
 * stays focusable (aria-disabled, not disabled) so the explanation can be reached and read.
 */
export function FavouriteToggle({ city, saved, atLimit, onAdd, onRemove }: FavouriteToggleProps) {
  const hintId = useId();
  const blocked = !saved && atLimit;

  const onClick = () => {
    if (blocked) return;
    if (saved) onRemove(city);
    else onAdd(city);
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        aria-pressed={saved}
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? hintId : undefined}
        onClick={onClick}
        className={`inline-flex min-h-touch items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
          saved
            ? 'border-accent/30 bg-accent/10 text-accent hover:bg-accent/15'
            : blocked
              ? 'cursor-not-allowed border-line text-muted'
              : 'border-line text-ink hover:bg-canvas'
        }`}
      >
        <StarIcon filled={saved} width={18} height={18} />
        Favourite
      </button>
      {blocked && (
        <p id={hintId} className="mt-1 max-w-[15rem] text-right text-xs text-muted">
          You can save up to {MAX_FAVOURITES} cities. Remove one to add {city.name}.
        </p>
      )}
    </div>
  );
}
