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
const MEDIA_REGISTRY_ID = "0xd860be341dddb4ce09950e1b88a5264df84db0b9443932aab44c899f95ed6f73";
const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

const SERVER_OBJECT_IDS = [
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
  decryptedUrl?: string; // For displaying decrypted image
}

interface Props {
  refreshTrigger?: number;
}

export default function BlockchainPhotoGallery({ refreshTrigger }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const [photos, setPhotos] = useState<BlockchainMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);

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
    if (account?.address) {
      loadBlockchainPhotos();
    }
  }, [account?.address, refreshTrigger]);

  const loadBlockchainPhotos = async () => {
    if (!account?.address) return;

    try {
      setLoading(true);
      console.log("[Gallery] Loading photos for:", account.address);

      // Get user's media IDs from MediaRegistry
      const registry = await client.getObject({
        id: MEDIA_REGISTRY_ID,
        options: { showContent: true },
      });

      if (!registry.data?.content || !("fields" in registry.data.content)) {
        console.error("[Gallery] Invalid media registry");
        setPhotos([]);
        setLoading(false);
        return;
      }

      const fields = registry.data.content.fields as any;
      const userMediaTableId = fields.user_media.fields.id.id;
      console.log("[Gallery] User media table ID:", userMediaTableId);

      // Query dynamic field for user's media
      try {
        const dynamicField = await client.getDynamicFieldObject({
          parentId: userMediaTableId,
          name: {
            type: "address",
            value: account.address,
          },
        });

        if (!dynamicField.data?.content || !("fields" in dynamicField.data.content)) {
          console.log("[Gallery] No media found for user");
          setPhotos([]);
          setLoading(false);
          return;
        }

        const mediaIds = (dynamicField.data.content.fields as any).value as string[];
        console.log("[Gallery] Found", mediaIds.length, "media items");

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
              console.log("[Gallery] Media fields:", {
                id: mediaId,
                created_at: mFields.created_at,
                created_at_type: typeof mFields.created_at
              });

              // Only show images (contentType === 0)
              if (mFields.content_type === 0) {
                // Parse timestamp - could be string or number in milliseconds
                let createdAt: string;
                try {
                  const timestamp = typeof mFields.created_at === 'string'
                    ? parseInt(mFields.created_at)
                    : mFields.created_at;
                  createdAt = new Date(timestamp).toISOString();
                } catch (e) {
                  console.warn("[Gallery] Invalid timestamp for media:", mediaId, mFields.created_at);
                  createdAt = new Date().toISOString(); // Fallback to now
                }

                const media: BlockchainMedia = {
                  id: mediaId,
                  blobId: mFields.walrus_blob_id,
                  contentType: mFields.content_type,
                  visibilityLevel: mFields.visibility_level,
                  caption: mFields.caption || "",
                  createdAt,
                  sealPolicyId: mFields.seal_policy_id || undefined,
                  url: `${AGGREGATOR_URL}/v1/${mFields.walrus_blob_id}`,
                };

                mediaList.push(media);
              }
            }
          } catch (err) {
            console.error("[Gallery] Error loading media:", mediaId, err);
          }
        }

        // Sort by creation date (newest first)
        mediaList.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        console.log("[Gallery] Loaded", mediaList.length, "photos");
        setPhotos(mediaList);

        // Auto-decrypt all photos with seal policy
        const photosToDecrypt = mediaList.filter(p => p.sealPolicyId);
        if (photosToDecrypt.length > 0) {
          console.log("[Gallery] Auto-decrypting", photosToDecrypt.length, "photos...");
          // Decrypt in parallel (but not too many at once)
          for (const photo of photosToDecrypt) {
            decryptMediaSilent(photo);
          }
        }
      } catch (err: any) {
        if (err.message?.includes("not found") || err.message?.includes("Could not find")) {
          console.log("[Gallery] No media found for user (dynamic field not exists)");
          setPhotos([]);
        } else {
          console.error("[Gallery] Error querying media:", err);
          setPhotos([]);
        }
      }
    } catch (error) {
      console.error("[Gallery] Error loading blockchain photos:", error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  // Decrypt media silently (for auto-decrypt)
  const decryptMediaSilent = async (photo: BlockchainMedia) => {
    if (!account || !photo.sealPolicyId) {
      return;
    }

    try {
      // Step 1: Download encrypted blob from Walrus
      const aggregatorUrl = `/aggregator1/v1/blobs/${photo.blobId}`;
      const blobResponse = await fetch(aggregatorUrl);

      if (!blobResponse.ok) {
        throw new Error(`Failed to download blob: ${blobResponse.statusText}`);
      }

      const encryptedBlob = await blobResponse.arrayBuffer();
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

      console.log("[Gallery] Auto-decrypted photo:", photo.id);
    } catch (error: any) {
      console.error("[Gallery] Auto-decrypt error for", photo.id, ":", error.message);
    }
  };

  // Decrypt media with user feedback
  const decryptMedia = async (photo: BlockchainMedia) => {
    if (!account || !photo.sealPolicyId) {
      toast.error("Cannot decrypt: No seal policy");
      return;
    }

    setDecryptingId(photo.id);

    try {
      await decryptMediaSilent(photo);
      toast.success("Photo decrypted successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to decrypt photo");
    } finally {
      setDecryptingId(null);
    }
  };

  const getVisibilityLabel = (level: number) => {
    switch (level) {
      case 0: return "Public";
      case 1: return "Verified Only";
      case 2: return "Matches Only";
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

  if (!account) {
    return null;
  }

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
        <p className="text-gray-600">No blockchain photos yet</p>
        <p className="text-sm text-gray-500 mt-1">
          Upload your first photo to Walrus decentralized storage
        </p>
      </div>
    );
  }

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Card key={photo.id} className="border-2 border-purple-100 overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square bg-gradient-to-br from-purple-50 to-pink-50">
                {photo.decryptedUrl ? (
                  // Show decrypted image
                  <img
                    src={photo.decryptedUrl}
                    alt={photo.caption || "Decrypted photo"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // Show encrypted placeholder
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-4">
                      <Lock className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                      <p className="text-xs text-purple-600 font-medium">
                        Encrypted Photo
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {photo.blobId.slice(0, 8)}...
                      </p>
                      {photo.sealPolicyId && (
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

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> These photos are encrypted with Seal Protocol.
          To view them, you'll need to implement decryption using your wallet's private key.
        </p>
      </div>
    </div>
  );
}
