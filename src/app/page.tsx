'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { useUser } from '@/hooks/use-user';

const features = [
  {
    icon: <ShieldCheck className="w-8 h-8 text-primary" />,
    title: 'Secure by Default',
    description: 'Robust email/password authentication and secure password recovery mechanisms.',
  },
  {
    icon: <svg role="img" viewBox="0 0 24 24" className="w-8 h-8 text-primary"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.3 1.63-4.5 1.63-5.42 0-9.82-4.4-9.82-9.82s4.4-9.82 9.82-9.82c3.04 0 5.2.83 6.62 2.35l-2.32 2.32c-.86-.82-2-1.4-3.5-1.4-4.23 0-7.62 3.38-7.62 7.62s3.39 7.62 7.62 7.62c2.62 0 4.37-1.12 5.05-1.78.6-.6.98-1.54 1.12-2.8H12.48z"></path></svg>,
    title: 'Social Sign-In',
    description: 'Seamless integration with Google Sign-In for quick and easy access.',
  },
  {
    icon: <UserPlus className="w-8 h-8 text-primary" />,
    title: 'User Profiles',
    description: 'Personalized user profiles to manage account information effortlessly.',
  },
];

export default function Home() {
  const { user, isLoading } = useUser();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            {isLoading ? null : user ? (
              <Button asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container grid items-center gap-6 pb-8 pt-6 md:py-20">
          <div className="flex max-w-[980px] flex-col items-start gap-4">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tighter md:text-5xl lg:text-6xl">
              Modern Authentication for your Next.js app.
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground">
              AuthZen provides a complete, secure, and beautiful authentication experience out of the box. Focus on your product, not on auth.
            </p>
          </div>
          <div className="flex gap-4">
            <Button asChild size="lg">
              <Link href="/register">Get Started Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Learn More</Link>
            </Button>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-5xl flex-col items-center space-y-4 text-center">
              <h2 className="font-bold text-3xl tracking-tighter sm:text-4xl md:text-5xl">Features</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Everything you need for a complete authentication flow, designed for a world-class user experience.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 pt-12">
              {features.map((feature, i) => (
                <div key={i} className="grid gap-2">
                  <div className="flex items-center gap-3">
                     {feature.icon}
                    <h3 className="text-lg font-bold">{feature.title}</h3>
                  </div>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with ❤️ by Firebase Studio.
          </p>
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-right">
            © {new Date().getFullYear()} AuthZen. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
