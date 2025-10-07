/**
 * Script to get ChatAllowlist ID for a specific chat
 * Run with: npx tsx scripts/get-chat-allowlist.ts <CHAT_ID>
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";
const ALLOWLIST_REGISTRY_ID = "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";

async function getChatAllowlistId() {
  const chatId = process.argv[2];

  if (!chatId) {
    console.error("Usage: npx tsx scripts/get-chat-allowlist.ts <CHAT_ID>");
    process.exit(1);
  }

  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log(`🔍 Looking up ChatAllowlist for chat: ${chatId}\n`);

  try {
    // Get registry object to find table ID
    const registry = await client.getObject({
      id: ALLOWLIST_REGISTRY_ID,
      options: { showContent: true },
    });

    if (!registry.data?.content || registry.data.content.dataType !== "moveObject") {
      console.error("❌ Invalid registry object");
      return;
    }

    const fields = registry.data.content.fields as any;
    const chatAllowlistsTableId = fields.chat_allowlists.fields.id.id;

    // Query dynamic field from table
    const dynamicField = await client.getDynamicFieldObject({
      parentId: chatAllowlistsTableId,
      name: {
        type: "0x2::object::ID",
        value: chatId,
      },
    });

    if (dynamicField.data?.content && "fields" in dynamicField.data.content) {
      const allowlistId = (dynamicField.data.content.fields as any).value;

      console.log("✅ Found ChatAllowlist!");
      console.log(`\nChatAllowlist ID: ${allowlistId}\n`);

      // Verify it exists and get details
      const allowlistObj = await client.getObject({
        id: allowlistId,
        options: { showContent: true },
      });

      if (allowlistObj.data?.content && "fields" in allowlistObj.data.content) {
        const fields = allowlistObj.data.content.fields as any;
        console.log("📋 ChatAllowlist Details:");
        console.log(`  Chat ID: ${fields.chat_id}`);
        console.log(`  Participant A: ${fields.participant_a}`);
        console.log(`  Participant B: ${fields.participant_b}`);
        console.log(`  Active: ${fields.active}`);
        console.log(`  Expires At: ${fields.expires_at || "Never"}\n`);
      }
    }
  } catch (error: any) {
    if (error.message?.includes("not found") || error.code === -32000) {
      console.log("❌ No ChatAllowlist found for this chat");
      console.log("This chat may not have been created with auto-allowlist feature.\n");
    } else {
      console.error("❌ Error:", error.message);
    }
  }
}

getChatAllowlistId().catch(console.error);
