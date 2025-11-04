'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { ShieldCheck, Cloud, Thermometer } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { motion } from 'framer-motion';

const features = [
  {
    icon: <Thermometer className="w-10 h-10 text-primary" />,
    title: 'Real-time Monitoring',
    description: 'Track key environmental metrics with high-precision sensors and live data streams.',
  },
  {
    icon: <ShieldCheck className="w-10 h-10 text-primary" />,
    title: 'Data Security',
    description: 'Your data is securely stored and accessible only to authorized personnel.',
  },
  {
    icon: <Cloud className="w-10 h-10 text-primary" />,
    title: 'Cloud-Based',
    description: 'Access your environmental data from anywhere in the world, at any time.',
  },
];

export default function Home() {
  const { user, isLoading } = useUser();

  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
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
        <section className="container grid items-center gap-8 pb-8 pt-16 md:py-24 lg:py-32 px-4 md:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center text-center"
          >
            <h1 className="text-4xl font-extrabold leading-tight tracking-tighter md:text-5xl lg:text-6xl xl:text-7xl">
              Environmental Monitoring <br /> Made Simple.
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground mt-6">
              Our Environmental Monitoring System (EMS) provides a reliable platform for real-time data collection and analysis.
            </p>
            <div className="flex gap-4 mt-8">
              <Button asChild size="lg">
                <Link href="/register">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </motion.div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-5xl flex-col items-center space-y-4 text-center">
              <h2 className="font-bold text-3xl tracking-tighter sm:text-4xl md:text-5xl">Features</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Everything you need for comprehensive environmental monitoring, designed for accuracy and ease of use.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 pt-16">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
                >
                  <Card className="h-full text-center hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="items-center">
                      {feature.icon}
                      <CardTitle className="mt-4">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Logo />
          </div>
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Developed by Max iT Solution. © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
