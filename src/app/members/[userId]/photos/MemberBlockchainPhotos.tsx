"use client";

import { useCurrentAccount, useSuiClient, useSignPersonalMessage } from "@mysten/dapp-kit";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Eye, Unlock } from "lucide-react";
import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { toast } from "react-toastify";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
const MEDIA_REGISTRY_ID = process.env.NEXT_PUBLIC_MEDIA_REGISTRY_ID || "0x5e376e64367c7f06907b4bfecf8f97b2d79a8e0c747630954858499e6ac72fc4";
const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

// Multiple aggregators for fallback
const AGGREGATOR_URLS = [
  "/aggregator1/v1/blobs",
  "/aggregator2/v1/blobs",
  "/aggregator3/v1/blobs",
];

// Parse Seal server IDs from env (comma-separated)
const SERVER_OBJECT_IDS = process.env.NEXT_PUBLIC_SEAL_SERVER_IDS
  ? process.env.NEXT_PUBLIC_SEAL_SERVER_IDS.split(',').map(id => id.trim())
  : [
      "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
      "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
    ];

interface BlockchainMedia {
  id: string;
  blobId: string;
  contentType: number;
  visibilityLevel: number;
  caption: string;
  createdAt: string;
  sealPolicyId?: string;
  url?: string;
  decryptedUrl?: string;
}

interface Props {
  walletAddress: string; // Wallet address of the profile owner
}

