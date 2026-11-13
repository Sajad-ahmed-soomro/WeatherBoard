import { useRef } from 'react';
import { AlertIcon, SearchIcon, Spinner } from '../../components/ui/icons';
import type { City } from '../../lib/api/types';
import { SuggestionList } from './SuggestionList';
import { useCityCombobox } from './useCityCombobox';

interface CitySearchProps {
  onSelect: (city: City) => void;
}

export function CitySearch({ onSelect }: CitySearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const combobox = useCityCombobox(onSelect);
  const { ids, state, cities, expanded, activeIndex, fieldError, statusText } = combobox;
  const busy = state.status === 'loading' || state.status === 'retrying';
  const activeId = expanded && activeIndex >= 0 && cities[activeIndex] ? ids.option(activeIndex) : undefined;

  return (
    <form role="search" noValidate onSubmit={combobox.onSubmit} className="w-full">
      <label htmlFor={ids.input} className="mb-2 block text-sm font-medium text-ink">
        City
      </label>
      <div className="relative" onBlur={combobox.onWidgetBlur}>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={ids.input}
          type="text"
          role="combobox"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Search for a city, e.g. Lahore"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={ids.listbox}
          aria-activedescendant={activeId}
          aria-invalid={fieldError !== null}
          aria-describedby={fieldError ? ids.error : undefined}
          value={combobox.inputValue}
          onChange={(e) => combobox.onChange(e.target.value)}
          onKeyDown={combobox.onKeyDown}
          onBlur={combobox.onInputBlur}
          className={`h-[52px] w-full rounded-xl border bg-surface pl-12 pr-[6.5rem] text-base text-ink shadow-sm transition-colors placeholder:text-muted/80 ${
            fieldError ? 'border-danger' : 'border-line hover:border-muted/50'
          }`}
        />
        <div className="absolute right-1 top-1 flex items-center gap-1">
          {busy && <Spinner className="text-muted" />}
          <button
            type="submit"
            className="min-h-touch rounded-lg bg-ink px-4 text-sm font-medium text-surface transition-opacity hover:opacity-90"
          >
            Search
          </button>
        </div>

        <div
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-ink/5"
        >
          {busy && (
            <p className="flex min-h-touch items-center gap-3 px-4 text-sm text-muted">
              <Spinner />
              {statusText}
            </p>
          )}
          {state.status === 'empty' && <p className="flex min-h-touch items-center px-4 text-sm text-muted">{statusText}</p>}
          {state.status === 'error' && (
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <p className="flex flex-1 items-start gap-2 text-sm text-danger">
                <AlertIcon className="mt-px shrink-0" />
                {state.error.message}
              </p>
              {state.error.action && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (state.error.action?.id === 'retry') combobox.retry();
                    else inputRef.current?.select();
                  }}
                  className="min-h-touch shrink-0 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-canvas"
                >
                  {state.error.action.label}
                </button>
              )}
            </div>
          )}
          <SuggestionList
            id={ids.listbox}
            cities={cities}
            activeIndex={activeIndex}
            optionId={ids.option}
            onHover={combobox.onHoverOption}
            onPick={combobox.select}
          />
        </div>
      </div>

      <p id={ids.error} aria-live="polite" className="mt-2 flex min-h-5 items-center gap-1.5 text-sm text-danger">
        {fieldError && (
          <>
            <AlertIcon width={16} height={16} />
            {fieldError}
          </>
        )}
      </p>
      <p className="sr-only" aria-live="polite">
        {expanded ? statusText : ''}
      </p>
    </form>
  );
}
