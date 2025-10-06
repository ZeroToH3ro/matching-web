"use client";

import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SealClient } from "@mysten/seal";
import { toHex, fromHex } from "@mysten/sui/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef } from "react";
import { toast } from "react-toastify";
import { Upload, Loader2, Lock, Eye, Users } from "lucide-react";
import { getMatchIdsByAddress } from "@/lib/blockchain/contractQueries";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
const MEDIA_REGISTRY_ID = "0xd860be341dddb4ce09950e1b88a5264df84db0b9443932aab44c899f95ed6f73";
const ALLOWLIST_REGISTRY_ID = "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";

const SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
];

// Walrus publisher service (using Next.js rewrites)
const getPublisherUrl = (path: string) => {
  // Use Next.js rewrite proxy to avoid CORS
  return `/publisher1/v1/${path.replace(/^\/+/, '').replace(/^v1\//, '')}`;
};

interface SuiTransactionResult {
  digest: string;
  effects?: {
    status: { status: string };
  };
  objectChanges?: Array<{
    type: string;
    objectType?: string;
    objectId?: string;
  }>;
}

interface Props {
  onUploadSuccess?: () => void;
}

export default function BlockchainPhotoUpload({ onUploadSuccess }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [visibilityLevel, setVisibilityLevel] = useState<string>("1"); // Default: Verified Only
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [matchList, setMatchList] = useState<Array<{ matchId: string; index: number }>>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load user's matches when visibility is "Matches Only"
  const loadMatches = async () => {
    if (!account?.address) return;

    setLoadingMatches(true);
    try {
      const matchIds = await getMatchIdsByAddress(client, account.address);
      setMatchList(matchIds.map((id, index) => ({ matchId: id, index: index + 1 })));
    } catch (error) {
      console.error("Error loading matches:", error);
      toast.error("Failed to load matches");
    } finally {
      setLoadingMatches(false);
    }
  };

  // Get or create MatchAllowlist
  const getOrCreateMatchAllowlist = async (matchId: string): Promise<string> => {
    try {
      // Check if MatchAllowlist already exists
      const registry = await client.getObject({
        id: ALLOWLIST_REGISTRY_ID,
        options: { showContent: true },
      });

      if (!registry.data?.content || !("fields" in registry.data.content)) {
        throw new Error("Invalid allowlist registry");
      }

      const fields = registry.data.content.fields as any;
      const matchAllowlistsTable = fields.match_allowlists?.fields?.id?.id;

      if (matchAllowlistsTable) {
        try {
          const dynamicField = await client.getDynamicFieldObject({
            parentId: matchAllowlistsTable,
            name: {
              type: "0x2::object::ID",
              value: matchId,
            },
          });

          if (dynamicField.data?.content && "fields" in dynamicField.data.content) {
            const allowlistId = (dynamicField.data.content.fields as any).value;
            console.log("Found existing MatchAllowlist:", allowlistId);
            return allowlistId;
          }
        } catch (err) {
          console.log("MatchAllowlist not found, creating new one...");
        }
      }

      // Create new MatchAllowlist
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_policies::create_match_allowlist_shared`,
        arguments: [
          tx.object(ALLOWLIST_REGISTRY_ID),
          tx.object(matchId),
          tx.pure.option("u64", null), // No expiry
          tx.object("0x6"), // Clock
        ],
      });

      return new Promise<string>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: async (result) => {
              // Query the transaction to get object changes
              const txResult = await client.waitForTransaction({
                digest: result.digest,
                options: {
                  showObjectChanges: true,
                },
              });

              const created = txResult.objectChanges?.find(
                (change: any) => change.type === "created" && change.objectType?.includes("MatchAllowlist")
              );
              if (created && "objectId" in created) {
                resolve(created.objectId);
              } else {
                reject(new Error("Failed to get MatchAllowlist ID"));
              }
            },
            onError: reject,
          }
        );
      });
    } catch (error) {
      console.error("Error getting/creating MatchAllowlist:", error);
      throw error;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10 MiB for Walrus)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10 MiB");
      return;
    }

    // Only allow images
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadToBlockchain = async () => {
    if (!selectedFile || !account?.address) {
      toast.error("Please connect wallet and select a file");
      return;
    }

    // Validate Matches Only selection
    if (visibilityLevel === "2" && !selectedMatchId) {
      toast.error("Please select a match for Matches Only visibility");
      return;
    }

    setIsUploading(true);

    try {
      console.log("[Upload] Starting upload process...");

      // Step 1: Get profile ID
      console.log("[Upload] Getting profile ID...");
      const ownedProfiles = await client.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${PACKAGE_ID}::core::UserProfile`,
        },
        options: {
          showContent: true,
        },
      });

      if (ownedProfiles.data.length === 0) {
        toast.error("No profile found. Please create a profile first.");
        setIsUploading(false);
        return;
      }

      const profileId = ownedProfiles.data[0].data?.objectId!;
      console.log("[Upload] Profile ID:", profileId);

      // Step 2: Get MatchAllowlist if needed
      let matchAllowlistId: string | undefined;
      if (visibilityLevel === "2" && selectedMatchId) {
        console.log("[Upload] Getting MatchAllowlist for:", selectedMatchId);
        toast.info("Getting match allowlist...");
        matchAllowlistId = await getOrCreateMatchAllowlist(selectedMatchId);
        console.log("[Upload] MatchAllowlist ID:", matchAllowlistId);
      }

      // Step 3: Encrypt and upload to Walrus
      console.log("[Upload] Starting encryption...");
      toast.info("Encrypting file...");

      const fileData = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(e.target.result));
          } else {
            reject(new Error("Failed to read file"));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsArrayBuffer(selectedFile);
      });

      let encryptionId: string;
      let sealPolicyId: string | undefined;

      if (matchAllowlistId) {
        // Use MatchAllowlist-based encryption for matches-only content
        const nonce = crypto.getRandomValues(new Uint8Array(5));
        const TYPE_MATCH = 0x03;
        const allowlistIdBytes = fromHex(matchAllowlistId.replace("0x", ""));
        const namespace = new Uint8Array([TYPE_MATCH, ...allowlistIdBytes, ...nonce]);
        encryptionId = toHex(namespace);
        sealPolicyId = matchAllowlistId;
      } else {
        // Simple encryption for public/verified content
        const nonce = crypto.getRandomValues(new Uint8Array(5));
        encryptionId = toHex(nonce);
      }

      const sealClient = getSealClient();
      console.log("[Upload] Encrypting with ID:", encryptionId);
      const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: encryptionId,
        data: fileData,
      });
      console.log("[Upload] Encrypted bytes:", encryptedBytes.length);

      toast.info("Uploading to Walrus...");

      // Upload to Walrus publisher (using Next.js rewrite proxy)
      const NUM_EPOCH = 1;
      console.log("[Upload] Uploading to Walrus via Next.js proxy");
      console.log("[Upload] Blob size:", encryptedBytes.length, "bytes");

      const response = await fetch(getPublisherUrl(`blobs?epochs=${NUM_EPOCH}`), {
        method: 'PUT',
        body: encryptedBytes,
      });

      console.log("[Upload] Response status:", response.status);

      if (response.status !== 200) {
        const errorText = await response.text();
        console.error("[Upload] Upload error:", errorText);
        throw new Error("Failed to upload to Walrus. Please try again.");
      }

      const result = await response.json();
      console.log("[Upload] Walrus response:", result);

      let blobId: string;
      if ('alreadyCertified' in result) {
        blobId = result.alreadyCertified.blobId;
        console.log("[Upload] Blob already certified:", blobId);
      } else if ('newlyCreated' in result) {
        blobId = result.newlyCreated.blobObject.blobId;
        console.log("[Upload] Blob newly created:", blobId);
      } else {
        throw new Error("Unexpected Walrus response");
      }

      console.log("[Upload] Creating on-chain record...");
      toast.info("Creating on-chain record...");

      // Step 4: Create MediaContent on-chain
      const tx = new Transaction();

      const tagList = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

      const mediaContent = tx.moveCall({
        target: `${PACKAGE_ID}::core::create_media_content`,
        arguments: [
          tx.object(MEDIA_REGISTRY_ID),
          tx.object(profileId),
          tx.pure.string(blobId),
          tx.pure.u8(0), // contentType: 0 = Image
          tx.pure.u8(parseInt(visibilityLevel)),
          tx.pure.option("string", sealPolicyId || null),
          tx.pure.string(caption || "Profile photo"),
          tx.pure.vector("string", tagList.length > 0 ? tagList : ["profile"]),
          tx.object("0x6"), // Clock
        ],
      });

      // Transfer MediaContent to sender
      tx.transferObjects([mediaContent], tx.pure.address(account.address));

      console.log("[Upload] Executing transaction...");
      // Execute transaction
      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (result) => {
              console.log("[Upload] Transaction success:", result.digest);
              toast.success("Photo uploaded to blockchain! 🎉");
              setSelectedFile(null);
              setPreview(null);
              setCaption("");
              setTags("");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              // Trigger gallery refresh
              onUploadSuccess?.();
              resolve();
            },
            onError: (error) => {
              console.error("[Upload] Transaction error:", error);
              toast.error("Failed to create on-chain record");
              reject(error);
            },
          }
        );
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  // Load matches when visibility changes to "Matches Only"
  const handleVisibilityChange = (value: string) => {
    setVisibilityLevel(value);
    if (value === "2" && matchList.length === 0) {
      loadMatches();
    }
  };

  if (!account) {
    return (
      <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
        <p className="text-warning-800">
          Please connect your Sui wallet to upload photos to blockchain
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-900 mb-2">
          Upload to Blockchain (Walrus Storage)
        </h3>
        <p className="text-sm text-purple-700 mb-4">
          Photos are encrypted with Seal Protocol and stored on Walrus decentralized storage
        </p>

        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="blockchain-photo-upload"
            />
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Photo
            </Button>
          </div>

          {preview && (
            <div className="space-y-4">
              <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-purple-200">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility Level</Label>
                <Select
                  value={visibilityLevel}
                  onValueChange={handleVisibilityChange}
                  disabled={isUploading}
                >
                  <SelectTrigger id="visibility" className="w-full">
                    <SelectValue placeholder="Select who can see this photo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-green-600" />
                        <div className="flex flex-col">
                          <span className="font-medium">Public</span>
                          <span className="text-xs text-gray-500">Everyone can see</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="1">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-600" />
                        <div className="flex flex-col">
                          <span className="font-medium">Verified Only</span>
                          <span className="text-xs text-gray-500">Only verified users</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <div className="flex flex-col">
                          <span className="font-medium">Matches Only</span>
                          <span className="text-xs text-gray-500">Only your matches</span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {visibilityLevel === "2" && (
                <div className="space-y-2">
                  <Label htmlFor="match">Select Match</Label>
                  <Select
                    value={selectedMatchId}
                    onValueChange={setSelectedMatchId}
                    disabled={isUploading || loadingMatches}
                  >
                    <SelectTrigger id="match" className="w-full">
                      <SelectValue placeholder={loadingMatches ? "Loading matches..." : "Choose which match can see this"} />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingMatches ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : matchList.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">No matches found</div>
                      ) : (
                        matchList.map((match) => (
                          <SelectItem key={match.matchId} value={match.matchId}>
                            <div className="flex flex-col">
                              <span className="font-medium">Match {match.index}</span>
                              <span className="text-xs text-gray-500 font-mono">
                                {match.matchId.slice(0, 8)}...{match.matchId.slice(-6)}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Input
                  id="caption"
                  placeholder="Add a caption for your photo"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="profile, photo, selfie (comma separated)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={uploadToBlockchain}
                  disabled={isUploading}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload to Blockchain
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    setCaption("");
                    setTags("");
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
