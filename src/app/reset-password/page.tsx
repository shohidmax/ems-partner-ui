import { AuthLayout } from '@/components/auth-layout';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password. This is a demo and does not actually send an email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
           <div className="mt-4 text-center text-sm">
            Remembered your password?{' '}
            <Link href="/login" className="underline text-primary font-medium">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
