import { Logo } from '@/components/logo';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
      <div className="container flex flex-col items-center justify-center flex-1">
        <div className="mb-8">
          <Logo />
        </div>
        {children}
      </div>
    </main>
  );
}
