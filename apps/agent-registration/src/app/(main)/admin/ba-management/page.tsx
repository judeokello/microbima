'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Edit, Eye, UserX } from 'lucide-react'
import { getBrandAmbassadors, BrandAmbassador, Partner } from '@/lib/api'

export default function BAManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brandAmbassadors, setBrandAmbassadors] = useState<BrandAmbassador[]>([])
  const [partners, setPartners] = useState<Partner[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [baData, partnersData] = await Promise.all([
        getBrandAmbassadors(),
        // TODO: Add getPartners() when implemented
        Promise.resolve([
          { id: 1, partnerName: 'Sample Partner 1' },
          { id: 2, partnerName: 'Sample Partner 2' }
        ])
      ])
      
      setBrandAmbassadors(baData)
      setPartners(partnersData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const getPartnerName = (partnerId: number) => {
    const partner = partners.find(p => p.id === partnerId)
    return partner?.partnerName || `Partner ${partnerId}`
  }

  const formatRate = (cents: number) => {
    return `KSh ${(cents / 100).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading brand ambassadors...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Brand Ambassador Management</h2>
          <p className="text-muted-foreground">
            Manage brand ambassadors and their partner assignments
          </p>
        </div>
        <Button onClick={() => router.push('/admin/ba-registration')}>
          <Plus className="mr-2 h-4 w-4" />
          Register New BA
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Brand Ambassadors ({brandAmbassadors.length})</CardTitle>
          <CardDescription>
            View and manage all registered brand ambassadors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brandAmbassadors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No brand ambassadors found</p>
              <Button onClick={() => router.push('/admin/ba-registration')}>
                <Plus className="mr-2 h-4 w-4" />
                Register First BA
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Rate per Registration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brandAmbassadors.map((ba) => (
                    <TableRow key={ba.id}>
                      <TableCell className="font-medium">
                        {ba.displayName || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {getPartnerName(ba.partnerId)}
                      </TableCell>
                      <TableCell>
                        {ba.phone || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {ba.perRegistrationRateCents ? formatRate(ba.perRegistrationRateCents) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ba.isActive ? 'default' : 'secondary'}>
                          {ba.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(ba.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement view details
                              console.log('View BA:', ba.id)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement edit
                              console.log('Edit BA:', ba.id)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {ba.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // TODO: Implement deactivate
                                console.log('Deactivate BA:', ba.id)
                              }}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
  )
}

