import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsTrendPointDTO } from "@/types";

interface KpiTrendChartProps {
  trend: AnalyticsTrendPointDTO[];
}

export function KpiTrendChart({ trend }: KpiTrendChartProps) {
  if (!trend || trend.length === 0) {
    return null;
  }

  const validatedTrend = trend.map((point) => {
    const ai = Number(point.ai) || 0;
    const manual = Number(point.manual) || 0;
    const accepted_ai = Number(point.accepted_ai) || 0;

    return {
      date: point.date,
      ai,
      manual,
      accepted_ai,
    };
  });

  const validTrend = validatedTrend.filter(
    (point) => !isNaN(point.ai) && !isNaN(point.manual) && !isNaN(point.accepted_ai)
  );

  if (validTrend.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trend Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No trend data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  const width = 600;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const maxAi = Math.max(...validTrend.map((d) => d.ai));
  const maxManual = Math.max(...validTrend.map((d) => d.manual));
  const maxAccepted = Math.max(...validTrend.map((d) => d.accepted_ai));
  const maxValue = Math.max(maxAi, maxManual, maxAccepted, 1);
  const safeMaxValue = maxValue === 0 ? 1 : maxValue;

  const xScale = (index: number) => {
    if (validTrend.length === 1) return innerWidth / 2;
    return (index / (validTrend.length - 1)) * innerWidth;
  };
  const yScale = (value: number) => innerHeight - (value / safeMaxValue) * innerHeight;

  const generatePath = (data: number[]) => {
    return data
      .map((value, index) => {
        const x = xScale(index);
        const y = yScale(value);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const hasNonZeroData = validTrend.some((point) => point.ai > 0 || point.manual > 0 || point.accepted_ai > 0);

  const aiPath = generatePath(validTrend.map((d) => d.ai));
  const manualPath = generatePath(validTrend.map((d) => d.manual));
  const acceptedPath = generatePath(validTrend.map((d) => d.accepted_ai));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trend Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasNonZeroData ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            All values are zero for the selected period
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg width={width} height={height} className="border rounded">
              <g transform={`translate(${margin.left}, ${margin.top})`}>
                <defs>
                  <pattern id="grid" width={innerWidth / 10} height={innerHeight / 5} patternUnits="userSpaceOnUse">
                    <path
                      d={`M ${innerWidth / 10} 0 L 0 0 0 ${innerHeight / 5}`}
                      fill="none"
                      stroke="#f0f0f0"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width={innerWidth} height={innerHeight} fill="url(#grid)" />

                <line x1="0" y1="0" x2="0" y2={innerHeight} stroke="#666" strokeWidth="1" />
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const value = Math.round(safeMaxValue * ratio);
                  const y = yScale(value);
                  return (
                    <g key={ratio}>
                      <line x1="-5" y1={y} x2="0" y2={y} stroke="#666" strokeWidth="1" />
                      <text x="-10" y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                        {value}
                      </text>
                    </g>
                  );
                })}

                <line x1="0" y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#666" strokeWidth="1" />
                {validTrend.map((point, index) => {
                  const x = xScale(index);
                  const date = new Date(point.date);
                  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <g key={point.date}>
                      <line x1={x} y1={innerHeight} x2={x} y2={innerHeight + 5} stroke="#666" strokeWidth="1" />
                      <text x={x} y={innerHeight + 20} textAnchor="middle" fontSize="12" fill="#666">
                        {label}
                      </text>
                    </g>
                  );
                })}

                <path d={aiPath} fill="none" stroke="#3b82f6" strokeWidth="2" />
                <path d={manualPath} fill="none" stroke="#ef4444" strokeWidth="2" />
                <path d={acceptedPath} fill="none" stroke="#10b981" strokeWidth="2" />

                {validTrend.map((point, index) => {
                  const x = xScale(index);
                  return (
                    <g key={`points-${index}`}>
                      {point.ai > 0 && (
                        <circle cx={x} cy={yScale(point.ai)} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" />
                      )}
                      {point.manual > 0 && (
                        <circle cx={x} cy={yScale(point.manual)} r="4" fill="#ef4444" stroke="white" strokeWidth="2" />
                      )}
                      {point.accepted_ai > 0 && (
                        <circle
                          cx={x}
                          cy={yScale(point.accepted_ai)}
                          r="4"
                          fill="#10b981"
                          stroke="white"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                })}

                <g transform={`translate(${innerWidth - 120}, 10)`}>
                  <circle cx="0" cy="0" r="4" fill="#3b82f6" />
                  <text x="10" y="4" fontSize="12" fill="#666">
                    AI
                  </text>
                  <circle cx="0" cy="16" r="4" fill="#ef4444" />
                  <text x="10" y="20" fontSize="12" fill="#666">
                    Manual
                  </text>
                  <circle cx="0" cy="32" r="4" fill="#10b981" />
                  <text x="10" y="36" fontSize="12" fill="#666">
                    Accepted AI
                  </text>
                </g>
              </g>
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
