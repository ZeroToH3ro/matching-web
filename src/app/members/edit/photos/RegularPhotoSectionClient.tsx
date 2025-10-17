"use client";

import { useState, useEffect } from "react";
import RegularPhotoSection from "./RegularPhotoSection";
import type { Photo } from "@prisma/client";
import { Spinner } from "@nextui-org/react";

export default function RegularPhotoSectionClient() {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch member data and photos from API
        const [memberRes, photosRes] = await Promise.all([
          fetch('/api/member'),
          fetch('/api/member/photos')
        ]);

        if (!memberRes.ok || !photosRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [memberData, photosData] = await Promise.all([
          memberRes.json(),
          photosRes.json()
        ]);

        setMainImageUrl(memberData?.image || null);
        setPhotos(photosData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load photos');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" label="Loading your photos..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return <RegularPhotoSection photos={photos} mainImageUrl={mainImageUrl} />;
}