export default function MemberBlockchainPhotos({ walletAddress }: Props) {
  const account = useCurrentAccount(); // Current logged-in user
  const client = useSuiClient();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const [photos, setPhotos] = useState<BlockchainMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8); // Show 8 photos per page

  const cachedSessionKeyRef = useRef<SessionKey | null>(null);
  const sealClientRef = useRef<SealClient | null>(null);

  // Get or create Seal client
  const getSealClient = () => {
    if (!sealClientRef.current) {
      sealClientRef.current = new SealClient({
        suiClient: client,
        serverConfigs: SERVER_OBJECT_IDS.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false,
      });
    }
    return sealClientRef.current;
  };

  useEffect(() => {
    if (walletAddress) {
      loadBlockchainPhotos();
    }
  }, [walletAddress]);

  const loadBlockchainPhotos = async () => {
    if (!walletAddress) return;

    try {
      setLoading(true);
      console.log("[MemberPhotos] Loading photos for:", walletAddress);

      // Get user's media IDs from MediaRegistry
      const registry = await client.getObject({
        id: MEDIA_REGISTRY_ID,
        options: { showContent: true },
      });

      if (!registry.data?.content || !("fields" in registry.data.content)) {
        console.error("[MemberPhotos] Invalid media registry");
        setPhotos([]);
        setLoading(false);
        return;
      }

      const fields = registry.data.content.fields as any;
      const userMediaTableId = fields.user_media.fields.id.id;

      // Query dynamic field for user's media
      try {
        const dynamicField = await client.getDynamicFieldObject({
          parentId: userMediaTableId,
          name: {
            type: "address",
            value: walletAddress,
          },
        });

        if (!dynamicField.data?.content || !("fields" in dynamicField.data.content)) {
          console.log("[MemberPhotos] No media found for user");
          setPhotos([]);
          setLoading(false);
          return;
        }

        const mediaIds = (dynamicField.data.content.fields as any).value as string[];
        console.log("[MemberPhotos] Found", mediaIds.length, "media items");

        // Fetch details for each media
        const mediaList: BlockchainMedia[] = [];

        for (const mediaId of mediaIds) {
          try {
            const mediaObj = await client.getObject({
              id: mediaId,
              options: { showContent: true },
            });

            if (mediaObj.data?.content && "fields" in mediaObj.data.content) {
              const mFields = mediaObj.data.content.fields as any;

              // Only show images (contentType === 0)
              if (mFields.content_type === 0) {
                // Parse timestamp
                let createdAt: string;
                try {
                  const timestamp = typeof mFields.created_at === 'string'
                    ? parseInt(mFields.created_at)
                    : mFields.created_at;
                  createdAt = new Date(timestamp).toISOString();
                } catch (e) {
                  createdAt = new Date().toISOString();
                }

                // Check visibility level
                const visibilityLevel = mFields.visibility_level;

                // 0 = Public - everyone can see
                // 1 = Verified Only - only verified users
                // 2 = Matches Only - only matches can decrypt

                // For now, we'll show all photos, but only allow decryption for matches
                const media: BlockchainMedia = {
                  id: mediaId,
                  blobId: mFields.walrus_blob_id,
                  contentType: mFields.content_type,
                  visibilityLevel,
                  caption: mFields.caption || "",
                  createdAt,
                  sealPolicyId: mFields.seal_policy_id || undefined,
                  url: `${AGGREGATOR_URL}/v1/${mFields.walrus_blob_id}`,
                };

                mediaList.push(media);
              }
            }
          } catch (err) {
            console.error("[MemberPhotos] Error loading media:", mediaId, err);
          }
        }

        // Sort by creation date (newest first)
        mediaList.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        console.log("[MemberPhotos] Loaded", mediaList.length, "photos");
        setPhotos(mediaList);

        // ✅ REMOVED: Auto-decrypt - let users manually decrypt to improve performance
        // Photos will show "Decrypt" button instead of loading all automatically
      } catch (err: any) {
        if (err.message?.includes("not found") || err.message?.includes("Could not find")) {
          console.log("[MemberPhotos] No media found for user");
          setPhotos([]);
        } else {
          console.error("[MemberPhotos] Error querying media:", err);
          setPhotos([]);
        }
      }
    } catch (error) {
      console.error("[MemberPhotos] Error loading blockchain photos:", error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fetch blob with fallback
  const fetchBlobWithFallback = async (blobId: string): Promise<ArrayBuffer> => {
    let lastError: Error | null = null;

    // Try each aggregator
    for (const aggregatorUrl of AGGREGATOR_URLS) {
      try {
        const url = `${aggregatorUrl}/${blobId}`;
        console.log(`[MemberPhotos] Trying aggregator: ${url}`);

        const response = await fetch(url);

        if (response.ok) {
          console.log(`[MemberPhotos] ✅ Success with aggregator: ${aggregatorUrl}`);
          return await response.arrayBuffer();
        }

        console.log(`[MemberPhotos] ❌ Failed with ${aggregatorUrl}: ${response.status}`);
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err: any) {
        console.log(`[MemberPhotos] ❌ Error with ${aggregatorUrl}:`, err.message);
        lastError = err;
      }
    }

    // All aggregators failed
    throw new Error(`All aggregators failed. Last error: ${lastError?.message || 'Unknown'}`);
  };

  // Decrypt media silently (for auto-decrypt)
  const decryptMediaSilent = async (photo: BlockchainMedia, throwError = false) => {
    if (!account || !photo.sealPolicyId) {
      if (throwError) {
        throw new Error("Wallet not connected or no seal policy");
      }
      return;
    }

    try {
      // Step 1: Download encrypted blob from Walrus with fallback
      const encryptedBlob = await fetchBlobWithFallback(photo.blobId);
      const encryptedBytes = new Uint8Array(encryptedBlob);

      // Step 2: Parse EncryptedObject to get encryption ID
      const encryptedObj = EncryptedObject.parse(encryptedBytes);
      const encryptedId = encryptedObj.id;

      // Step 3: Create or reuse SessionKey
      let sessionKey = cachedSessionKeyRef.current;
      if (!sessionKey) {
        sessionKey = await SessionKey.create({
          address: account.address,
          packageId: PACKAGE_ID,
          ttlMin: 10,
          suiClient: client,
        });

        // Sign personal message
        await new Promise<void>((resolve, reject) => {
          signPersonalMessage(
            { message: sessionKey!.getPersonalMessage() },
            {
              onSuccess: async (result: { signature: string }) => {
                try {
                  await sessionKey!.setPersonalMessageSignature(result.signature);
                  cachedSessionKeyRef.current = sessionKey!;
                  resolve();
                } catch (err) {
                  reject(err);
                }
              },
              onError: reject,
            }
          );
        });
      }

      // Step 4: Build transaction with seal_approve_match
      const tx = new Transaction();
      const encryptionIdBytes = fromHex(encryptedId);

      tx.moveCall({
        target: `${PACKAGE_ID}::seal_policies::seal_approve_match`,
        arguments: [
          tx.pure.vector("u8", Array.from(encryptionIdBytes)),
          tx.object(photo.sealPolicyId),
          tx.object("0x6"), // Clock
        ],
      });

      const txBytes = await tx.build({ client, onlyTransactionKind: true });

      // Step 5: Fetch decryption keys from Seal servers
      const sealClient = getSealClient();
      await sealClient.fetchKeys({
        ids: [encryptedId],
        txBytes,
        sessionKey,
        threshold: 2,
      });

      // Step 6: Decrypt the data
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      // Step 7: Create blob URL for preview
      const contentType = photo.contentType === 0 ? 'image/jpeg' : 'video/mp4';
      const blob = new Blob([Uint8Array.from(decryptedBytes)], { type: contentType });
      const decryptedUrl = URL.createObjectURL(blob);

      // Update photo in state
      setPhotos(prev => prev.map(p =>
        p.id === photo.id ? { ...p, decryptedUrl } : p
      ));

      console.log("[MemberPhotos] Auto-decrypted photo:", photo.id);
    } catch (error: any) {
      console.error("[MemberPhotos] Auto-decrypt error for", photo.id, ":", error.message);
      // If throwError is true, re-throw for user feedback
      if (throwError) {
        throw error;
      }
      // Otherwise, don't show error to user - they might not have access
    }
  };

  // Decrypt media with user feedback
  const decryptMedia = async (photo: BlockchainMedia) => {
    if (!account) {
      toast.error("Please connect your wallet to view this photo");
      return;
    }

    if (!photo.sealPolicyId) {
      toast.error("Cannot decrypt: No seal policy");
      return;
    }

    setDecryptingId(photo.id);

    try {
      // Call silent decrypt with throwError flag
      await decryptMediaSilent(photo, true);

      // Wait a bit for state update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if decryption actually succeeded
      const updatedPhoto = photos.find(p => p.id === photo.id);
      if (updatedPhoto?.decryptedUrl) {
        toast.success("Photo decrypted successfully!");
      } else {
        throw new Error("Decryption failed - no decrypted URL");
      }
    } catch (error: any) {
      console.error("[MemberPhotos] Decrypt error:", error);
      toast.error(error.message || "You don't have access to view this photo");
    } finally {
      setDecryptingId(null);
    }
  };

  const getVisibilityLabel = (level: number) => {
    switch (level) {
      case 0: return "Public";
      case 1: return "All Matches";
      case 2: return "Specific Match";
      default: return "Unknown";
    }
  };

  const getVisibilityColor = (level: number) => {
    switch (level) {
      case 0: return "text-green-600";
      case 1: return "text-blue-600";
      case 2: return "text-purple-600";
      default: return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Lock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-600">No blockchain photos</p>
      </div>
    );
  }

  // Filter photos to only show decrypted ones, public, or all-matches
  const visiblePhotos = photos.filter(photo => {
    // Show if already decrypted
    if (photo.decryptedUrl) return true;

    // Show if public (visibilityLevel === 0)
    if (photo.visibilityLevel === 0) return true;

    // Show if all-matches (visibilityLevel === 1) - accessible to all matched users
    if (photo.visibilityLevel === 1) return true;

    // Hide encrypted photos that haven't been decrypted (visibilityLevel === 2)
    return false;
  });

  const encryptedCount = photos.filter(p => p.sealPolicyId && !p.decryptedUrl).length;

  // Pagination logic
  const totalPages = Math.ceil(visiblePhotos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPhotos = visiblePhotos.slice(startIndex, endIndex);

  // Reset to page 1 if current page is out of bounds
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  if (visiblePhotos.length === 0 && encryptedCount > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Blockchain Photos ({photos.length})
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Lock className="w-4 h-4" />
            <span>Encrypted with Seal Protocol</span>
          </div>
        </div>

        <div className="p-8 text-center bg-purple-50 rounded-lg border-2 border-dashed border-purple-300">
          <Lock className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <h4 className="text-lg font-semibold text-purple-900 mb-2">
            🔒 {encryptedCount} Private Photo{encryptedCount > 1 ? 's' : ''}
          </h4>
          <p className="text-purple-700">
            This user has private photos that are only visible to matches.
            {account ? ' Match with them to view their private photos!' : ' Connect your wallet and match to view.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Blockchain Photos ({visiblePhotos.length})
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Lock className="w-4 h-4" />
          <span>Encrypted with Seal Protocol</span>
        </div>
      </div>

      {encryptedCount > 0 && account && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>🔒 {encryptedCount} encrypted photo{encryptedCount > 1 ? 's' : ''}</strong> -
            Only visible to matches. Match with this user to view their private photos.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {currentPhotos.map((photo) => (
          <Card key={photo.id} className="border-2 border-purple-100 overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square bg-gradient-to-br from-purple-50 to-pink-50">
                {photo.decryptedUrl || photo.visibilityLevel === 0 || photo.visibilityLevel === 1 ? (
                  // Show decrypted image OR public/all-matches image directly
                  <img
                    src={photo.decryptedUrl || photo.url || `${AGGREGATOR_URLS[0]}/${photo.blobId}`}
                    alt={photo.caption || "Photo"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to other aggregators if first one fails
                      const img = e.target as HTMLImageElement;
                      const currentSrc = img.src;
                      const aggregatorIndex = AGGREGATOR_URLS.findIndex(url => currentSrc.includes(url));

                      if (aggregatorIndex < AGGREGATOR_URLS.length - 1) {
                        const nextAggregator = AGGREGATOR_URLS[aggregatorIndex + 1];
                        img.src = `${nextAggregator}/${photo.blobId}`;
                      }
                    }}
                  />
                ) : (
                  // Show encrypted placeholder for private photos
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-4">
                      <Lock className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                      <p className="text-xs text-purple-600 font-medium">
                        Encrypted Photo
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {photo.blobId.slice(0, 8)}...
                      </p>
                      {photo.sealPolicyId && account && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decryptMedia(photo)}
                          disabled={decryptingId === photo.id}
                          className="mt-2"
                        >
                          {decryptingId === photo.id ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Decrypting...
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 mr-1" />
                              Decrypt
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className={`w-4 h-4 ${getVisibilityColor(photo.visibilityLevel)}`} />
                  <span className={`text-xs font-medium ${getVisibilityColor(photo.visibilityLevel)}`}>
                    {getVisibilityLabel(photo.visibilityLevel)}
                  </span>
                </div>

                {photo.caption && (
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {photo.caption}
                  </p>
                )}

                <p className="text-xs text-gray-400">
                  {new Date(photo.createdAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={currentPage === page ? "bg-purple-600 text-white" : ""}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Show photo count info */}
      {visiblePhotos.length > 0 && (
        <div className="text-center text-sm text-gray-500 mt-4">
          Showing {startIndex + 1}-{Math.min(endIndex, visiblePhotos.length)} of {visiblePhotos.length} photos
        </div>
      )}
    </div>
  );
}
