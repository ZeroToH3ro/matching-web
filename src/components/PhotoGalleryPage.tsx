import React, { type ReactNode } from "react";

interface PhotoGalleryPageProps {
  blockchainSection: ReactNode;
}

export default function PhotoGalleryPage({
  blockchainSection,
}: PhotoGalleryPageProps) {
  return (
    <div className="space-y-6 w-full min-h-screen">
      {/* Blockchain Photos Section */}
      <div className="w-full bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Blockchain Photos Gallery
          </h2>
          <div className="w-full min-h-fit">
            {blockchainSection}
          </div>
        </div>
      </div>
    </div>
  );
}
