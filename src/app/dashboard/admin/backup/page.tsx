'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Loader2, TriangleAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const API_URL = 'http://localhost:3005/api/backup';

interface JobStatus {
    status: 'pending' | 'counting' | 'exporting' | 'zipping' | 'done' | 'error';
    progress: number;
    error: string | null;
}

export default function BackupPage() {
    const [uid, setUid] = useState('');
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const startBackup = async () => {
        setIsStarting(true);
        setError(null);
        setJobId(null);
        setJobStatus(null);
        setDownloadUrl(null);
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        try {
            const response = await fetch(`${API_URL}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: uid || undefined })
            });

            if (!response.ok) throw new Error('Failed to start backup job.');
            
            const { jobId: newJobId } = await response.json();
            setJobId(newJobId);
            listenToJob(newJobId);

        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            setError(error.message);
        } finally {
            setIsStarting(false);
        }
    };

    const listenToJob = (id: string) => {
        const es = new EventSource(`${API_URL}/status/${id}`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            // Generic message handler if needed
        };

        es.addEventListener('progress', (event) => {
            const data: JobStatus = JSON.parse(event.data);
            setJobStatus(data);
        });

        es.addEventListener('done', (event) => {
            const data = JSON.parse(event.data);
             setJobStatus({ status: data.status, progress: 100, error: data.error });
            if (data.status === 'done') {
                setDownloadUrl(data.download);
                toast({ title: 'Success', description: 'Backup is ready for download.' });
            } else {
                 toast({ title: 'Error', description: data.error || 'Backup job failed.', variant: 'destructive' });
            }
            es.close();
        });

        es.onerror = () => {
            setError('Connection to server lost. Please check the console or try again.');
            toast({ title: 'Connection Error', description: 'Lost connection to the backup service.', variant: 'destructive' });
            es.close();
        };
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Data Backup</h1>
                <p className="text-muted-foreground">Create and download a full backup of the sensor data.</p>
            </div>

            {error && (
                 <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>An Error Occurred</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Start New Backup</CardTitle>
                    <CardDescription>
                        You can create a backup for all devices or a specific device by providing its UID. The process runs in the background.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <label htmlFor="uid-input">Device UID (optional)</label>
                        <Input 
                            id="uid-input"
                            type="text" 
                            placeholder="Enter a specific UID to back up"
                            value={uid}
                            onChange={(e) => setUid(e.target.value)}
                        />
                    </div>
                    <Button onClick={startBackup} disabled={isStarting || (jobStatus !== null && jobStatus.status !== 'done' && jobStatus.status !== 'error')}>
                        {(isStarting || (jobStatus && !['done', 'error'].includes(jobStatus.status))) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {jobStatus && !['done', 'error'].includes(jobStatus.status) ? `Backing up...` : `Start Backup`}
                    </Button>
                </CardContent>
            </Card>

            {jobId && (
                <Card>
                    <CardHeader>
                        <CardTitle>Backup Progress</CardTitle>
                        <CardDescription>Job ID: <span className="font-mono text-xs">{jobId}</span></CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {jobStatus ? (
                            <div className="flex items-center gap-4">
                               <div className="flex-1">
                                    <p className="font-medium capitalize">{jobStatus.status}...</p>
                                    <Progress value={jobStatus.progress} className="w-full mt-2" />
                               </div>
                               <p className="text-2xl font-bold">{jobStatus.progress}%</p>
                            </div>
                       ): (
                           <div className="flex items-center justify-center p-8">
                               <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                               <span>Waiting for job to start...</span>
                           </div>
                       )}
                        
                        {jobStatus?.status === 'error' && (
                             <Alert variant="destructive">
                                <TriangleAlert className="h-4 w-4" />
                                <AlertTitle>Job Failed</AlertTitle>
                                <AlertDescription>{jobStatus.error || 'An unknown error occurred.'}</AlertDescription>
                            </Alert>
                        )}

                        {downloadUrl && jobStatus?.status === 'done' && (
                            <Button asChild className="w-full">
                                <a href={`http://localhost:3005${downloadUrl}`} download>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Backup
                                </a>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
