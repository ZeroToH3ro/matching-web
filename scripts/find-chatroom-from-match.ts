/**
 * Script to find ChatRoom ID from Match ID using events
 * Usage: npx tsx scripts/find-chatroom-from-match.ts <MATCH_ID>
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";

async function findChatRoomFromMatch(matchId: string) {
  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log("🔍 Searching for ChatRoom created from Match:", matchId);
  console.log("─".repeat(80));

  try {
    // Method 1: Search through ChatCreated events
    console.log("\n📡 Method 1: Querying ChatCreated events...");

    const events = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::chat::ChatCreated`,
      },
      limit: 50,
      order: "descending",
    });

    console.log(`Found ${events.data.length} ChatCreated events`);

    for (const event of events.data) {
      const parsedJson = event.parsedJson as any;

      if (parsedJson.match_id === matchId) {
        console.log("\n✅ FOUND ChatRoom!");
        console.log("─".repeat(80));
        console.log("Chat Room ID:", parsedJson.chat_id);
        console.log("Participant A:", parsedJson.participant_a);
        console.log("Participant B:", parsedJson.participant_b);
        console.log("Seal Policy ID:", parsedJson.seal_policy_id);
        console.log("Created At:", new Date(parseInt(parsedJson.timestamp)).toLocaleString());
        console.log("Transaction Digest:", event.id.txDigest);
        console.log("─".repeat(80));

        // Also try to get the ChatAllowlist
        console.log("\n🔍 Looking for ChatAllowlist...");

        const allowlistEvents = await client.queryEvents({
          query: {
            Transaction: event.id.txDigest,
          },
        });

        for (const allowlistEvent of allowlistEvents.data) {
          if (allowlistEvent.type.includes("AllowlistCreated")) {
            const allowlistJson = allowlistEvent.parsedJson as any;
            console.log("✅ ChatAllowlist ID:", allowlistJson.allowlist_id);
          }
        }

        return parsedJson.chat_id;
      }
    }

    console.log("❌ No ChatRoom found for this match in recent events");
    console.log("\n💡 Suggestions:");
    console.log("1. The chat may have been created in an older transaction (query more events)");
    console.log("2. The chat may not have been created yet");
    console.log("3. Check if the match ID is correct");

    // Method 2: Try to get the Match object to see its status
    console.log("\n📦 Checking Match object...");

    try {
      const matchObj = await client.getObject({
        id: matchId,
        options: {
          showContent: true,
        },
      });

      if (matchObj.data?.content && matchObj.data.content.dataType === "moveObject") {
        const fields = matchObj.data.content.fields as any;
        console.log("\nMatch Info:");
        console.log("  User A:", fields.user_a);
        console.log("  User B:", fields.user_b);
        console.log("  Status:", fields.status, fields.status === 1 ? "(ACTIVE ✅)" : "(NOT ACTIVE ❌)");
        console.log("  Compatibility:", fields.compatibility_score);

        if (fields.status !== 1) {
          console.log("\n⚠️  Match is not active. Activate it first before creating a chat.");
        }
      }
    } catch (err) {
      console.log("Could not fetch match object:", (err as Error).message);
    }

    return null;
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    return null;
  }
}

// Main execution
const matchId = process.argv[2];

if (!matchId) {
  console.log("Usage: npx tsx scripts/find-chatroom-from-match.ts <MATCH_ID>");
  console.log("Example: npx tsx scripts/find-chatroom-from-match.ts 0x1234...");
  process.exit(1);
}

findChatRoomFromMatch(matchId).then((chatRoomId) => {
  if (!chatRoomId) {
    console.log("\n🔗 Next Steps:");
    console.log("1. Make sure the match is active (status = 1)");
    console.log("2. Create a chat room from the match in /test-contract");
    console.log("3. Run this script again after creating the chat");
  }
});
