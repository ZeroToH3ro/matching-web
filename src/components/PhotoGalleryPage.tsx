import React, { type ReactNode } from "react";

interface PhotoGalleryPageProps {
  regularSection?: ReactNode;
  blockchainSection: ReactNode;
}

export default function PhotoGalleryPage({
  regularSection,
  blockchainSection,
}: PhotoGalleryPageProps) {
  return (
    <div className="space-y-4 md:space-y-6 w-full min-h-screen">
      {/* Regular Photos Section (Cloudinary) */}
      {regularSection && (
        <div className="w-full bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-3 md:mb-4">
              Regular Photos Gallery
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload and manage your photos using Cloudinary cloud storage
            </p>
            <div className="w-full min-h-fit">
              {regularSection}
            </div>
          </div>
        </div>
      )}

      {/* Blockchain Photos Section */}
      <div className="w-full bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-3 md:mb-4">
            Blockchain Photos Gallery
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload and manage encrypted photos on Walrus decentralized storage with Seal Protocol
          </p>
          <div className="w-full min-h-fit">
            {blockchainSection}
          </div>
        </div>
      </div>
    </div>
  );
}
