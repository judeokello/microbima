'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  downloadPackageProvidersCsv,
  getPackageProviderPanels,
  getPackageProviders,
  type HealthcareProviderListItem,
  type HealthcareProviderPagination,
} from '@/lib/api';

export default function PackageProvidersPage() {
  const params = useParams();
  const packageId = useMemo(() => {
    const raw = params?.packageId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params]);

  const [packageName, setPackageName] = useState<string>('Package');
  const [providers, setProviders] = useState<HealthcareProviderListItem[]>([]);
  const [pagination, setPagination] = useState<HealthcareProviderPagination | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    if (!packageId) return;
    void (async () => {
      try {
        const panels = await getPackageProviderPanels();
        const match = panels.find((p) => p.packageId === packageId);
        if (match) setPackageName(match.packageName);
      } catch {
        // Name is optional context; list still loads
      }
    })();
  }, [packageId]);

  const loadProviders = useCallback(async () => {
    if (!packageId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await getPackageProviders(packageId, {
        page: currentPage,
        pageSize,
        search,
      });
      setProviders(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
      setProviders([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [packageId, currentPage, search]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput.trim());
  };

  const handleDownload = async () => {
    if (!packageId) return;
    try {
      setDownloading(true);
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
      setDownloading(false);
    }
  };

  if (!packageId) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600">Invalid package id</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard/providers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to packages
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{packageName} providers</h1>
          <p className="mt-2 text-muted-foreground">
            Search and browse the healthcare provider panel for this package
          </p>
        </div>
        <Button onClick={handleDownload} disabled={downloading}>
          {downloading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download panel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Find a provider by name</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g. Bliss GVS"
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
            {search && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setCurrentPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Providers</CardTitle>
          <CardDescription>
            {pagination
              ? `${pagination.totalItems.toLocaleString()} providers${search ? ` matching “${search}”` : ''}`
              : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && providers.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading providers...</span>
            </div>
          ) : providers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No providers found</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider name</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Sub-county</TableHead>
                      <TableHead>GPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.name}</TableCell>
                        <TableCell>{provider.countyName}</TableCell>
                        <TableCell>{provider.subCountyName ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {provider.latitude != null && provider.longitude != null
                            ? `${provider.latitude}, ${provider.longitude}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of{' '}
                    {pagination.totalItems} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((page) => page - 1)}
                      disabled={!pagination.hasPreviousPage || loading}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((page) => page + 1)}
                      disabled={!pagination.hasNextPage || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
