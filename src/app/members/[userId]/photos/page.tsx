import { getMemberPhotosByUserId } from "@/app/actions/memberActions";
import CardInnerWrapper from "@/components/CardInnerWrapper";
import { Image } from "@nextui-org/react";
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
  const photos = await getMemberPhotosByUserId(
    params.userId
  );

  return (
    <div className="space-y-6">
      {/* Blockchain Photos Section */}
      <CardInnerWrapper
        header="Blockchain Photos (Walrus + Seal)"
        body={<MemberBlockchainPhotos walletAddress={params.userId} />}
      />

      {/* Traditional Database Photos Section */}
      <CardInnerWrapper
        header="Traditional Photos (Cloudinary)"
        body={
          <div className="grid grid-cols-5 gap-3">
            {photos &&
              photos.map((photo) => (
                <div key={photo.id}>
                  <Image
                    src={photo.url}
                    alt="Image of member"
                    className="object-cover aspect-square"
                  />
                </div>
              ))}
          </div>
        }
      />
    </div>
  );
}
