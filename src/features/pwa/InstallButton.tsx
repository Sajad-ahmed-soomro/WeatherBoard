interface InstallButtonProps {
  canInstall: boolean;
  onInstall: () => void;
}

/** Shown only when the browser has offered an install prompt (Chromium). */
export function InstallButton({ canInstall, onInstall }: InstallButtonProps) {
  if (!canInstall) return null;
  return (
    <button type="button" onClick={onInstall} className="min-h-touch rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-canvas">
      Install app
    </button>
  );
}
