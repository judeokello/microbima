import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { DataTable } from "./_components/data-table";
import data from "./_components/data.json";
import { SectionCards } from "./_components/section-cards";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      {/* Header with Register Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Brand Ambassador Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to your dashboard. Track your registrations and earnings.
          </p>
        </div>
        <Link href="/register">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
            <PlusCircle className="mr-2 h-5 w-5" />
            Register New Customer
          </Button>
        </Link>
      </div>

      <SectionCards />
      <ChartAreaInteractive />
      <DataTable data={data} />
    </div>
  );
}
