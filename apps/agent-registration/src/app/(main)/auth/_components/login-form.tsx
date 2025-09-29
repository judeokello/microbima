"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from '@/lib/supabase';

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const FormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  remember: z.boolean().optional(),
});

export function LoginForm() {
  const router = useRouter()
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    console.log('Login attempt started with:', data.email)

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      })

      console.log('Supabase response:', { authData, error })

      if (error) {
        console.log('Login error:', error)
        toast.error("Login failed", {
          description: error.message
        })
        return
      }

      if (authData.user) {
        // Get user roles from metadata
        const userMetadata = authData.user.user_metadata as { roles?: string[] }
        const roles = userMetadata.roles || []

        console.log('User metadata:', userMetadata)
        console.log('Roles:', roles)
        console.log('Full user object:', authData.user)

        toast.success("Login successful!")

        // Wait a moment for the session to be properly set
        setTimeout(() => {
          // Redirect based on roles
          if (roles.includes('registration_admin')) {
            console.log('Redirecting to /admin')
            console.log('Router object:', router)
            router.push('/admin')
            console.log('Router.push called for /admin')

            // Fallback: use window.location if router doesn't work
            setTimeout(() => {
              console.log('Using window.location fallback for /admin')
              window.location.href = '/admin'
            }, 1000)
          } else if (roles.includes('brand_ambassador')) {
            console.log('Redirecting to /dashboard')
            router.push('/dashboard')
            console.log('Router.push called for /dashboard')

            // Fallback: use window.location if router doesn't work
            setTimeout(() => {
              console.log('Using window.location fallback for /dashboard')
              window.location.href = '/dashboard'
            }, 1000)
          } else {
            console.log('No roles found, redirecting to /dashboard')
            router.push('/dashboard') // Default fallback
            console.log('Router.push called for /dashboard (fallback)')

            // Fallback: use window.location if router doesn't work
            setTimeout(() => {
              console.log('Using window.location fallback for /dashboard (fallback)')
              window.location.href = '/dashboard'
            }, 1000)
          }
        }, 500) // Wait 500ms for session to be set
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred", {
        description: err.message || 'Please try again'
      })
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="remember"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center">
              <FormControl>
                <Checkbox
                  id="login-remember"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="size-4"
                />
              </FormControl>
              <FormLabel htmlFor="login-remember" className="text-muted-foreground ml-1 text-sm font-medium">
                Remember me for 30 days
              </FormLabel>
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit">
          Login
        </Button>
      </form>
    </Form>
  );
}
