export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <span className="text-base font-semibold tracking-tight">WeatherBoard</span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Find a city</h1>
        <p className="mt-2 text-sm text-muted">Search for any city to see current conditions and a 5-day forecast.</p>
      </main>
    </div>
  );
}
