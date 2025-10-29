'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, X, Check, Loader2 } from 'lucide-react';
import { searchCustomers, CustomerSearchResult, CustomerSearchPagination } from '@/lib/api';

export default function CustomerSearchPage() {
  const [idNumber, setIdNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [pagination, setPagination] = useState<CustomerSearchPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (page: number = 1) => {
    // At least one search field must be filled
    if (!idNumber.trim() && !phoneNumber.trim() && !email.trim()) {
      setError('Please enter at least one search criterion (ID Number, Phone Number, or Email)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const response = await searchCustomers(
        idNumber.trim() || undefined,
        phoneNumber.trim() || undefined,
        email.trim() || undefined,
        page,
        20
      );

      setSearchResults(response.data);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Error searching customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to search customers');
      setSearchResults([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setIdNumber('');
    setPhoneNumber('');
    setEmail('');
    setSearchResults([]);
    setPagination(null);
    setError(null);
    setHasSearched(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customer Search</h1>
        <p className="text-gray-600 mt-2">
          Search for customers by ID number, phone number, or email address
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Search Criteria</CardTitle>
          <CardDescription>
            Enter at least one search parameter. Partial matches are supported.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
              <Input
                id="idNumber"
                placeholder="e.g. 123..."
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">Searches all ID types</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                placeholder="e.g. 0700..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">Partial match supported</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. john@..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">Partial match supported</p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={() => handleSearch()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              disabled={loading}
            >
              Clear
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {hasSearched && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {pagination ? `Found ${pagination.totalItems} customer(s)` : 'No customers found'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No customers match your search criteria</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>ID Type</TableHead>
                        <TableHead>ID Number</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-center">Spouses</TableHead>
                        <TableHead className="text-center">Children</TableHead>
                        <TableHead className="text-center">NoK Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            {customer.fullName}
                          </TableCell>
                          <TableCell>
                            {customer.idType.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>{customer.idNumber}</TableCell>
                          <TableCell>{customer.phoneNumber}</TableCell>
                          <TableCell>{customer.email ?? '-'}</TableCell>
                          <TableCell className="text-center">
                            {customer.numberOfSpouses}
                          </TableCell>
                          <TableCell className="text-center">
                            {customer.numberOfChildren}
                          </TableCell>
                          <TableCell className="text-center">
                            {customer.nokAdded ? (
                              <Check className="h-5 w-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-red-600 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSearch(pagination.page - 1)}
                        disabled={!pagination.hasPreviousPage || loading}
                        variant="outline"
                        size="sm"
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={() => handleSearch(pagination.page + 1)}
                        disabled={!pagination.hasNextPage || loading}
                        variant="outline"
                        size="sm"
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
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-4 text-gray-600">Searching customers...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

