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
import { User, Mail, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';


const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

export function ProfileForm() {
  const [isPending, startTransition] = useTransition();
  const { user, isLoading } = useUser();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      name: user?.displayName || '',
      email: user?.email || '',
    },
    defaultValues: {
      name: '',
      email: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;

    startTransition(async () => {
      try {
        await updateProfile(user, {
            displayName: values.name,
        });
        // Note: updating email with Firebase Auth requires re-authentication.
        // We are skipping that for simplicity here.
        toast({
            title: 'Success!',
            description: 'Your profile has been updated.',
        });
      } catch (error: any) {
         toast({
            title: 'Error updating profile',
            description: error.message,
            variant: 'destructive',
        });
      }
    });
  }

  if (isLoading) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin" />;
  }
  
  if (!user) {
    return <p>Please log in to view your profile.</p>;
  }

  const displayName = user.displayName || user.email || 'User';
  const avatarFallback = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="grid gap-6">
        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <Button variant="outline">Change Photo</Button>
        </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Your name" {...field} className="pl-10" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="your.email@example.com" {...field} className="pl-10" disabled />
                  </div>
                </FormControl>
                 <p className="text-xs text-muted-foreground">You cannot change your email address.</p>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full md:w-auto" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </Form>
    </div>
  );
}
