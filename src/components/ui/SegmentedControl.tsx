import { useId, type ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  /** Optional icon; the label is then visually hidden but still read out. */
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A native radio group styled as segments: arrow keys, Tab and screen readers work as for radios. */
export function SegmentedControl<T extends string>({ legend, options, value, onChange }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="flex rounded-lg border border-line bg-canvas p-0.5">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          title={option.icon ? option.label : undefined}
          className="relative grid min-h-touch min-w-touch cursor-pointer place-items-center rounded-md px-2 text-sm font-medium text-muted has-[:checked]:bg-ink has-[:checked]:text-surface has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {option.icon ?? option.label}
          {option.icon && <span className="sr-only">{option.label}</span>}
        </label>
      ))}
    </fieldset>
  );
}
