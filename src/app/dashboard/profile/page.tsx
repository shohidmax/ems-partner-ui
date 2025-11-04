import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">My Profile</h1>
            <Button asChild variant="outline">
                <Link href="/dashboard/settings">Go to Settings</Link>
            </Button>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>View and update your personal details here.</CardDescription>
            </CardHeader>
            <CardContent>
                <ProfileForm />
            </CardContent>
        </Card>
    </div>
  );
}
