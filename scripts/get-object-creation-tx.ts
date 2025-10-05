/**
 * Get object creation transaction
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

async function getCreationTx() {
  const objectId = process.argv[2];

  if (!objectId) {
    console.error("Usage: npx tsx scripts/get-object-creation-tx.ts <OBJECT_ID>");
    process.exit(1);
  }

  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  try {
    // Get object at earliest version to find creation tx
    const obj = await client.getObject({
      id: objectId,
      options: {
        showPreviousTransaction: true,
        showOwner: true,
      },
    });

    if (!obj.data) {
      console.error("Object not found");
      return;
    }

    const owner = obj.data.owner;
    let initialVersion: string | undefined;

    if (owner && typeof owner === "object" && "Shared" in owner) {
      initialVersion = owner.Shared.initial_shared_version.toString();
      console.log(`\n🔍 Shared Object - Initial Version: ${initialVersion}`);
    }

    // Query object changes for this object at initial version
    if (initialVersion) {
      const txs = await client.queryTransactionBlocks({
        filter: {
          ChangedObject: objectId
        },
        options: {
          showEvents: true,
          showObjectChanges: true,
        },
        order: "ascending",
        limit: 1,
      });

      if (txs.data.length > 0) {
        const txDigest = txs.data[0].digest;
        console.log(`\n✅ Creation Transaction: ${txDigest}`);
        console.log(`\nView on explorer:`);
        console.log(`https://suiscan.xyz/testnet/tx/${txDigest}\n`);

        // Check for ChatAllowlist events
        const events = txs.data[0].events || [];
        const allowlistEvent = events.find((e: any) =>
          e.type.includes("ChatAllowlistAutoCreated")
        );

        if (allowlistEvent) {
          console.log("✅ Found ChatAllowlistAutoCreated event!");
          console.log("Event data:", JSON.stringify(allowlistEvent.parsedJson, null, 2));
        } else {
          console.log("❌ No ChatAllowlistAutoCreated event found");
          console.log("All events:", events.map((e: any) => e.type));
        }

        return txDigest;
      }
    }

    // Fallback to current previousTransaction
    const txDigest = obj.data.previousTransaction;
    console.log(`\n⚠️  Using current transaction: ${txDigest}`);
    console.log(`\nView on explorer:`);
    console.log(`https://suiscan.xyz/testnet/tx/${txDigest}\n`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

getCreationTx().catch(console.error);
