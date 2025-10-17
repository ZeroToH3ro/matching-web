import PhotoGalleryPage from "@/components/PhotoGalleryPage";
import React from "react";
import dynamic from "next/dynamic";

// Lazy load both photo sections
const RegularPhotoSectionClient = dynamic(() => import("./RegularPhotoSectionClient"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center p-8">
      <div className="animate-pulse text-gray-500">Loading regular photos...</div>
    </div>
  )
});

const BlockchainPhotoSection = dynamic(() => import("./BlockchainPhotoSection"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center p-8">
      <div className="animate-pulse text-gray-500">Loading blockchain photos...</div>
    </div>
  )
});

export default function PhotosPage() {
  return (
    <PhotoGalleryPage
      regularSection={<RegularPhotoSectionClient />}
      blockchainSection={<BlockchainPhotoSection />}
    />
  );
}
