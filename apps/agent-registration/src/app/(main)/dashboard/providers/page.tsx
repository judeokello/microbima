'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Hospital, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  downloadPackageProvidersCsv,
  getPackageProviderPanels,
  type PackageProviderPanelSummary,
} from '@/lib/api';

export default function ProvidersPackagesPage() {
  const router = useRouter();
  const [panels, setPanels] = useState<PackageProviderPanelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadPanels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPackageProviderPanels();
      setPanels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider panels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanels();
  }, [loadPanels]);

  const handleDownload = async (event: React.MouseEvent, packageId: number, packageName: string) => {
    event.stopPropagation();
    try {
      setDownloadingId(packageId);
      const blob = await downloadPackageProvidersCsv(packageId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${packageName.replace(/\s+/g, '-').toLowerCase()}-provider-panel.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download provider panel');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading && panels.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading provider panels...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Providers</h1>
        <p className="mt-2 text-muted-foreground">
          View and download healthcare provider panels by product package
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Product packages</CardTitle>
          <CardDescription>
            Click a package to browse its provider panel, or download the full list
          </CardDescription>
        </CardHeader>
        <CardContent>
          {panels.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No packages found</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Providers</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panels.map((panel) => (
                    <TableRow
                      key={panel.packageId}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/dashboard/providers/${panel.packageId}`)}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2 text-blue-600 hover:underline">
                          <Hospital className="h-4 w-4" />
                          {panel.packageName}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {panel.packageSlug ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {panel.providerCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={panel.providerCount === 0 || downloadingId === panel.packageId}
                          onClick={(event) =>
                            handleDownload(event, panel.packageId, panel.packageName)
                          }
                        >
                          {downloadingId === panel.packageId ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
