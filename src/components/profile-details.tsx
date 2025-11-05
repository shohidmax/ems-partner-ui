
'use client';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Shield, HardDrive, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function ProfileDetails() {
    const { user, isAdmin, isLoading } = useUser();

    if (isLoading || !user) {
        return (
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
        );
    }
    
    const displayName = user.name || user.email || 'User';
    const avatarFallback = displayName.substring(0, 2).toUpperCase();

    return (
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
                    <span className="font-semibold">{user.devices?.length ?? 0}</span>
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
    );
}
