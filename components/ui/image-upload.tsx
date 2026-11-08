'use client';

import Image from 'next/image';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, ImagePlus, Trash } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CldUploadWidget,
  CloudinaryUploadWidgetError,
  CloudinaryUploadWidgetInfo,
  CloudinaryUploadWidgetResults,
} from 'next-cloudinary';
import { cn } from '@/lib/utils';
import useMounted from '@/hooks/use-mounted';

type Props = {
  disabled?: boolean;
  onChange: (value: string) => void;
  onRemove: (value: string) => void;
  // When given, each image gets move buttons and the first one is marked as the card image
  onMove?: (move: { from: number; to: number }) => void;
  value: string[];
};

const ImageUpload = ({ disabled, onChange, onRemove, onMove, value }: Props) => {
  const isMounted = useMounted();
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'pjowkmpm';

  const handleUploadSuccess = (result: CloudinaryUploadWidgetResults) => {
    if (typeof result.info === 'string' || !result.info) {
      toast.error('Nepavyko nuskaityti įkelto vaizdo informacijos.');
      return;
    }

    const uploadedImage = result.info as CloudinaryUploadWidgetInfo;

    if (!uploadedImage.secure_url) {
      toast.error('Nepavyko gauti įkelto vaizdo nuorodos.');
      return;
    }

    onChange(uploadedImage.secure_url);
  };

  const handleUploadError = (error: CloudinaryUploadWidgetError) => {
    if (!error) {
      return;
    }

    if (typeof error === 'string') {
      toast.error(error);
      return;
    }

    toast.error(error.statusText || error.status || 'Nepavyko įkelti vaizdo.');
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div>
      <div className={cn('flex flex-wrap items-center gap-4', value.length > 0 && 'mb-4')}>
        {value.map((url, index) => (
          <div key={url} className="relative size-50 shrink-0 overflow-hidden rounded-md">
            {onMove && index === 0 && <Badge className="absolute top-2 left-2 z-10">Miniatiūra</Badge>}
            <div className="absolute top-2 right-2 z-10">
              <Button type="button" onClick={() => onRemove(url)} variant="destructive" size="icon">
                <Trash className="h-4 w-4" />
              </Button>
            </div>
            {onMove && (
              <div className="absolute bottom-2 left-2 z-10 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={disabled || index === 0}
                  onClick={() => onMove({ from: index, to: index - 1 })}
                  aria-label="Perkelti kairėn"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={disabled || index === value.length - 1}
                  onClick={() => onMove({ from: index, to: index + 1 })}
                  aria-label="Perkelti dešinėn"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Image fill className="object-cover" alt="Image" src={url} sizes="200px" />
          </div>
        ))}
      </div>
      <CldUploadWidget onError={handleUploadError} onSuccess={handleUploadSuccess} uploadPreset={uploadPreset}>
        {({ open, isLoading }) => {
          const onClick = () => {
            if (!uploadPreset) {
              toast.error('Cloudinary upload preset nėra sukonfigūruotas.');
              return;
            }

            open();
          };

          return (
            <Button type="button" disabled={disabled || isLoading} variant="secondary" onClick={onClick}>
              <ImagePlus className="mr-2 h-4 w-4" />
              {isLoading ? 'Paruošiama...' : 'Įkelti vaizdą'}
            </Button>
          );
        }}
      </CldUploadWidget>
    </div>
  );
};

export default ImageUpload;
