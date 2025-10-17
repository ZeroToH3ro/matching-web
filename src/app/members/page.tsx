import React from "react";
import dynamic from "next/dynamic";

// Lazy load the client component
const MembersClient = dynamic(() => import("./MembersClient"), {
  ssr: false,
  loading: () => (
    <div className="container mx-auto py-8">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          Discover Matches
        </h1>
      </div>
      <div className="flex justify-center items-center p-12">
        <div className="animate-pulse text-gray-500">Loading matches...</div>
      </div>
    </div>
  ),
});

export default function MembersPage() {
  return <MembersClient />;
}
