import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  Home, ArrowLeft, Edit2, Trash2, Upload, RefreshCw, Sparkles,
  MapPin, Image, FileText, Loader2, X, AlertCircle, Check, Smartphone, Clock,
  ChevronLeft, ChevronRight, ZoomIn, History,
} from 'lucide-react';
import { api, type CommunityResidenceWithDetails, type ResidencePhoto } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ResidenceTimeline from '@/components/ResidenceTimeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';

export default function NeighborhoodDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentTenant = useAppStore((state) => state.currentTenant);
  const setCurrentPageTitle = useAppStore((state) => state.setCurrentPageTitle);
  const isMobile = useIsMobile();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showMobileUpload, setShowMobileUpload] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [mobileUploadToken, setMobileUploadToken] = useState<string>('');
  const [mobileUploadExpires, setMobileUploadExpires] = useState<Date | null>(null);
  const [mobileUploadDone, setMobileUploadDone] = useState(false);
  const [mobileUploadError, setMobileUploadError] = useState<string | null>(null);
  const [mobileUploadGenerating, setMobileUploadGenerating] = useState(false);
  const [mobileTimeRemaining, setMobileTimeRemaining] = useState(600);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: residence, isLoading } = useQuery({
    queryKey: ['residence', currentTenant?.id, id],
    queryFn: () => api.getCommunityResidence(currentTenant!.id, id!),
    enabled: !!currentTenant?.id && !!id,
  });

  // Set page title from residence data
  useEffect(() => {
    if (residence) {
      setCurrentPageTitle(residence.name || residence.propertyAddress || 'Residence');
    }
    return () => setCurrentPageTitle(null);
  }, [residence?.name, residence?.propertyAddress, setCurrentPageTitle]);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string }) =>
      api.updateCommunityResidence(currentTenant!.id, id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residence', currentTenant?.id, id] });
      setIsEditing(false);
      toast({ title: 'Residence updated' });
    },
    onError: (err: Error) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCommunityResidence(currentTenant!.id, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residences'] });
      toast({ title: 'Residence deleted' });
      navigate('/neighborhood');
    },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.uploadResidencePhotos(currentTenant!.id, id!, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residence', currentTenant?.id, id] });
      setShowUploadDialog(false);
      setSelectedFiles([]);
      toast({ title: 'Photos uploaded' });
    },
    onError: (err: Error) => toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => api.deleteResidencePhoto(currentTenant!.id, id!, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residence', currentTenant?.id, id] });
      toast({ title: 'Photo deleted' });
    },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const mockupMutation = useMutation({
    mutationFn: () => api.generateResidenceMockup(currentTenant!.id, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residence', currentTenant?.id, id] });
      toast({ title: 'Mockup generated!' });
    },
    onError: (err: Error) => toast({ title: 'Mockup failed', description: err.message, variant: 'destructive' }),
  });

  const satelliteMutation = useMutation({
    mutationFn: () => api.fetchResidenceSatellite(currentTenant!.id, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residence', currentTenant?.id, id] });
      toast({ title: 'Satellite imagery updated' });
    },
    onError: (err: Error) => toast({ title: 'Satellite fetch failed', description: err.message, variant: 'destructive' }),
  });

  const startEditing = () => {
    if (!residence) return;
    setEditName(residence.name || '');
    setEditDescription(residence.description || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({ name: editName, description: editDescription });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      setSelectedFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const uploadedPhotos = residence?.photos?.filter((p) => p.photoType === 'uploaded') || [];
  const satellitePhotos = residence?.photos?.filter((p) => p.photoType === 'satellite' || p.photoType === 'neighborhood') || [];
  const mockupPhotos = residence?.photos?.filter((p) => p.photoType === 'mockup') || [];
  const allPhotos = residence?.photos || [];

  const maxUploaded = 5;
  const canUploadMore = uploadedPhotos.length < maxUploaded;

  const getPhotoUrl = (photo: ResidencePhoto) => {
    if (!currentTenant || !id) return '';
    return api.getResidencePhotoUrl(currentTenant.id, id, photo.id);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Countdown timer for mobile upload
  useEffect(() => {
    if (!mobileUploadExpires) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((mobileUploadExpires.getTime() - Date.now()) / 1000));
      setMobileTimeRemaining(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        setMobileUploadError('Upload link expired. Please generate a new one.');
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [mobileUploadExpires]);

  const handleShowMobileUpload = async () => {
    if (!currentTenant || !id) return;
    try {
      setMobileUploadGenerating(true);
      setMobileUploadError(null);
      setMobileUploadDone(false);

      // Create a token on the server
      const response = await api.createResidenceUploadToken(currentTenant.id, id);
      setMobileUploadToken(response.token);
      setMobileUploadExpires(new Date(response.expiresAt));

      // Generate QR code pointing to the public upload page
      const uploadUrl = `${window.location.origin}/residence-upload/${response.token}`;
      const dataUrl = await QRCode.toDataURL(uploadUrl, { width: 300, margin: 2 });
      setQrDataUrl(dataUrl);
      setShowMobileUpload(true);

      // Start polling for upload completion
      pollingRef.current = setInterval(async () => {
        try {
          const status = await api.checkResidenceUploadStatus(response.token);
          if (status.isUsed) {
            setMobileUploadDone(true);
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            // Refresh residence data to show new photos
            queryClient.invalidateQueries({ queryKey: ['residence', currentTenant.id, id] });
          }
          if (status.isExpired && !status.isUsed) {
            setMobileUploadError('Upload link expired');
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          }
        } catch (err) {
          // Silently continue polling
        }
      }, 2000);
    } catch (err: any) {
      setMobileUploadError(err.message || 'Failed to generate upload link');
    } finally {
      setMobileUploadGenerating(false);
    }
  };

  const handleCloseMobileUpload = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setShowMobileUpload(false);
    setQrDataUrl('');
    setMobileUploadToken('');
    setMobileUploadExpires(null);
    setMobileUploadDone(false);
    setMobileUploadError(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openLightbox = (photo: ResidencePhoto) => {
    const idx = allPhotos.findIndex((p) => p.id === photo.id);
    if (idx !== -1) setLightboxIndex(idx);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i !== null && i < allPhotos.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, allPhotos.length]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!residence) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Residence not found</h3>
            <Button variant="ghost" className="mt-4" onClick={() => navigate('/neighborhood')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Neighborhood
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate('/neighborhood')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Friendly name (optional)"
                className="text-lg font-semibold"
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">
                {residence.name || residence.propertyAddress}
              </h1>
              {residence.name && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" />
                  {residence.propertyAddress}
                </p>
              )}
              {residence.description && (
                <p className="text-sm text-muted-foreground mt-2">{residence.description}</p>
              )}
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" className="mt-2">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-0">
      {/* Photo Gallery */}
      {allPhotos.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="h-5 w-5" />
              Photo Gallery ({allPhotos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Carousel className="w-full">
              <CarouselContent>
                {allPhotos.map((photo) => (
                  <CarouselItem key={photo.id} className="md:basis-1/2 lg:basis-1/3">
                    <div className="relative group cursor-pointer" onClick={() => openLightbox(photo)}>
                      <img
                        src={getPhotoUrl(photo)}
                        alt={photo.caption || photo.fileName}
                        className="w-full h-48 object-cover rounded-lg"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-70 transition-opacity" />
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {photo.photoType}
                        </Badge>
                      </div>
                      {photo.photoType === 'uploaded' && (
                        <button
                          className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePhotoMutation.mutate(photo.id);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {photo.caption && (
                        <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 rounded-b-lg">
                          {photo.caption}
                        </p>
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {allPhotos.length > 3 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          </CardContent>
        </Card>
      )}

      {/* Upload Photos */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Photos
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {uploadedPhotos.length}/{maxUploaded} uploaded
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canUploadMore ? (
            <div className="flex gap-2">
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
              {!isMobile && (
                <Button variant="outline" onClick={handleShowMobileUpload}>
                  <Smartphone className="h-4 w-4 mr-2" />
                  Upload from Mobile
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Maximum of {maxUploaded} uploaded photos reached. Delete an existing photo to upload more.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Satellite Views */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Satellite Views
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => satelliteMutation.mutate()}
              disabled={satelliteMutation.isPending}
            >
              {satelliteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {satellitePhotos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {satellitePhotos.map((photo) => (
                <div key={photo.id} className="relative group cursor-pointer" onClick={() => openLightbox(photo)}>
                  <img
                    src={getPhotoUrl(photo)}
                    alt={photo.caption || 'Satellite view'}
                    className="w-full h-48 object-cover rounded-lg"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-70 transition-opacity" />
                  </div>
                  <Badge variant="secondary" className="absolute top-2 left-2 text-xs capitalize">
                    {photo.photoType === 'satellite' ? 'Property' : 'Neighborhood'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {residence.propertyCoordinates
                ? 'No satellite imagery yet. Click Refresh to fetch.'
                : 'No coordinates available for this address. Satellite imagery requires geocoded coordinates.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Mockup — hidden for now, re-enable when generation quality improves */}

      {/* Linked Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Linked Applications ({residence.linkedApplications?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {residence.linkedApplications && residence.linkedApplications.length > 0 ? (
            <div className="divide-y">
              {residence.linkedApplications.map((app) => (
                <div
                  key={app.id}
                  className="py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded"
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  <div>
                    <p className="font-medium">{app.title || `Application ${app.applicationNumber}`}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.applicationNumber} &middot; {new Date(app.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      app.status === 'approved'
                        ? 'default'
                        : app.status === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No applications found matching this address. Applications submitted with this address will automatically appear here.
            </p>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ResidenceTimeline residenceId={id!} tenantId={currentTenant!.id} />
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Photos</DialogTitle>
            <DialogDescription>
              Upload up to {maxUploaded - uploadedPhotos.length} more photo{maxUploaded - uploadedPhotos.length !== 1 ? 's' : ''}.
              Supported formats: JPEG, PNG, WebP.
            </DialogDescription>
          </DialogHeader>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag & drop photos here, or click to browse
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="photo-upload"
            />
            <Button variant="outline" size="sm" asChild>
              <label htmlFor="photo-upload" className="cursor-pointer">
                Browse Files
              </label>
            </Button>
          </div>
          {selectedFiles.length > 0 && (
            <div className="space-y-2 mt-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm bg-muted rounded p-2">
                  <span className="truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowUploadDialog(false); setSelectedFiles([]); }}>
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate(selectedFiles)}
              disabled={selectedFiles.length === 0 || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Upload QR Dialog (Token-based) */}
      <Dialog open={showMobileUpload} onOpenChange={handleCloseMobileUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Upload from Phone
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with your phone to upload photos directly from your camera.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {mobileUploadGenerating ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating upload link...</p>
              </div>
            ) : mobileUploadError ? (
              <Alert variant="destructive">
                <AlertDescription>{mobileUploadError}</AlertDescription>
              </Alert>
            ) : mobileUploadDone ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Photos uploaded successfully from mobile!
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* QR Code */}
                <div className="flex justify-center py-4">
                  <div className="border-4 border-border rounded-lg p-4 bg-white">
                    <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
                  </div>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span className={mobileTimeRemaining < 60 ? 'text-destructive font-semibold' : ''}>
                    Expires in {formatTime(mobileTimeRemaining)}
                  </span>
                </div>

                {/* Instructions */}
                <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                  <p className="font-semibold text-foreground">How to upload:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open your phone's camera app</li>
                    <li>Point it at the QR code above</li>
                    <li>Tap the notification to open the upload page</li>
                    <li>Take or select photos and upload</li>
                    <li>Wait for confirmation here</li>
                  </ol>
                </div>

                {/* Waiting indicator */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Waiting for upload from phone...</span>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {mobileUploadDone ? (
                <Button onClick={handleCloseMobileUpload}>Done</Button>
              ) : (
                <>
                  {!mobileUploadGenerating && !mobileUploadError && (
                    <Button variant="outline" onClick={handleShowMobileUpload}>
                      Generate New Code
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleCloseMobileUpload}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 bg-black/95 border-none [&>button]:text-white [&>button]:hover:bg-white/20">
          {lightboxIndex !== null && allPhotos[lightboxIndex] && (
            <div className="relative flex flex-col items-center justify-center min-h-[60vh] max-h-[90vh]">
              {/* Image */}
              <img
                src={getPhotoUrl(allPhotos[lightboxIndex])}
                alt={allPhotos[lightboxIndex].caption || allPhotos[lightboxIndex].fileName}
                className="max-w-full max-h-[80vh] object-contain"
              />

              {/* Caption / type badge */}
              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 px-4">
                <Badge variant="secondary" className="capitalize">
                  {allPhotos[lightboxIndex].photoType}
                </Badge>
                {allPhotos[lightboxIndex].caption && (
                  <span className="text-white text-sm">{allPhotos[lightboxIndex].caption}</span>
                )}
                <span className="text-white/60 text-sm">
                  {lightboxIndex + 1} / {allPhotos.length}
                </span>
              </div>

              {/* Previous */}
              {lightboxIndex > 0 && (
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              {/* Next */}
              {lightboxIndex < allPhotos.length - 1 && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Residence</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this residence and all its photos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
