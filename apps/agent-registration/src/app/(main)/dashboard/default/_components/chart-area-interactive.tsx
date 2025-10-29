"use client";

import * as React from "react";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMyRegistrationsChart, getAllRegistrationsChart } from "@/lib/api";

export const description = "An interactive area chart";

interface ChartAreaInteractiveProps {
  /** If true, fetch data for all registrations (admin). If false, fetch for current user (agent). */
  isAdminView?: boolean;
}

const chartConfig = {
  customers: {
    label: "Customers",
  },
  mobile: {
    label: "Registrations",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function ChartAreaInteractive({ isAdminView = false }: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState<'7d' | '30d' | '90d'>("7d");
  const [chartData, setChartData] = React.useState<Array<{ date: string; mobile: number }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = isAdminView
          ? await getAllRegistrationsChart(timeRange)
          : await getMyRegistrationsChart(timeRange);

        // Transform API data to chart format
        const transformedData = response.data.map(item => ({
          date: item.date,
          mobile: item.count,
        }));

        setChartData(transformedData);
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError('Failed to load chart data');
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange, isAdminView]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Customers</CardTitle>
        <CardDescription>
          {loading ? (
            'Loading...'
          ) : error ? (
            <span className="text-red-500">{error}</span>
          ) : (
            <>
              <span className="hidden @[540px]/card:block">
                {timeRange === '90d' ? 'Total for the last 3 months' : timeRange === '30d' ? 'Total for the last 30 days' : 'Total for the last 7 days'}
              </span>
              <span className="@[540px]/card:hidden">
                {timeRange === '90d' ? 'Last 3 months' : timeRange === '30d' ? 'Last 30 days' : 'Last 7 days'}
              </span>
            </>
          )}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as '7d' | '30d' | '90d')}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as '7d' | '30d' | '90d')}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-muted-foreground">Loading chart data...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-red-500">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-muted-foreground">No data available for this period</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-mobile)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-mobile)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                defaultIndex={isMobile ? -1 : 10}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area dataKey="mobile" type="natural" fill="url(#fillMobile)" stroke="var(--color-mobile)" />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
