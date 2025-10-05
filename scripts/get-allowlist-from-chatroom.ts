/**
 * Get ChatAllowlist ID from ChatRoom ID by checking creation transaction
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

async function getAllowlistId() {
  const chatRoomId = process.argv[2];

  if (!chatRoomId) {
    console.error("Usage: npx tsx scripts/get-allowlist-from-chatroom.ts <CHAT_ROOM_ID>");
    process.exit(1);
  }

  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log(`🔍 Looking up ChatAllowlist for chat: ${chatRoomId}\n`);

  try {
    // Get chat room object
    const chatRoom = await client.getObject({
      id: chatRoomId,
      options: { showOwner: true },
    });

    if (!chatRoom.data) {
      console.error("❌ Chat room not found");
      return;
    }

    const owner = chatRoom.data.owner;
    let initialVersion: string | undefined;

    if (owner && typeof owner === "object" && "Shared" in owner) {
      initialVersion = owner.Shared.initial_shared_version.toString();
    }

    if (!initialVersion) {
      console.error("❌ Not a shared object");
      return;
    }

    // Query transactions that created this object
    const txs = await client.queryTransactionBlocks({
      filter: { ChangedObject: chatRoomId },
      options: { showEvents: true },
      order: "ascending",
      limit: 5,
    });

    // Find ChatAllowlistAutoCreated event
    for (const tx of txs.data) {
      const events = tx.events || [];
      const allowlistEvent = events.find((e: any) =>
        e.type.includes("ChatAllowlistAutoCreated")
      );

      if (allowlistEvent && allowlistEvent.parsedJson) {
        const data = allowlistEvent.parsedJson as any;

        console.log("✅ Found ChatAllowlist!\n");
        console.log(`ChatAllowlist ID: ${data.allowlist_id}`);
        console.log(`\n📋 Details:`);
        console.log(`  Chat ID: ${data.chat_id}`);
        console.log(`  Participant A: ${data.participant_a}`);
        console.log(`  Participant B: ${data.participant_b}`);
        console.log(`  Created: ${new Date(parseInt(data.timestamp)).toISOString()}`);
        console.log(`\n🔗 Transaction: https://suiscan.xyz/testnet/tx/${tx.digest}\n`);
        return;
      }
    }

    console.log("❌ No ChatAllowlistAutoCreated event found");
    console.log("This chat may not have been created with auto-allowlist feature.\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

getAllowlistId().catch(console.error);
