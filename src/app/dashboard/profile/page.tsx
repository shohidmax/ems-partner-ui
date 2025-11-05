
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { ProfileDetails } from "@/components/profile-details";
import { useUser } from "@/hooks/use-user";
import { List, ListItem } from "@/components/ui/list";
import { Button } from "@/components/ui/button";
import { Copy, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { AddDeviceDialog } from "@/components/add-device-dialog";

export default function ProfilePage() {
  const { user, isLoading, fetchUserProfile } = useUser();
  const { toast } = useToast();
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);

  const handleCopy = (uid: string) => {
    navigator.clipboard.writeText(uid);
    toast({
        title: 'Copied to clipboard!',
        description: `UID: ${uid}`,
    });
  };

  const onDeviceAdded = () => {
      fetchUserProfile();
  };

  return (
    <div className="space-y-6">
      <AddDeviceDialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen} onDeviceAdded={onDeviceAdded} />
        <div>
            <h1 className="text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground">View and manage your account details.</p>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <ProfileDetails />
            </div>
            <div className="lg:col-span-2 space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Update Information</CardTitle>
                        <CardDescription>Update your personal details here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ProfileForm />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>My Devices</CardTitle>
                            <CardDescription>A list of all devices registered to your account.</CardDescription>
                        </div>
                        <Button size="sm" onClick={() => setIsAddDeviceOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Device
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : user?.devices && user.devices.length > 0 ? (
                            <List>
                                {user.devices.map(uid => (
                                    <ListItem key={uid}>
                                        <span className="font-mono text-sm flex-1">{uid}</span>
                                        <Button size="sm" variant="ghost" onClick={() => handleCopy(uid)}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                You have no devices registered to your account yet. Click 'Add Device' to get started.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
