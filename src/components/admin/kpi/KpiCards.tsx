import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsKpiResponse } from "@/types";

interface KpiCardsProps {
  data: AnalyticsKpiResponse;
}

export function KpiCards({ data }: KpiCardsProps) {
  const aiAcceptanceRatePercent = Math.round(data.ai_acceptance_rate * 100);
  const aiSharePercent = Math.round(data.ai_share * 100);
  const totalAi = data.totals.ai;
  const totalManual = data.totals.manual;
  const totalAll = totalAi + totalManual;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      <Card className="border-blue-500 bg-blue-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">AI Acceptance Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{aiAcceptanceRatePercent}%</div>
          <p className="text-xs text-muted-foreground">Percentage of accepted AI candidates</p>
        </CardContent>
      </Card>

      <Card className="border-purple-500 bg-purple-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">AI Share</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{aiSharePercent}%</div>
          <p className="text-xs text-muted-foreground">AI flashcards share vs manual</p>
        </CardContent>
      </Card>

      <Card className="border-green-500 bg-green-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">AI Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAi.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Number of AI-generated flashcards</p>
        </CardContent>
      </Card>

      <Card className="border-orange-500 bg-orange-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Manual Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalManual.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Number of manually created flashcards</p>
        </CardContent>
      </Card>

      <Card className="border-gray-500 bg-gray-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAll.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Total number of flashcards</p>
        </CardContent>
      </Card>
    </div>
  );
}
