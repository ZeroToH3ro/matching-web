import { getAuthUserId } from "@/app/actions/authActions";
import {
  getMemberByUserId,
  getMemberPhotosByUserId,
} from "@/app/actions/memberActions";
import MemberPhotos from "@/components/MemberPhotos";
import React from "react";
import CardInnerWrapper from "@/components/CardInnerWrapper";
import dynamic from "next/dynamic";

const MemberPhotoUpload = dynamic(() => import("./MemberPhotoUpload"), {
  ssr: false,
  loading: () => <div className="text-center p-4">Loading uploader...</div>
});

export default async function PhotosPage() {
  const userId = await getAuthUserId();
  const member = await getMemberByUserId(userId);
  const photos = await getMemberPhotosByUserId(
    userId
  );

  return (
    <CardInnerWrapper
      header="Edit Profile"
      body={
        <>
          <MemberPhotoUpload />
          <MemberPhotos
            photos={photos}
            editing={true}
            mainImageUrl={member?.image}
          />
        </>
      }
    />
  );
}
