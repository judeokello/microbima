'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function BootstrapPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
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

      if (!formData.email || !formData.password || !formData.displayName) {
        throw new Error('Please fill in all required fields')
      }

      // Check if bootstrap is enabled via environment variable
      if (process.env.NEXT_PUBLIC_ENABLE_BOOTSTRAP !== 'true') {
        throw new Error('Bootstrap is not enabled. Set NEXT_PUBLIC_ENABLE_BOOTSTRAP=true to enable.')
      }

      // Create first admin user via backend (auto-confirms email)
      const createUserResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/bootstrap/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': `bootstrap-create-${Date.now()}`
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName
        })
      })

      if (!createUserResponse.ok) {
        const errorData = await createUserResponse.json()
        throw new Error(errorData.error?.message ?? 'Failed to create user')
      }

      const createUserResult = await createUserResponse.json()
      const userId = createUserResult.userId

      // Sign in the user to get a valid session token
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      })

      if (signInError) {
        throw new Error(`Failed to sign in: ${signInError.message}`)
      }

      // Use the signed-in session for API calls
      const session = signInData.session

      // Step 1: Seed initial system data (Maisha Poa partner + MfanisiGo product)
      try {
        const seedResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/bootstrap/seed-initial-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-correlation-id': `bootstrap-seed-${Date.now()}`
          },
          body: JSON.stringify({
            userId: userId
          })
        })

        if (!seedResponse.ok) {
          const errorText = await seedResponse.text()
          console.warn('Failed to seed initial data:', errorText)
          throw new Error(`Failed to seed initial data: ${errorText}`)
        }

        const seedResult = await seedResponse.json()
        console.log('✅ Initial data seeded:', seedResult)
      } catch (seedError) {
        console.error('Error seeding initial data:', seedError)
        throw new Error(`Failed to seed initial system data. Please contact support.`)
      }

      // Step 2: Create Brand Ambassador record in the database
      try {
        const baResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/partners/1/brand-ambassadors/from-existing-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'x-correlation-id': `bootstrap-ba-${Date.now()}`
          },
          body: JSON.stringify({
            userId: userId,
            displayName: formData.displayName,
            phoneNumber: '+254700000000', // Default phone number
            perRegistrationRateCents: 500, // 5.00 KES per registration
            isActive: true
          })
        })

        if (!baResponse.ok) {
          const errorText = await baResponse.text()
          console.warn('Failed to create Brand Ambassador record:', errorText)
          throw new Error(`Failed to create Brand Ambassador: ${errorText}`)
        }

        const baResult = await baResponse.json()
        console.log('✅ Brand Ambassador created:', baResult)
      } catch (baError) {
        console.error('Error creating Brand Ambassador record:', baError)
        throw new Error(`Failed to create Brand Ambassador. Please contact support.`)
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Bootstrap Complete!</CardTitle>
            <CardDescription>
              Your first admin user has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              You can now log in with your admin credentials.
            </p>
            <Button onClick={() => router.push('/auth/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>Bootstrap First Admin</CardTitle>
                <CardDescription>
                  Create your first admin user (Development only)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  placeholder="Admin User"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Admin User
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                This will create a user with <code className="bg-gray-100 px-1 rounded">registration_admin</code> role.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
