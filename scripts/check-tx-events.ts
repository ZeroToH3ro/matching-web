/**
 * Check transaction events
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

async function checkTxEvents() {
  const txDigest = process.argv[2];

  if (!txDigest) {
    console.error("Usage: npx tsx scripts/check-tx-events.ts <TX_DIGEST>");
    process.exit(1);
  }

  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  try {
    const tx = await client.getTransactionBlock({
      digest: txDigest,
      options: {
        showEvents: true,
        showObjectChanges: true,
        showInput: true,
      },
    });

    console.log(`\n📝 Transaction: ${txDigest}\n`);

    if (tx.events && tx.events.length > 0) {
      console.log("✅ Events emitted:");
      tx.events.forEach((event: any, i: number) => {
        console.log(`\n  ${i + 1}. ${event.type}`);
        if (event.parsedJson) {
          console.log("     Data:", JSON.stringify(event.parsedJson, null, 2));
        }
      });
    } else {
      console.log("❌ No events emitted");
    }

    if (tx.objectChanges && tx.objectChanges.length > 0) {
      console.log("\n📦 Object Changes:");
      const created = tx.objectChanges.filter((c: any) => c.type === "created");
      created.forEach((obj: any) => {
        console.log(`  - Created: ${obj.objectType?.split("::").pop() || "Unknown"}`);
        console.log(`    ID: ${obj.objectId}`);
      });
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

checkTxEvents().catch(console.error);
