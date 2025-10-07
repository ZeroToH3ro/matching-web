"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  getProfileIdByAddress,
  getMatchIdBetweenUsers,
  getChatRoomIdByMatchId,
  getChatAllowlistIdByChatRoomId,
  getMatchIdsByAddress,
} from "@/lib/blockchain/contractQueries";

interface DebugStep {
  step: string;
  status: "pending" | "success" | "error" | "warning";
  message: string;
  data?: any;
}

const MATCH_CHAT_REGISTRY_ID = "0xe909c265300cec16f82a534d30ff50c64295fd563809f0beaad38c88b24e9739";
const ALLOWLIST_REGISTRY_ID = "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";

export default function DetailedChatDebugger() {
  const account = useCurrentAccount();
  const client = useSuiClient();

  const [loading, setLoading] = useState(false);
  const [otherWallet, setOtherWallet] = useState("");
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([]);

  const addDebugStep = (step: DebugStep) => {
    setDebugSteps((prev) => [...prev, step]);
  };

  const updateLastStep = (updates: Partial<DebugStep>) => {
    setDebugSteps((prev) => {
      const newSteps = [...prev];
      if (newSteps.length > 0) {
        newSteps[newSteps.length - 1] = { ...newSteps[newSteps.length - 1], ...updates };
      }
      return newSteps;
    });
  };

  const debugChatConnection = async () => {
    if (!account || !otherWallet) {
      alert("Please connect wallet and enter other wallet address");
      return;
    }

    setLoading(true);
    setDebugSteps([]);

    try {
      // Step 1: Check my profile
      addDebugStep({
        step: "1. Checking your profile",
        status: "pending",
        message: "Looking up profile for your wallet...",
      });

      const myProfileId = await getProfileIdByAddress(client, account.address);

      if (!myProfileId) {
        updateLastStep({
          status: "error",
          message: "❌ Your profile not found. You need to create a profile first.",
        });
        setLoading(false);
        return;
      }

      updateLastStep({
        status: "success",
        message: `✅ Your profile found: ${myProfileId}`,
        data: { myProfileId },
      });

      // Step 2: Check other user's profile
      addDebugStep({
        step: "2. Checking other user's profile",
        status: "pending",
        message: "Looking up profile for other wallet...",
      });

      const otherProfileId = await getProfileIdByAddress(client, otherWallet);

      if (!otherProfileId) {
        updateLastStep({
          status: "error",
          message: "❌ Other user's profile not found. They need to create a profile first.",
        });
        setLoading(false);
        return;
      }

      updateLastStep({
        status: "success",
        message: `✅ Other user's profile found: ${otherProfileId}`,
        data: { otherProfileId },
      });

      // Step 3: Check matches for my wallet
      addDebugStep({
        step: "3. Getting all your matches",
        status: "pending",
        message: "Querying all Match objects owned by you...",
      });

      const myMatches = await getMatchIdsByAddress(client, account.address);

      updateLastStep({
        status: myMatches.length > 0 ? "success" : "warning",
        message: `Found ${myMatches.length} match(es) owned by you`,
        data: { myMatches },
      });

      if (myMatches.length === 0) {
        addDebugStep({
          step: "No matches found",
          status: "error",
          message: "❌ You don't have any Match objects. Need to create a match first.",
        });
        setLoading(false);
        return;
      }

      // Step 4: Check each match to find the one with other user
      addDebugStep({
        step: "4. Finding match between you and other user",
        status: "pending",
        message: `Checking ${myMatches.length} matches...`,
      });

      let matchId = null;
      let matchDetails = null;

      for (const mId of myMatches) {
        const matchObj = await client.getObject({
          id: mId,
          options: { showContent: true },
        });

        if (matchObj.data?.content && matchObj.data.content.dataType === "moveObject") {
          const fields = matchObj.data.content.fields as any;
          const userA = fields.user_a;
          const userB = fields.user_b;

          console.log(`Match ${mId}: userA=${userA}, userB=${userB}`);

          const involvesOtherUser =
            (userA === account.address && userB === otherWallet) ||
            (userA === otherWallet && userB === account.address);

          if (involvesOtherUser) {
            matchId = mId;
            matchDetails = {
              matchId: mId,
              userA,
              userB,
              status: fields.status,
              compatibilityScore: fields.compatibility_score,
            };
            break;
          }
        }
      }

      if (!matchId) {
        updateLastStep({
          status: "error",
          message: `❌ No match found between ${account.address.slice(0, 8)}... and ${otherWallet.slice(0, 8)}...`,
          data: { checkedMatches: myMatches },
        });
        setLoading(false);
        return;
      }

      updateLastStep({
        status: "success",
        message: `✅ Match found: ${matchId}`,
        data: matchDetails,
      });

      // Step 5: Check match status
      if (matchDetails && matchDetails.status !== 1) {
        addDebugStep({
          step: "5. Checking match status",
          status: "warning",
          message: `⚠️ Match status is ${matchDetails.status} (not ACTIVE). Status should be 1 (ACTIVE) to create chat.`,
          data: { status: matchDetails.status },
        });
      } else {
        addDebugStep({
          step: "5. Checking match status",
          status: "success",
          message: "✅ Match is ACTIVE (status = 1)",
          data: { status: 1 },
        });
      }

      // Step 6: Check chat room from match
      addDebugStep({
        step: "6. Looking for chat room",
        status: "pending",
        message: "Checking if chat room exists for this match...",
      });

      let chatRoomId = null;

      // Method 1: Query MatchChatRegistry
      try {
        const registry = await client.getObject({
          id: MATCH_CHAT_REGISTRY_ID,
          options: { showContent: true },
        });

        if (registry.data?.content && registry.data.content.dataType === "moveObject") {
          const fields = registry.data.content.fields as any;
          const matchChatsTable = fields.match_chats?.fields?.id?.id;

          if (matchChatsTable) {
            try {
              const dynamicField = await client.getDynamicFieldObject({
                parentId: matchChatsTable,
                name: {
                  type: "0x2::object::ID",
                  value: matchId,
                },
              });

              if (dynamicField.data?.content && dynamicField.data.content.dataType === "moveObject") {
                chatRoomId = (dynamicField.data.content.fields as any).value;
              }
            } catch (err) {
              console.log("Dynamic field not found in MatchChatRegistry");
            }
          }
        }
      } catch (err) {
        console.error("Error querying MatchChatRegistry:", err);
      }

      // Method 2: Check via ChatCreated events (more reliable)
      if (!chatRoomId) {
        console.log("Trying to find chat via events...");
        try {
          const PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";
          const events = await client.queryEvents({
            query: {
              MoveEventType: `${PACKAGE_ID}::chat::ChatCreated`,
            },
            limit: 100,
            order: "descending",
          });

          for (const event of events.data) {
            const parsedJson = event.parsedJson as any;
            if (parsedJson.match_id === matchId) {
              chatRoomId = parsedJson.chat_id;
              console.log("Found chat via events:", chatRoomId);
              break;
            }
          }
        } catch (err) {
          console.error("Error querying events:", err);
        }
      }

      // Method 3: Check owned ChatRooms
      if (!chatRoomId) {
        try {
          const ownedChats = await client.getOwnedObjects({
            owner: account.address,
            filter: {
              StructType: `0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821::chat::ChatRoom`,
            },
            options: { showContent: true },
          });

          console.log("Owned ChatRooms:", ownedChats.data.length);

          for (const chatObj of ownedChats.data) {
            if (chatObj.data?.content && chatObj.data.content.dataType === "moveObject") {
              const fields = chatObj.data.content.fields as any;
              if (fields.match_id === matchId) {
                chatRoomId = chatObj.data.objectId;
                break;
              }
            }
          }
        } catch (err) {
          console.error("Error checking owned ChatRooms:", err);
        }
      }

      if (!chatRoomId) {
        updateLastStep({
          status: "error",
          message: "❌ Chat room not found. You need to create a chat room from the match.",
          data: {
            suggestion: "Use 'Create Chat from Match' in test-contract page",
            matchId,
          },
        });
        setLoading(false);
        return;
      }

      updateLastStep({
        status: "success",
        message: `✅ Chat room found: ${chatRoomId}`,
        data: { chatRoomId },
      });

      // Step 7: Check chat allowlist
      addDebugStep({
        step: "7. Looking for chat allowlist",
        status: "pending",
        message: "Checking if chat allowlist exists...",
      });

      let chatAllowlistId = null;

      try {
        const registry = await client.getObject({
          id: ALLOWLIST_REGISTRY_ID,
          options: { showContent: true },
        });

        if (registry.data?.content && registry.data.content.dataType === "moveObject") {
          const fields = registry.data.content.fields as any;
          const chatAllowlistsTable = fields.chat_allowlists?.fields?.id?.id;

          if (chatAllowlistsTable) {
            try {
              const dynamicField = await client.getDynamicFieldObject({
                parentId: chatAllowlistsTable,
                name: {
                  type: "0x2::object::ID",
                  value: chatRoomId,
                },
              });

              if (dynamicField.data?.content && dynamicField.data.content.dataType === "moveObject") {
                chatAllowlistId = (dynamicField.data.content.fields as any).value;
              }
            } catch (err) {
              console.log("Dynamic field not found in AllowlistRegistry");
            }
          }
        }
      } catch (err) {
        console.error("Error querying AllowlistRegistry:", err);
      }

      if (!chatAllowlistId) {
        updateLastStep({
          status: "error",
          message: "❌ Chat allowlist not found. Need to create ChatAllowlist.",
          data: {
            suggestion: "Should be auto-created when creating chat. If not, create manually.",
            chatRoomId,
          },
        });
        setLoading(false);
        return;
      }

      updateLastStep({
        status: "success",
        message: `✅ Chat allowlist found: ${chatAllowlistId}`,
        data: { chatAllowlistId },
      });

      // Final success
      addDebugStep({
        step: "✅ SUCCESS",
        status: "success",
        message: "All required objects found! You can now send messages.",
        data: {
          myProfileId,
          otherProfileId,
          matchId,
          chatRoomId,
          chatAllowlistId,
        },
      });
    } catch (err: any) {
      addDebugStep({
        step: "Error",
        status: "error",
        message: `Error: ${err.message}`,
        data: err,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: DebugStep["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "pending":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: DebugStep["status"]) => {
    switch (status) {
      case "success":
        return "border-green-200 bg-green-50";
      case "error":
        return "border-red-200 bg-red-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      case "pending":
        return "border-blue-200 bg-blue-50";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔍 Detailed Chat Connection Debugger</CardTitle>
        <CardDescription>
          Step-by-step debugging to find why chat room and allowlist are not found
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <Label>Your Wallet (Connected)</Label>
            <Input value={account?.address || "Not connected"} disabled />
          </div>

          <div>
            <Label>Other User's Wallet Address</Label>
            <Input
              placeholder="0x..."
              value={otherWallet}
              onChange={(e) => setOtherWallet(e.target.value)}
            />
          </div>

          <Button onClick={debugChatConnection} disabled={loading || !account || !otherWallet} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Debugging...
              </>
            ) : (
              "🔍 Start Debug"
            )}
          </Button>
        </div>

        {/* Debug Steps */}
        {debugSteps.length > 0 && (
          <div className="space-y-3 mt-6">
            <h3 className="font-semibold text-lg">Debug Steps:</h3>

            {debugSteps.map((step, index) => (
              <Alert key={index} className={getStatusColor(step.status)}>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>
                  <div className="flex-1 space-y-2">
                    <div className="font-semibold">{step.step}</div>
                    <AlertDescription>{step.message}</AlertDescription>
                    {step.data && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-2 p-2 bg-black/5 rounded text-xs overflow-auto max-h-40">
                          {JSON.stringify(step.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-muted rounded-lg space-y-2 text-sm">
          <div className="font-semibold">Common Issues:</div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Profile not created - Both users must create profiles first</li>
            <li>No match exists - Create a match between the two users</li>
            <li>Match not active - Activate the match (set status = 1)</li>
            <li>Chat room not created - Create chat room from the active match</li>
            <li>Allowlist not created - Should be auto-created with chat, or create manually</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
