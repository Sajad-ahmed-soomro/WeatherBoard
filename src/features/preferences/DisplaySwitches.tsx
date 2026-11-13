import { MonitorIcon, MoonIcon, SunIcon } from '../../components/ui/icons';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { TempUnit } from '../../lib/units/format';
import type { ThemePreference } from './theme';

const ICON = { width: 18, height: 18 };

const THEME_OPTIONS = [
  { value: 'system', label: 'System theme', icon: <MonitorIcon {...ICON} /> },
  { value: 'light', label: 'Light theme', icon: <SunIcon {...ICON} /> },
  { value: 'dark', label: 'Dark theme', icon: <MoonIcon {...ICON} /> },
] as const;

const UNIT_OPTIONS = [
  { value: 'c', label: '°C' },
  { value: 'f', label: '°F' },
] as const;

interface DisplaySwitchesProps {
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  unit: TempUnit;
  onUnitChange: (value: TempUnit) => void;
}

export function DisplaySwitches({ theme, onThemeChange, unit, onUnitChange }: DisplaySwitchesProps) {
  return (
    <div className="flex items-center gap-2">
      <SegmentedControl legend="Temperature unit" options={UNIT_OPTIONS} value={unit} onChange={onUnitChange} />
      <SegmentedControl legend="Theme" options={THEME_OPTIONS} value={theme} onChange={onThemeChange} />
    </div>
  );
}
