'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  CldUploadWidget,
  CloudinaryUploadWidgetError,
  CloudinaryUploadWidgetInfo,
  CloudinaryUploadWidgetResults,
} from 'next-cloudinary';

interface ImageUploadProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  onRemove: (value: string) => void;
  value: string[];
}

const ImageUpload: React.FC<ImageUploadProps> = ({ disabled, onChange, onRemove, value }) => {
  const [isMounted, setIsMounted] = useState(false);
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'pjowkmpm';

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      <div className="mb-4 flex items-center gap-4">
        {value.map((url) => (
          <div key={url} className="relative h-[200px] w-[200px] overflow-hidden rounded-md">
            <div className="absolute right-2 top-2 z-10">
              <Button type="button" onClick={() => onRemove(url)} variant="destructive" size="icon">
                <Trash className="h-4 w-4" />
              </Button>
            </div>
            <Image fill className="object-cover" alt="Image" src={url} />
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
