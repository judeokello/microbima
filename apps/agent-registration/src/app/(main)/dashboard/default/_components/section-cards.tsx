import { TrendingUp, TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface BrandAmbassadorDashboardStats {
  registeredToday: number;
  registeredYesterday: number;
  registeredThisWeek: number;
  registeredLastWeek: number;
  myTotalRegistrations: number;
}

export interface SectionCardsProps {
  stats: BrandAmbassadorDashboardStats | null;
  loading: boolean;
  formatNumber: (num: number) => string;
}

export function SectionCards({ stats, loading, formatNumber }: SectionCardsProps) {
  // Calculate week-over-week change
  const weekChange = stats ? stats.registeredThisWeek - stats.registeredLastWeek : 0;
  const weekChangePercent = stats && stats.registeredLastWeek > 0
    ? Math.round((weekChange / stats.registeredLastWeek) * 100)
    : 0;

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Card 1: Registered Today */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Registered Today</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? '...' : stats ? formatNumber(stats.registeredToday) : '0'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUp />
              Today's registrations
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            New customers today <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Current day registrations</div>
        </CardFooter>
      </Card>

      {/* Card 2: Registered Yesterday */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Registered Yesterday</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? '...' : stats ? formatNumber(stats.registeredYesterday) : '0'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingDown />
              Previous day
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Yesterday's registrations <TrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground">Previous day performance</div>
        </CardFooter>
      </Card>

      {/* Card 3: Registered This Week */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Registered This Week</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? '...' : stats ? formatNumber(stats.registeredThisWeek) : '0'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {weekChange >= 0 ? <TrendingUp /> : <TrendingDown />}
              {weekChangePercent > 0 ? '+' : ''}{weekChangePercent}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {weekChange >= 0 ? 'Week over week growth' : 'Week over week decline'}
            {weekChange >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            Registered Last Week: {loading ? '...' : stats ? formatNumber(stats.registeredLastWeek) : '0'}
          </div>
        </CardFooter>
      </Card>

      {/* Card 4: My Total Registrations */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>My Total Registrations</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? '...' : stats ? formatNumber(stats.myTotalRegistrations) : '0'}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUp />
              All time
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total customers registered <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Your complete portfolio</div>
        </CardFooter>
      </Card>
    </div>
  );
}
