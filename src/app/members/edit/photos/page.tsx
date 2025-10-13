import { getAuthUserId } from "@/app/actions/authActions";
import PhotoGalleryPage from "@/components/PhotoGalleryPage";
import React from "react";
import dynamic from "next/dynamic";

const BlockchainPhotoSection = dynamic(() => import("./BlockchainPhotoSection"), {
  ssr: false,
  loading: () => <div className="text-center p-4">Loading blockchain photos...</div>
});

export default async function PhotosPage() {
  await getAuthUserId(); // Verify authentication

  return (
    <PhotoGalleryPage
      blockchainSection={<BlockchainPhotoSection />}
    />
  );
}
