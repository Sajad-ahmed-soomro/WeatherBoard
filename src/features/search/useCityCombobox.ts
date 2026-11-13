import { useCallback, useId, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { City } from '../../lib/api/types';
import { formatCityLabel } from './formatCity';
import { useCitySearch, type CitySearchState } from './useCitySearch';

export const EMPTY_FIELD_ERROR = 'Enter a city name to search.';
export const PICK_SUGGESTION_ERROR = 'Pick a city from the suggestions.';

/** Text for the polite live region and the popup's status row. */
export function describeSearchState(state: CitySearchState): string {
  switch (state.status) {
    case 'idle':
      return '';
    case 'loading':
      return 'Searching…';
    case 'retrying':
      return 'Search is busy, retrying…';
    case 'results':
      return `${state.cities.length} ${state.cities.length === 1 ? 'city' : 'cities'} found. Use the up and down arrows to choose.`;
    case 'empty':
      return `No cities match '${state.query}'. Check the spelling.`;
    case 'error':
      return state.error.message;
  }
}

/** ARIA 1.2 combobox behaviour: input text, popup visibility, active option, validation. */
export function useCityCombobox(onSelect: (city: City) => void) {
  const { state, search, retry, reset } = useCitySearch();
  const id = useId();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<City | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const cities = state.status === 'results' ? state.cities : [];
  const expanded = isOpen && state.status !== 'idle';
  const ids = {
    input: `${id}-input`,
    listbox: `${id}-listbox`,
    error: `${id}-error`,
    option: (index: number) => `${id}-option-${index}`,
  };

  const select = useCallback(
    (city: City) => {
      setSelected(city);
      setInputValue(formatCityLabel(city));
      setOpen(false);
      setActiveIndex(-1);
      setFieldError(null);
      reset();
      onSelect(city);
    },
    [onSelect, reset],
  );

  const onChange = (value: string) => {
    setInputValue(value);
    setSelected(null);
    setActiveIndex(-1);
    setOpen(true);
    if (value.trim() !== '') setFieldError(null);
    search(value);
  };

  /** Validate whenever the text field itself loses focus. */
  const onInputBlur = () => {
    if (inputValue.trim() === '') setFieldError(EMPTY_FIELD_ERROR);
  };

  /** Close the popup only when focus leaves the whole combobox (input, button and popup). */
  const onWidgetBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setOpen(false);
    setActiveIndex(-1);
  };

  const move = (next: number) => {
    if (cities.length === 0) return;
    setOpen(true);
    setActiveIndex((next + cities.length) % cities.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!expanded) {
          setOpen(true);
          if (cities.length > 0) setActiveIndex(0);
        } else move(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!expanded) setOpen(true);
        move(activeIndex <= 0 ? cities.length - 1 : activeIndex - 1);
        break;
      case 'Home':
        if (expanded && cities.length > 0) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (expanded && cities.length > 0) {
          event.preventDefault();
          setActiveIndex(cities.length - 1);
        }
        break;
      case 'Enter': {
        const city = expanded ? cities[activeIndex] : undefined;
        if (city) {
          event.preventDefault();
          select(city);
        }
        break;
      }
      case 'Escape':
        if (expanded) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        } else if (inputValue !== '') {
          event.preventDefault();
          onChange('');
        }
        break;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputValue.trim() === '') {
      setFieldError(EMPTY_FIELD_ERROR);
      return;
    }
    if (selected) {
      onSelect(selected);
      return;
    }
    setFieldError(PICK_SUGGESTION_ERROR);
    setOpen(true);
  };

  return {
    ids,
    state,
    cities,
    inputValue,
    expanded,
    activeIndex,
    fieldError,
    statusText: describeSearchState(state),
    onChange,
    onInputBlur,
    onWidgetBlur,
    onKeyDown,
    onSubmit,
    onHoverOption: setActiveIndex,
    select,
    retry,
  };
}
