"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function AddRolePage() {
  const [email, setEmail] = useState('fatnusketch@gmail.com');
  const [role, setRole] = useState('brand_ambassador');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const addRole = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Not authenticated. Please log in first.');
      }

      // Get current user metadata
      const currentMetadata = user.user_metadata as { roles?: string[] };
      const currentRoles = currentMetadata.roles ?? [];

      // Check if role already exists
      if (currentRoles.includes(role)) {
        setResult({
          success: true,
          message: `User already has the role: ${role}`
        });
        setLoading(false);
        return;
      }

      // Add the new role
      const newRoles = [...currentRoles, role];

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          roles: newRoles
        }
      });

      if (updateError) {
        throw new Error(`Failed to update user: ${updateError.message}`);
      }

      setResult({
        success: true,
        message: `Successfully added role "${role}" to user. New roles: ${newRoles.join(', ')}`
      });

    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add Role to User</CardTitle>
          <CardDescription>
            Add a role to the current authenticated user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role to Add</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="brand_ambassador"
            />
          </div>

          <Button
            onClick={addRole}
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Role
          </Button>

          {result && (
            <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <AlertDescription className={result.success ? "text-green-800" : "text-red-800"}>
                {result.message}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-600">
            <p><strong>Current user roles:</strong></p>
            <p>This will add the role to the currently logged-in user.</p>
            <p><strong>Available roles:</strong></p>
            <ul className="list-disc list-inside ml-2">
              <li>brand_ambassador</li>
              <li>registration_admin</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
