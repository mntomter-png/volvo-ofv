export default function AppLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6 py-2">
      <div className="h-8 w-64 rounded-md bg-muted" />
      <div className="h-4 w-96 max-w-full rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-muted" />
        <div className="h-72 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
