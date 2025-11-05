
'use client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Shield, HardDrive, Calendar, Plus, Copy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AddDeviceDialog } from './add-device-dialog';
import { Button } from './ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function ProfileDetails() {
    const { user, isAdmin, isLoading, fetchUserProfile } = useUser();
    const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
    const { toast } = useToast();

    if (isLoading || !user) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader className="items-center text-center">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <Skeleton className="h-6 w-32 mt-4" />
                        <Skeleton className="h-4 w-24 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const displayName = user.name || user.email || 'User';
    const avatarFallback = displayName.substring(0, 2).toUpperCase();

    const onDeviceAdded = () => {
        fetchUserProfile(); // Refetch user profile to update device count
    }

    const handleCopy = (uid: string) => {
        navigator.clipboard.writeText(uid);
        toast({
            title: 'Copied to clipboard!',
            description: `UID: ${uid}`,
        });
    };

    return (
        <div className="space-y-6">
            <AddDeviceDialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen} onDeviceAdded={onDeviceAdded} />
            <Card>
                <CardHeader className="items-center text-center">
                    <Avatar className="h-24 w-24 mb-4 border-2 border-primary">
                        <AvatarImage src={user.photoURL || undefined} alt={displayName} />
                        <AvatarFallback className="text-3xl">{avatarFallback}</AvatarFallback>
                    </Avatar>
                    <CardTitle>{displayName}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-primary" />
                            <span className="font-medium">Role</span>
                        </div>
                        <Badge variant={isAdmin ? 'default' : 'secondary'}>{isAdmin ? 'Admin' : 'User'}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <HardDrive className="h-5 w-5 text-primary" />
                            <span className="font-medium">Devices</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{user.devices?.length ?? 0}</span>
                             <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAddDeviceOpen(true)}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    {user.createdAt && (
                         <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary" />
                                <span className="font-medium">Member Since</span>
                            </div>
                            <span className="font-semibold text-sm">{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
