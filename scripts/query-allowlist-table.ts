/**
 * Query AllowlistRegistry table directly
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const ALLOWLIST_REGISTRY_ID = "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";

async function queryTable() {
  const chatId = process.argv[2];

  if (!chatId) {
    console.error("Usage: npx tsx scripts/query-allowlist-table.ts <CHAT_ID>");
    process.exit(1);
  }

  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log(`🔍 Querying AllowlistRegistry for chat: ${chatId}\n`);

  try {
    // Get registry object
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
    const tableSize = fields.chat_allowlists.fields.size;

    console.log(`📊 Registry Stats:`);
    console.log(`  Total Allowlists: ${fields.total_allowlists}`);
    console.log(`  Chat Allowlists Table Size: ${tableSize}`);
    console.log(`  Chat Allowlists Table ID: ${chatAllowlistsTableId}\n`);

    if (tableSize === "0" || tableSize === 0) {
      console.log("❌ No chat allowlists in registry yet.\n");
      return;
    }

    // Try to get dynamic field for this chat ID
    try {
      const dynamicField = await client.getDynamicFieldObject({
        parentId: chatAllowlistsTableId,
        name: {
          type: "0x2::object::ID",
          value: chatId,
        },
      });

      if (dynamicField.data?.content && "fields" in dynamicField.data.content) {
        const allowlistId = (dynamicField.data.content.fields as any).value;
        console.log(`✅ Found ChatAllowlist!\n`);
        console.log(`ChatAllowlist ID: ${allowlistId}\n`);

        // Get allowlist details
        const allowlist = await client.getObject({
          id: allowlistId,
          options: { showContent: true },
        });

        if (allowlist.data?.content && "fields" in allowlist.data.content) {
          const alFields = allowlist.data.content.fields as any;
          console.log(`📋 Details:`);
          console.log(`  Chat ID: ${alFields.chat_id}`);
          console.log(`  Participant A: ${alFields.participant_a}`);
          console.log(`  Participant B: ${alFields.participant_b}`);
          console.log(`  Active: ${alFields.active}`);
          console.log(`  Expires At: ${alFields.expires_at || "Never"}\n`);
        }
      } else {
        console.log(`❌ No ChatAllowlist found for chat: ${chatId}`);
        console.log(`This chat may not have been created with auto-allowlist feature.\n`);
      }
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        console.log(`❌ No ChatAllowlist found for chat: ${chatId}`);
        console.log(`This chat may not have been created with auto-allowlist feature.\n`);
      } else {
        throw error;
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

queryTable().catch(console.error);
