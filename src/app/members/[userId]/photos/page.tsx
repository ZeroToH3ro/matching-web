import PhotoGalleryPage from "@/components/PhotoGalleryPage";
import React from "react";
import dynamic from "next/dynamic";

const MemberBlockchainPhotos = dynamic(() => import("./MemberBlockchainPhotos"), {
  ssr: false,
  loading: () => <div className="text-center p-4">Loading blockchain photos...</div>
});

export default async function PhotosPage({
  params,
}: {
  params: { userId: string };
}) {

  return (
    <PhotoGalleryPage
      blockchainSection={<MemberBlockchainPhotos walletAddress={params.userId} />}
    />
  );
}
