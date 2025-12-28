interface KpiHeaderProps {
  title?: string;
  description?: string;
}

export function KpiHeader({
  title = "KPI Dashboard",
  description = "Overview of key metrics for AI flashcard generation and usage.",
}: KpiHeaderProps) {
  return (
    <header className="space-y-2">
      <h1 id="kpi-dashboard-title" className="text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground">{description}</p>
    </header>
  );
}
