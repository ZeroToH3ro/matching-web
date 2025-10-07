/**
 * Script to list all chat rooms for a user
 * Usage: npx tsx scripts/list-user-chats.ts <WALLET_ADDRESS>
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";

async function listUserChats(walletAddress: string) {
  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log("🔍 Finding all chat rooms for:", walletAddress);
  console.log("─".repeat(80));

  try {
    // Query all ChatCreated events where user is participant
    console.log("\n📡 Querying ChatCreated events...\n");

    const events = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::chat::ChatCreated`,
      },
      limit: 100,
      order: "descending",
    });

    const userChats: Array<{
      chatId: string;
      participantA: string;
      participantB: string;
      matchId: string | null;
      sealPolicyId: string;
      timestamp: string;
      txDigest: string;
    }> = [];

    for (const event of events.data) {
      const parsedJson = event.parsedJson as any;

      // Check if user is participant
      if (
        parsedJson.participant_a === walletAddress ||
        parsedJson.participant_b === walletAddress
      ) {
        userChats.push({
          chatId: parsedJson.chat_id,
          participantA: parsedJson.participant_a,
          participantB: parsedJson.participant_b,
          matchId: parsedJson.match_id || null,
          sealPolicyId: parsedJson.seal_policy_id,
          timestamp: new Date(parseInt(parsedJson.timestamp)).toLocaleString(),
          txDigest: event.id.txDigest,
        });
      }
    }

    if (userChats.length === 0) {
      console.log("❌ No chat rooms found for this user");
      console.log("\n💡 Suggestions:");
      console.log("1. Make sure you have an active match with another user");
      console.log("2. Create a chat room from the match in /test-contract");
      console.log("3. Check if the wallet address is correct");
      return;
    }

    console.log(`✅ Found ${userChats.length} chat room(s)\n`);

    for (let i = 0; i < userChats.length; i++) {
      const chat = userChats[i];
      console.log(`Chat #${i + 1}`);
      console.log("─".repeat(80));
      console.log("Chat Room ID:", chat.chatId);
      console.log("Participant A:", chat.participantA);
      console.log("Participant B:", chat.participantB);

      // Determine who is the other user
      const otherUser =
        chat.participantA === walletAddress ? chat.participantB : chat.participantA;
      console.log("Other User:", otherUser);

      if (chat.matchId) {
        console.log("Match ID:", chat.matchId);
      }
      console.log("Seal Policy:", chat.sealPolicyId);
      console.log("Created:", chat.timestamp);
      console.log("Transaction:", chat.txDigest);

      // Try to find ChatAllowlist for this chat
      try {
        const allowlistEvents = await client.queryEvents({
          query: {
            Transaction: chat.txDigest,
          },
        });

        for (const allowlistEvent of allowlistEvents.data) {
          if (allowlistEvent.type.includes("AllowlistCreated")) {
            const allowlistJson = allowlistEvent.parsedJson as any;
            console.log("ChatAllowlist ID:", allowlistJson.allowlist_id);
          }
        }
      } catch (err) {
        console.log("ChatAllowlist: Not found in events");
      }

      // Get message count
      try {
        const chatObj = await client.getObject({
          id: chat.chatId,
          options: {
            showContent: true,
          },
        });

        if (chatObj.data?.content && chatObj.data.content.dataType === "moveObject") {
          const fields = chatObj.data.content.fields as any;
          console.log("Total Messages:", fields.total_messages || "0");

          // Check unread count
          const isUserA = chat.participantA === walletAddress;
          const unreadCount = isUserA
            ? fields.unread_count_a || "0"
            : fields.unread_count_b || "0";
          console.log("Unread Messages:", unreadCount);
        }
      } catch (err) {
        console.log("Message Count: Unable to fetch");
      }

      console.log("");
    }

    // Summary
    console.log("─".repeat(80));
    console.log("\n📊 Summary:");
    console.log(`Total Chats: ${userChats.length}`);
    console.log(`Participants: ${new Set([...userChats.map((c) => c.participantA), ...userChats.map((c) => c.participantB)]).size} unique users`);

    // Export IDs for easy copy
    console.log("\n📋 Quick Copy IDs:");
    userChats.forEach((chat, i) => {
      console.log(`\nChat #${i + 1}:`);
      console.log(`  Room ID: ${chat.chatId}`);
      console.log(`  Other User: ${chat.participantA === walletAddress ? chat.participantB : chat.participantA}`);
    });
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

// Main execution
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.log("Usage: npx tsx scripts/list-user-chats.ts <WALLET_ADDRESS>");
  console.log("Example: npx tsx scripts/list-user-chats.ts 0x1234...");
  process.exit(1);
}

listUserChats(walletAddress);
