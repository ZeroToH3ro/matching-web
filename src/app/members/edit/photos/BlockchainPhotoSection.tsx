"use client";

import { useState } from "react";
import BlockchainPhotoUpload from "./BlockchainPhotoUpload";
import BlockchainPhotoGallery from "./BlockchainPhotoGallery";

export default function BlockchainPhotoSection() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    // Increment trigger to force gallery reload
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <BlockchainPhotoUpload onUploadSuccess={handleUploadSuccess} />
      <BlockchainPhotoGallery refreshTrigger={refreshTrigger} />
    </div>
  );
}
