/**
 * Find chat room by querying ChatCreated events
 * This works even if MatchChatRegistry wasn't updated
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";

async function findChatByEvents(matchId: string) {
  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log("🔍 Searching for chat room via events...");
  console.log("Match ID:", matchId);
  console.log("─".repeat(80));

  try {
    // Query ChatCreated events
    const events = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::chat::ChatCreated`,
      },
      limit: 100,
      order: "descending",
    });

    console.log(`Found ${events.data.length} ChatCreated events\n`);

    for (const event of events.data) {
      const parsedJson = event.parsedJson as any;

      if (parsedJson.match_id === matchId) {
        console.log("✅ FOUND Chat Room!");
        console.log("═".repeat(80));
        console.log("Chat Room ID:", parsedJson.chat_id);
        console.log("Participant A:", parsedJson.participant_a);
        console.log("Participant B:", parsedJson.participant_b);
        console.log("Seal Policy ID:", parsedJson.seal_policy_id);
        console.log("Match ID:", parsedJson.match_id);
        console.log("Transaction:", event.id.txDigest);
        console.log("═".repeat(80));

        // Look for ChatAllowlist in same transaction
        console.log("\n🔍 Looking for ChatAllowlist...");

        const txEvents = await client.queryEvents({
          query: {
            Transaction: event.id.txDigest,
          },
        });

        let foundAllowlist = false;
        for (const txEvent of txEvents.data) {
          if (txEvent.type.includes("AllowlistCreated") ||
              txEvent.type.includes("ChatAllowlistAutoCreated")) {
            const allowlistJson = txEvent.parsedJson as any;
            console.log("✅ ChatAllowlist ID:", allowlistJson.allowlist_id);
            foundAllowlist = true;
          }
        }

        if (!foundAllowlist) {
          console.log("⚠️  ChatAllowlist not found in events");
          console.log("   Checking if chat room is shared object...");

          // Try to get chat room object
          try {
            const chatObj = await client.getObject({
              id: parsedJson.chat_id,
              options: {
                showContent: true,
                showOwner: true,
              },
            });

            console.log("\nChat Room Object:");
            console.log("  Owner:", chatObj.data?.owner);

            if (chatObj.data?.content && chatObj.data.content.dataType === "moveObject") {
              const fields = chatObj.data.content.fields as any;
              console.log("  Seal Policy:", fields.seal_policy_id);
              console.log("  Total Messages:", fields.total_messages || 0);
            }
          } catch (err) {
            console.log("  Could not fetch chat room object");
          }
        }

        console.log("\n💡 You can use these IDs:");
        console.log(`  Chat Room ID: ${parsedJson.chat_id}`);
        console.log(`  To send messages, you may need to create ChatAllowlist manually`);

        return parsedJson.chat_id;
      }
    }

    console.log("❌ No chat room found for this match");
    console.log("\n💡 Suggestions:");
    console.log("1. The chat might have been created more than 100 events ago");
    console.log("2. Try increasing limit or search by transaction digest");
    console.log("3. Create a new chat room for this match");

    return null;
  } catch (error) {
    console.error("Error:", (error as Error).message);
    return null;
  }
}

// Main
const matchId = process.argv[2];

if (!matchId) {
  console.log("Usage: npx tsx scripts/find-chat-by-events.ts <MATCH_ID>");
  process.exit(1);
}

findChatByEvents(matchId);
