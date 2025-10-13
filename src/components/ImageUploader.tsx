'use client';

import React from 'react';
import { Card, CardBody, Button } from '@nextui-org/react';
import { Upload } from 'lucide-react';

interface ImageUploaderProps {
  title: string;
  imageUrl: string | null;
  imageRef: React.RefObject<HTMLImageElement>;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  acceptedFormats?: string;
  buttonColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  title,
  imageUrl,
  imageRef,
  onImageChange,
  acceptedFormats = 'image/*',
  buttonColor = 'primary',
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <Card className="w-full h-full">
      <CardBody className="gap-4 items-center">
        <h3 className="text-lg font-semibold text-center">{title}</h3>

        <input
          ref={inputRef}
          type="file"
          accept={acceptedFormats}
          onChange={onImageChange}
          className="hidden"
          aria-label={`Upload ${title}`}
        />

        <Button
          color={buttonColor}
          variant="flat"
          startContent={<Upload className="w-4 h-4" />}
          onPress={handleButtonClick}
          className="w-full"
        >
          Choose Image
        </Button>

        {imageUrl ? (
          <div className="relative w-full max-w-md aspect-square overflow-hidden rounded-lg border-2 border-default-200">
            <img
              ref={imageRef}
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
              onLoad={() => console.log(`✅ Image loaded: ${title}`)}
              onError={(e) => console.error(`❌ Image error: ${title}`, e)}
            />
          </div>
        ) : (
          <div className="w-full max-w-md aspect-square flex items-center justify-center border-2 border-dashed border-default-300 rounded-lg bg-default-50">
            <div className="text-center text-default-400">
              <Upload className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">No image selected</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default ImageUploader;
