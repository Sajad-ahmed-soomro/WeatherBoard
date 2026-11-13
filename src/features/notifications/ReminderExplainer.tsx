import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface ReminderExplainerProps {
  open: boolean;
  time: string;
  cityName: string;
  onContinue: () => void;
  onCancel: () => void;
}

/** Shown before the browser's permission prompt, so the prompt is never a surprise. */
export function ReminderExplainer({ open, time, cityName, onContinue, onCancel }: ReminderExplainerProps) {
  return (
    <ConfirmDialog
      open={open}
      tone="primary"
      title="Get a daily weather reminder?"
      confirmLabel="Continue"
      cancelLabel="Not now"
      onConfirm={onContinue}
      onCancel={onCancel}
      description={
        <>
          <p>
            Once a day, around <span className="font-medium text-ink">{time}</span>, WeatherBoard shows a notification with today's forecast for{' '}
            <span className="font-medium text-ink">{cityName}</span>.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Next, your browser asks whether WeatherBoard may show notifications.</li>
            <li>Your reminder settings stay on this device. Nothing else is collected.</li>
            <li>You can turn the reminder off here at any time.</li>
          </ul>
        </>
      }
    />
  );
}
