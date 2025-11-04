'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check } from 'lucide-react'

export default function GetTokenPage() {
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function getToken() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session?.access_token) {
          setToken('No valid session found. Please log in first.')
          return
        }
        setToken(session.access_token)
      } catch (error) {
        setToken('Error getting token: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }
    getToken()
  }, [])

  const copyToClipboard = async () => {
    if (token) {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Get Supabase Token</CardTitle>
          <CardDescription>
            Copy this token to use in API requests (e.g., curl, Postman)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <>
              <div className="space-y-2">
                <Label>Your Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    value={token}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm font-semibold mb-2">Example curl command:</p>
                <code className="text-xs block whitespace-pre-wrap break-all">
{`curl -X POST http://localhost:3001/api/internal/partner-management/brand-ambassadors/cleanup-metadata \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token.substring(0, 50)}..." \\
  -H "x-correlation-id: cleanup-$(date +%s)"`}
                </code>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Loading token...</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

