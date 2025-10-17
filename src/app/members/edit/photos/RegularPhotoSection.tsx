"use client";

import { useState } from "react";
import MemberPhotoUpload from "./MemberPhotoUpload";
import MemberPhotos from "@/components/MemberPhotos";
import type { Photo } from "@prisma/client";

interface Props {
  photos: Photo[] | null;
  mainImageUrl?: string | null;
}

export default function RegularPhotoSection({ photos, mainImageUrl }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Upload Photo
        </h3>
        <MemberPhotoUpload />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Your Photos ({photos?.length || 0})
        </h3>
        {photos && photos.length > 0 ? (
          <MemberPhotos
            photos={photos}
            editing={true}
            mainImageUrl={mainImageUrl}
          />
        ) : (
          <div className="p-6 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600">No photos yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Upload your first photo using Cloudinary
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
