"use client";

import { useState, useEffect } from "react";
import EditForm from "./EditForm";
import type { Member } from "@prisma/client";
import { Spinner } from "@nextui-org/react";
import { useRouter } from "next/navigation";

export default function EditFormClient() {
  const router = useRouter();
  const [data, setData] = useState<{
    member: Member;
    hasOnChainProfile: boolean;
    walletAddress: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/member/profile-data');

        if (response.status === 404) {
          router.push('/not-found');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch profile data');
        }

        const profileData = await response.json();
        setData(profileData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" label="Loading your profile..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-600">{error || 'Failed to load profile'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <EditForm
      member={data.member}
      hasOnChainProfile={data.hasOnChainProfile}
      walletAddress={data.walletAddress}
    />
  );
}
