
'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const API_PATH = '/api/user/device/add';

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
                await apiFetch(API_PATH, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: uid.trim() })
                });

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
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add a New Device</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                        Enter the unique identifier (UID) of the device you want to add to your account.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-3 sm:py-4">
                    <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                        <Label htmlFor="uid" className="text-left sm:text-right text-xs sm:text-sm font-medium">Device UID</Label>
                        <Input 
                            id="uid" 
                            value={uid}
                            onChange={(e) => setUid(e.target.value)}
                            className="sm:col-span-3" 
                            placeholder="e.g., 14:2B:2F:DA:F2:50"
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
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
