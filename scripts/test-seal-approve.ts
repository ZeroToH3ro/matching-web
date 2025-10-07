import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";

const PACKAGE_ID = "0xa6a1d7a5a1cd3f02be68e470d8ddb7ac879e058b8545925021a8fe4c1c0d59e3";

async function testSealApprove() {
  const walletAddress = process.argv[2];
  const chatAllowlistId = process.argv[3];
  const encryptedId = process.argv[4];

  if (!walletAddress || !chatAllowlistId || !encryptedId) {
    console.error("Usage: npx tsx scripts/test-seal-approve.ts <WALLET_ADDRESS> <CHAT_ALLOWLIST_ID> <ENCRYPTED_ID>");
    console.error("\nExample:");
    console.error("  npx tsx scripts/test-seal-approve.ts 0xabc... 0xdef... 0x123...");
    process.exit(1);
  }

  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log(`🔍 Testing seal_approve for wallet: ${walletAddress}\n`);
  console.log(`ChatAllowlist ID: ${chatAllowlistId}`);
  console.log(`Encrypted ID: ${encryptedId}\n`);

  try {
    // Get ChatAllowlist details
    const allowlistObj = await client.getObject({
      id: chatAllowlistId,
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

      // Check if wallet matches
      const isParticipantA = fields.participant_a.toLowerCase() === walletAddress.toLowerCase();
      const isParticipantB = fields.participant_b.toLowerCase() === walletAddress.toLowerCase();

      console.log("✅ Wallet Verification:");
      console.log(`  Is Participant A: ${isParticipantA ? "YES ✓" : "NO ✗"}`);
      console.log(`  Is Participant B: ${isParticipantB ? "YES ✓" : "NO ✗"}`);

      if (!isParticipantA && !isParticipantB) {
        console.log("\n❌ ERROR: Wallet address does NOT match any participant!");
        console.log("This wallet cannot decrypt messages in this chat.\n");
        return;
      }

      if (!fields.active) {
        console.log("\n❌ ERROR: ChatAllowlist is NOT active!");
        return;
      }

      console.log("\n✅ Wallet is authorized!\n");

      // Test building seal_approve transaction
      const tx = new Transaction();

      // Parse encrypted ID
      const encryptedIdBytes = fromHex(encryptedId.startsWith("0x") ? encryptedId.slice(2) : encryptedId);

      tx.moveCall({
        target: `${PACKAGE_ID}::seal_policies::seal_approve`,
        arguments: [
          tx.pure.vector("u8", encryptedIdBytes),
          tx.object(chatAllowlistId),
          tx.object("0x6"), // Clock
        ],
      });

      console.log("🔧 Testing seal_approve transaction (dry run)...\n");

      const result = await client.devInspectTransactionBlock({
        sender: walletAddress,
        transactionBlock: tx,
      });

      if (result.effects.status.status === "success") {
        console.log("✅ seal_approve would succeed!");
        console.log("\nThe transaction is valid and should work.\n");

        if (result.events && result.events.length > 0) {
          console.log("📝 Events that would be emitted:");
          result.events.forEach((event: any) => {
            console.log(`  - ${event.type}`);
          });
        }
      } else {
        console.log("❌ seal_approve would FAIL!");
        console.log("\nError:", result.effects.status.error);
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

testSealApprove().catch(console.error);
