'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useTransition, useState } from 'react';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';

const API_URL = 'https://emspartner.espserver.site/api/user/password/change';

const formSchema = z.object({
  oldPassword: z.string().min(1, { message: 'Current password is required.' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters.' }),
});

export function PasswordChangeForm() {
  const [isPending, startTransition] = useTransition();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const { toast } = useToast();
  const { token } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      try {
        if (!token) throw new Error("You are not logged in.");

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(values)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Failed to change password.");

        toast({
          title: 'Success',
          description: 'Your password has been updated.',
        });
        form.reset();
      } catch (error: any) {
        toast({
          title: 'Error updating password',
          description: error.message,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div>
      <h3 className="text-lg font-medium">Change Password</h3>
      <p className="text-sm text-muted-foreground mb-4">Update your password here.</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="oldPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="••••••••" 
                        {...field} 
                        className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                   <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input 
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••" 
                        {...field} 
                        className="pl-10 pr-10"
                     />
                     <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full md:w-auto" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </Form>
    </div>
  );
}