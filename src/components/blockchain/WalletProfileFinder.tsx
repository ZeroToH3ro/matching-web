"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import {
  getProfileIdByAddress,
  getProfileInfo,
  getMatchIdBetweenUsers,
  getChatRoomIdByMatchId,
  getChatAllowlistIdByChatRoomId,
  findChatInfoBetweenUsers,
  getMessagingIds,
  type ProfileInfo,
  type MatchInfo,
  type ChatRoomInfo,
} from "@/lib/blockchain/contractQueries";

export default function WalletProfileFinder() {
  const account = useCurrentAccount();
  const client = useSuiClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input state
  const [otherWalletAddress, setOtherWalletAddress] = useState("");

  // Result state
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [myProfileInfo, setMyProfileInfo] = useState<ProfileInfo | null>(null);
  const [otherProfileId, setOtherProfileId] = useState<string | null>(null);
  const [otherProfileInfo, setOtherProfileInfo] = useState<ProfileInfo | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [chatRoomInfo, setChatRoomInfo] = useState<ChatRoomInfo | null>(null);
  const [chatAllowlistId, setChatAllowlistId] = useState<string | null>(null);

  /**
   * Step 1: Find my profile ID
   */
  const findMyProfile = async () => {
    if (!account) {
      setError("Please connect wallet first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profileId = await getProfileIdByAddress(client, account.address);

      if (!profileId) {
        setError("Profile not found. Please create a profile first.");
        return;
      }

      setMyProfileId(profileId);

      // Get full profile info
      const profileInfo = await getProfileInfo(client, profileId);
      setMyProfileInfo(profileInfo);

      console.log("✅ My Profile ID:", profileId);
      console.log("✅ My Profile Info:", profileInfo);
    } catch (err: any) {
      setError(err.message);
      console.error("Error finding profile:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 2: Find complete chat info between me and another user
   */
  const findCompleteInfo = async () => {
    if (!account) {
      setError("Please connect wallet first");
      return;
    }

    if (!otherWalletAddress) {
      setError("Please enter the other user's wallet address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const info = await findChatInfoBetweenUsers(client, account.address, otherWalletAddress);

      if (!info) {
        setError("Failed to fetch chat information");
        return;
      }

      // Set all the IDs
      setMyProfileId(info.myProfileId);
      setOtherProfileId(info.otherProfileId);
      setMatchId(info.matchId);
      setChatRoomId(info.chatRoomId);
      setChatAllowlistId(info.chatAllowlistId);

      // Set detailed info
      if (info.matchInfo) {
        setMatchInfo(info.matchInfo);
      }
      if (info.chatRoomInfo) {
        setChatRoomInfo(info.chatRoomInfo);
      }

      // Get profile info
      if (info.myProfileId) {
        const myInfo = await getProfileInfo(client, info.myProfileId);
        setMyProfileInfo(myInfo);
      }
      if (info.otherProfileId) {
        const otherInfo = await getProfileInfo(client, info.otherProfileId);
        setOtherProfileInfo(otherInfo);
      }

      console.log("✅ Complete Chat Info:", info);
    } catch (err: any) {
      setError(err.message);
      console.error("Error finding chat info:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get just the IDs needed for messaging
   */
  const getMessagingIdsOnly = async () => {
    if (!account) {
      setError("Please connect wallet first");
      return;
    }

    if (!otherWalletAddress) {
      setError("Please enter the other user's wallet address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ids = await getMessagingIds(client, account.address, otherWalletAddress);

      if (!ids) {
        setError("Could not find messaging IDs. Make sure you have a match and chat with this user.");
        return;
      }

      setMyProfileId(ids.profileId);
      setChatRoomId(ids.chatRoomId);
      setChatAllowlistId(ids.chatAllowlistId);

      console.log("✅ Messaging IDs:", ids);
      alert(
        `Messaging IDs found!\n\nProfile ID: ${ids.profileId}\nChat Room ID: ${ids.chatRoomId}\nChat Allowlist ID: ${ids.chatAllowlistId}`
      );
    } catch (err: any) {
      setError(err.message);
      console.error("Error getting messaging IDs:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-6">
      {/* My Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Find My Profile</CardTitle>
          <CardDescription>Find your profile ID from your connected wallet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Connected Wallet</Label>
            <Input value={account?.address || "Not connected"} disabled />
          </div>

          <Button onClick={findMyProfile} disabled={loading || !account} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding Profile...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Find My Profile ID
              </>
            )}
          </Button>

          {myProfileId && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="space-y-2">
                  <div>
                    <strong>Profile ID:</strong>
                    <div
                      className="font-mono text-sm break-all cursor-pointer hover:bg-green-100 p-1 rounded"
                      onClick={() => copyToClipboard(myProfileId, "Profile ID")}
                    >
                      {myProfileId}
                    </div>
                  </div>

                  {myProfileInfo && (
                    <div className="pt-2 border-t border-green-200">
                      <div>
                        <strong>Name:</strong> {myProfileInfo.displayName}
                      </div>
                      <div>
                        <strong>Age:</strong> {myProfileInfo.age}
                      </div>
                      <div>
                        <strong>Matches:</strong> {myProfileInfo.matchCount}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Find Chat Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Find Chat Info with Another User</CardTitle>
          <CardDescription>
            Enter the other user's wallet address to find match, chat room, and allowlist IDs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Other User's Wallet Address</Label>
            <Input
              placeholder="0x..."
              value={otherWalletAddress}
              onChange={(e) => setOtherWalletAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={findCompleteInfo} disabled={loading || !account || !otherWalletAddress}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Find All Info"
              )}
            </Button>

            <Button
              variant="outline"
              onClick={getMessagingIdsOnly}
              disabled={loading || !account || !otherWalletAddress}
            >
              Get Messaging IDs Only
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {(matchId || chatRoomId || chatAllowlistId) && (
            <div className="space-y-4 pt-4 border-t">
              {otherProfileId && otherProfileInfo && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800">
                    <div>
                      <strong>Other User's Profile:</strong>
                    </div>
                    <div className="font-mono text-sm break-all">{otherProfileId}</div>
                    <div className="pt-2">
                      <strong>Name:</strong> {otherProfileInfo.displayName}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {matchId && (
                <Alert className="bg-purple-50 border-purple-200">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-800">
                    <div>
                      <strong>Match ID:</strong>
                    </div>
                    <div
                      className="font-mono text-sm break-all cursor-pointer hover:bg-purple-100 p-1 rounded"
                      onClick={() => copyToClipboard(matchId, "Match ID")}
                    >
                      {matchId}
                    </div>
                    {matchInfo && (
                      <div className="pt-2 text-sm">
                        <div>Status: {matchInfo.status === 0 ? "Pending" : matchInfo.status === 1 ? "Active" : "Other"}</div>
                        <div>Compatibility: {matchInfo.compatibilityScore}%</div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {chatRoomId && (
                <Alert className="bg-indigo-50 border-indigo-200">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                  <AlertDescription className="text-indigo-800">
                    <div>
                      <strong>Chat Room ID:</strong>
                    </div>
                    <div
                      className="font-mono text-sm break-all cursor-pointer hover:bg-indigo-100 p-1 rounded"
                      onClick={() => copyToClipboard(chatRoomId, "Chat Room ID")}
                    >
                      {chatRoomId}
                    </div>
                    {chatRoomInfo && (
                      <div className="pt-2 text-sm">
                        <div>Total Messages: {chatRoomInfo.totalMessages}</div>
                        <div>Seal Policy: {chatRoomInfo.sealPolicyId}</div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {chatAllowlistId && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <div>
                      <strong>Chat Allowlist ID:</strong>
                    </div>
                    <div
                      className="font-mono text-sm break-all cursor-pointer hover:bg-green-100 p-1 rounded"
                      onClick={() => copyToClipboard(chatAllowlistId, "Chat Allowlist ID")}
                    >
                      {chatAllowlistId}
                    </div>
                    <div className="pt-2 text-xs text-green-700">
                      ⚠️ This ID is required for sending and decrypting messages
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Example */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm">Usage Example</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
            {`// Import the utility functions
import {
  findChatInfoBetweenUsers,
  getMessagingIds
} from "@/lib/blockchain/contractQueries";

// Get all info
const info = await findChatInfoBetweenUsers(
  client,
  myAddress,
  otherAddress
);

// Or just get messaging IDs
const {
  profileId,
  chatRoomId,
  chatAllowlistId
} = await getMessagingIds(
  client,
  myAddress,
  otherAddress
);

// Use these IDs to send messages
await sendMessage(chatRoomId, chatAllowlistId, "Hello!");`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
