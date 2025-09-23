import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Ambassador Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to your dashboard. Track your registrations and earnings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Registrations</p>
            <div className="text-lg font-semibold text-green-600">0 KES</div>
            <p className="text-xs text-muted-foreground">Earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yesterday</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Registrations</p>
            <div className="text-lg font-semibold text-green-600">0 KES</div>
            <p className="text-xs text-muted-foreground">Earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Registrations</p>
            <div className="text-lg font-semibold text-green-600">0 KES</div>
            <p className="text-xs text-muted-foreground">Earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Registrations</p>
            <div className="text-lg font-semibold text-green-600">0 KES</div>
            <p className="text-xs text-muted-foreground">Earnings</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
            <CardDescription>Your latest customer registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No registrations yet. Start registering customers to see them here.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">• Register new customer</p>
              <p className="text-sm text-muted-foreground">• View earnings history</p>
              <p className="text-sm text-muted-foreground">• Update profile</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}