'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Plus, Edit, Key } from 'lucide-react'
import { getBrandAmbassadors, getPartners, BrandAmbassador, Partner } from '@/lib/api'
import EditBADialog from './_components/edit-ba-dialog'
import ChangePasswordDialog from './_components/change-password-dialog'

type StatusTab = 'active' | 'archived'

export default function BAManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brandAmbassadors, setBrandAmbassadors] = useState<BrandAmbassador[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [statusTab, setStatusTab] = useState<StatusTab>('active')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBA, setSelectedBA] = useState<BrandAmbassador | null>(null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [selectedBAForPassword, setSelectedBAForPassword] = useState<BrandAmbassador | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [baData, partnersData] = await Promise.all([
        getBrandAmbassadors(),
        getPartners()
      ])

      setBrandAmbassadors(baData)
      setPartners(partnersData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const activeBrandAmbassadors = useMemo(
    () => brandAmbassadors.filter((ba) => ba.isActive),
    [brandAmbassadors]
  )

  const archivedBrandAmbassadors = useMemo(
    () => brandAmbassadors.filter((ba) => !ba.isActive),
    [brandAmbassadors]
  )

  const getPartnerName = (ba: BrandAmbassador) => {
    // Use partner data from BA record if available, otherwise fallback to partners list
    if (ba.partner) {
      return ba.partner.partnerName
    }
    const partner = partners.find(p => p.id === ba.partnerId)
    return partner?.partnerName ?? `Partner ${ba.partnerId}`
  }

  const formatRate = (cents: number) => {
    // Display in shillings (cents / 100) as integer
    return `KSh ${Math.round(cents / 100)}`
  }

  const handleEditClick = (ba: BrandAmbassador) => {
    setSelectedBA(ba)
    setEditDialogOpen(true)
  }

  const handlePasswordClick = (ba: BrandAmbassador) => {
    setSelectedBAForPassword(ba)
    setPasswordDialogOpen(true)
  }

  const handleEditSuccess = () => {
    loadData()
  }

  const handlePasswordSuccess = () => {
    loadData()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const renderTable = (rows: BrandAmbassador[], emptyMessage: string, showRegisterCta: boolean) => {
    if (rows.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">{emptyMessage}</p>
          {showRegisterCta && (
            <Button onClick={() => router.push('/admin/ba-registration')}>
              <Plus className="mr-2 h-4 w-4" />
              Register First BA
            </Button>
          )}
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Rate per Registration</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((ba) => (
              <TableRow key={ba.id}>
                <TableCell className="font-medium">
                  {ba.displayName ?? 'N/A'}
                </TableCell>
                <TableCell>
                  {getPartnerName(ba)}
                </TableCell>
                <TableCell>
                  {ba.phoneNumber ?? 'N/A'}
                </TableCell>
                <TableCell>
                  {ba.perRegistrationRateCents ? formatRate(ba.perRegistrationRateCents) : 'N/A'}
                </TableCell>
                <TableCell>
                  {formatDate(ba.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(ba)}
                      title="Edit Brand Ambassador"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePasswordClick(ba)}
                      title="Change Password"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
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
          <h2 className="text-2xl font-bold">Agent Management</h2>
          <p className="text-muted-foreground">
            Manage agents and their account details
          </p>
        </div>
        <Button onClick={() => router.push('/admin/ba-registration')}>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {statusTab === 'active'
              ? `Active Brand Ambassadors (${activeBrandAmbassadors.length})`
              : `Archived Brand Ambassadors (${archivedBrandAmbassadors.length})`}
          </CardTitle>
          <CardDescription>
            {statusTab === 'active'
              ? 'View and manage active brand ambassadors'
              : 'View and manage archived brand ambassadors'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={statusTab}
            onValueChange={(value) => setStatusTab(value as StatusTab)}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="active">
                Active ({activeBrandAmbassadors.length})
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archived ({archivedBrandAmbassadors.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {renderTable(
                activeBrandAmbassadors,
                'No active brand ambassadors found',
                brandAmbassadors.length === 0
              )}
            </TabsContent>
            <TabsContent value="archived">
              {renderTable(
                archivedBrandAmbassadors,
                'No archived brand ambassadors found',
                false
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedBA && (
        <EditBADialog
          brandAmbassador={selectedBA}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={handleEditSuccess}
        />
      )}

      {selectedBAForPassword && (
        <ChangePasswordDialog
          brandAmbassadorId={selectedBAForPassword.id}
          brandAmbassadorName={selectedBAForPassword.displayName ?? 'Brand Ambassador'}
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          onSuccess={handlePasswordSuccess}
        />
      )}
    </div>
  )
}
