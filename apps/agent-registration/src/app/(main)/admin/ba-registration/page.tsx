'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { createBrandAmbassador, ROLES } from '@/lib/api'

interface Partner {
  id: number
  partnerName: string
}

export default function BARegistrationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    phone: '',
    partnerId: '',
    perRegistrationRateCents: '',
    roles: [ROLES.BRAND_AMBASSADOR] // Default to BA role
  })

  const [partners, setPartners] = useState<Partner[]>([])

  // Load partners on component mount
  useState(() => {
    // TODO: Load partners from API
    setPartners([
      { id: 1, partnerName: 'Sample Partner 1' },
      { id: 2, partnerName: 'Sample Partner 2' }
    ])
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate form
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (!formData.email || !formData.password || !formData.displayName || !formData.partnerId) {
        throw new Error('Please fill in all required fields')
      }

      // Role validation - at least one role must be selected
      if (formData.roles.length === 0) {
        throw new Error('Please select at least one role')
      }

      // Create BA
      await createBrandAmbassador({
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        phone: formData.phone,
        partnerId: parseInt(formData.partnerId),
        perRegistrationRateCents: parseInt(formData.perRegistrationRateCents) || 0,
        roles: formData.roles
      })

      setSuccess(true)
      setTimeout(() => {
        router.push('/admin/ba-management')
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleRoleToggle = (role: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      roles: checked 
        ? [...prev.roles, role]
        : prev.roles.filter(r => r !== role)
    }))
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Success!</CardTitle>
            <CardDescription>
              Brand Ambassador has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Redirecting to BA management...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Register Brand Ambassador</CardTitle>
          <CardDescription>
            Create a new brand ambassador account with partner assignment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="ba@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+254700000000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnerId">Partner *</Label>
                <Select value={formData.partnerId} onValueChange={(value) => handleInputChange('partnerId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id.toString()}>
                        {partner.partnerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="perRegistrationRateCents">Per Registration Rate (KSh)</Label>
              <Input
                id="perRegistrationRateCents"
                type="number"
                value={formData.perRegistrationRateCents}
                onChange={(e) => handleInputChange('perRegistrationRateCents', e.target.value)}
                placeholder="500"
                min="0"
              />
              <p className="text-sm text-muted-foreground">
                Rate in Kenyan Shillings per successful registration
              </p>
            </div>

            <div className="space-y-3">
              <Label>User Roles</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="brand_ambassador"
                    checked={formData.roles.includes(ROLES.BRAND_AMBASSADOR)}
                    onCheckedChange={(checked) => handleRoleToggle(ROLES.BRAND_AMBASSADOR, checked as boolean)}
                  />
                  <Label htmlFor="brand_ambassador" className="text-sm font-normal">
                    Brand Ambassador (can register customers)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="registration_admin"
                    checked={formData.roles.includes(ROLES.REGISTRATION_ADMIN)}
                    onCheckedChange={(checked) => handleRoleToggle(ROLES.REGISTRATION_ADMIN, checked as boolean)}
                  />
                  <Label htmlFor="registration_admin" className="text-sm font-normal">
                    Registration Admin (can manage BAs and resolve MRs)
                  </Label>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Select one or both roles. Brand Ambassador is required for customer registration.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/ba-management')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Brand Ambassador
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
