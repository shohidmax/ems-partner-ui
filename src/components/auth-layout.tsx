import { Logo } from '@/components/logo';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-muted/40 p-4 sm:p-6 overflow-x-hidden">
      <div className="w-full max-w-sm flex flex-col items-center justify-center flex-1 mx-auto">
        <div className="mb-6 sm:mb-8">
          <Logo />
        </div>
        {children}
      </div>
    </main>
  );
}
