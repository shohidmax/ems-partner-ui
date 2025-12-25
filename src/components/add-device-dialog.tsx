'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { Loader2 } from 'lucide-react';

const API_URL = 'https://emspartner.espserver.site/api/user/device/add';

interface AddDeviceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeviceAdded: () => void;
}

export function AddDeviceDialog({ open, onOpenChange, onDeviceAdded }: AddDeviceDialogProps) {
    const [uid, setUid] = useState('');
    const [isPending, startTransition] = useTransition();
    const { token } = useUser();
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!uid.trim()) {
            toast({ title: 'Error', description: 'Device UID cannot be empty.', variant: 'destructive'});
            return;
        }

        startTransition(async () => {
            try {
                if (!token) throw new Error('Not authenticated.');
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ uid: uid.trim() })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to add device.');

                toast({ title: 'Success', description: 'Device added to your account.' });
                setUid('');
                onDeviceAdded();
                onOpenChange(false);

            } catch (error: any) {
                 toast({ title: 'Error', description: error.message, variant: 'destructive'});
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Device</DialogTitle>
                    <DialogDescription>
                        Enter the unique identifier (UID) of the device you want to add to your account.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="uid" className="text-right">Device UID</Label>
                        <Input 
                            id="uid" 
                            value={uid}
                            onChange={(e) => setUid(e.target.value)}
                            className="col-span-3" 
                            placeholder="e.g., 14:2B:2F:DA:F2:50"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Device
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}