'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { supabase, ROLES } from '@/lib/supabase'
import { checkBrandAmbassadorActiveStatus } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        // Get user roles from metadata
        const userMetadata = data.user.user_metadata as { roles?: string[] }
        const roles = userMetadata.roles ?? []

        // Check if user is BA-only (has brand_ambassador but NOT registration_admin)
        const isBAOnly = roles.includes(ROLES.BRAND_AMBASSADOR) && !roles.includes(ROLES.REGISTRATION_ADMIN)

        if (isBAOnly) {
          // Check BA active status before allowing login
          try {
            const status = await checkBrandAmbassadorActiveStatus(data.user.id)

            if (!status.exists || !status.isActive) {
              // BA is inactive or doesn't exist - sign out and show error
              await supabase.auth.signOut()
              setError('Your account has been deactivated. Please contact your administrator.')
              return
            }
          } catch (error) {
            console.error('Error checking BA status:', error)
            // On API error, still allow login but log the error
            // This prevents network issues from blocking legitimate users
          }
        }

        // Redirect based on user roles
        if (roles.includes('registration_admin')) {
          router.push('/admin')
        } else if (roles.includes('brand_ambassador')) {
          router.push('/dashboard')
        } else {
          router.push('/')
        }
      }
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Sign in to your MicroBima Agent Registration account
            </CardDescription>
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
                  placeholder="Enter your email"
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
                  placeholder="Enter your password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Need an account? Contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

