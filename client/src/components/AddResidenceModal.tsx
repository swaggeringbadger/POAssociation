import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Upload, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddressInput } from '@/components/AddressInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface AddResidenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onCreated: (id: string) => void;
}

export function AddResidenceModal({ open, onOpenChange, tenantId, onCreated }: AddResidenceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [addressVerified, setAddressVerified] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create the residence, passing pre-validated coordinates if available
      const residence = await api.createCommunityResidence(tenantId, {
        propertyAddress: address,
        name: name || undefined,
        description: description || undefined,
        coordinates: coordinates || undefined,
      });

      // Upload photos if any
      if (files.length > 0) {
        await api.uploadResidencePhotos(tenantId, residence.id, files);
      }

      return residence;
    },
    onSuccess: (residence) => {
      queryClient.invalidateQueries({ queryKey: ['residences'] });
      toast({ title: 'Residence created' });
      resetForm();
      onCreated(residence.id);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create residence', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setAddress('');
    setName('');
    setDescription('');
    setFiles([]);
    setCoordinates(null);
    setAddressVerified(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Add Residence
          </DialogTitle>
          <DialogDescription>
            Add a property address to the neighborhood archive. Satellite imagery will be fetched automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <AddressInput
            value={address}
            onChange={setAddress}
            onValidated={(result) => {
              if (result.isValid && result.latitude && result.longitude) {
                setCoordinates({ lat: result.latitude, lng: result.longitude });
                setAddressVerified(true);
              } else {
                setCoordinates(null);
                setAddressVerified(false);
              }
            }}
            label="Property Address"
            placeholder="Start typing an address..."
            required
          />

          <div>
            <Label htmlFor="name">Friendly Name (optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., The Johnson House"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this property..."
              rows={2}
            />
          </div>

          <div>
            <Label className="mb-2 block">Photos (up to 5)</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag & drop photos, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="add-residence-photos"
              />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="add-residence-photos" className="cursor-pointer">
                  Browse Files
                </label>
              </Button>
            </div>

            {files.length > 0 && (
              <div className="space-y-1 mt-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-muted rounded p-2">
                    <span className="truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              You can also upload photos from your phone after creating the residence.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!address.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <MapPin className="h-4 w-4 mr-1" />
            )}
            Add Residence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
