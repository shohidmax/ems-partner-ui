import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { Separator } from "@/components/ui/separator";
import { PasswordChangeForm } from "@/components/password-change-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Card>
            <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details here.</CardDescription>
            </CardHeader>
            <CardContent>
                <ProfileForm />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Change your password and manage account security.</CardDescription>
            </CardHeader>
            <CardContent>
                <PasswordChangeForm />
            </CardContent>
        </Card>
    </div>
  );
}
