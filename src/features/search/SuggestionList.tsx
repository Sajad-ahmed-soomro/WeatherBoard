import type { City } from '../../lib/api/types';
import { formatCityContext } from './formatCity';

interface SuggestionListProps {
  id: string;
  cities: City[];
  activeIndex: number;
  optionId: (index: number) => string;
  onHover: (index: number) => void;
  onPick: (city: City) => void;
}

export function SuggestionList({ id, cities, activeIndex, optionId, onHover, onPick }: SuggestionListProps) {
  return (
    <ul id={id} role="listbox" aria-label="City suggestions" className="max-h-80 overflow-y-auto py-1 empty:hidden">
      {cities.map((city, index) => {
        const active = index === activeIndex;
        return (
          <li
            key={city.id}
            id={optionId(index)}
            role="option"
            aria-selected={active}
            // Keep focus in the input so the combobox doesn't blur before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => onHover(index)}
            onClick={() => onPick(city)}
            className={`flex min-h-[52px] cursor-pointer flex-col justify-center px-4 py-2 ${active ? 'bg-accent/10' : ''}`}
          >
            <span className="text-sm font-medium text-ink">{city.name}</span>
            <span className="text-xs text-muted">{formatCityContext(city)}</span>
          </li>
        );
      })}
    </ul>
  );
}
