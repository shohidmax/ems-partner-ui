import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="EMS homepage">
      <span className="text-2xl font-bold tracking-tight text-foreground">EMS</span>
    </Link>
  );
}
