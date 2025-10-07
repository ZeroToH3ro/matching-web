/**
 * Script to get shared object IDs after contract deployment
 * Run with: npx tsx scripts/get-shared-objects.ts
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = "0x607d7c005ad9e67f5b826893fd1937e78d3ba79e634cc82b6d8701287a8e14a6";

async function getSharedObjects() {
  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log("🔍 Searching for shared objects...\n");
  console.log(`Package ID: ${PACKAGE_ID}\n`);

  const objectTypes = [
    { name: "ProfileRegistry", type: `${PACKAGE_ID}::core::ProfileRegistry` },
    { name: "MatchRegistry", type: `${PACKAGE_ID}::core::MatchRegistry` },
    { name: "ChatRegistry", type: `${PACKAGE_ID}::chat::ChatRegistry` },
    { name: "MessageIndex", type: `${PACKAGE_ID}::chat::MessageIndex` },
    { name: "UsageTracker", type: `${PACKAGE_ID}::integration::UsageTracker` },
    { name: "MatchChatRegistry", type: `${PACKAGE_ID}::integration::MatchChatRegistry` },
    { name: "AllowlistRegistry", type: `${PACKAGE_ID}::seal_policies::AllowlistRegistry` },
  ];

  const results: Record<string, string | null> = {};

  for (const objType of objectTypes) {
    try {
      // Query all objects of this type
      // Note: This only works for objects you own. For shared objects, we need to check the deploy transaction
      console.log(`Searching for ${objType.name}...`);

      // For shared objects, we can't directly query them
      // They should be in the deploy transaction
      results[objType.name] = null;

    } catch (error) {
      console.error(`Error querying ${objType.name}:`, error);
      results[objType.name] = null;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("⚠️  Note: Shared objects need to be found from deploy transaction");
  console.log("=".repeat(80) + "\n");

  console.log("To find shared object IDs:");
  console.log("1. Get your deploy transaction digest");
  console.log("2. Run: sui client transaction-block <DEPLOY_TX_DIGEST>");
  console.log("3. Or check Sui Explorer:\n");
  console.log(`   https://suiscan.xyz/testnet/object/${PACKAGE_ID}\n`);

  console.log("\nExample CLI commands to find each object:\n");

  for (const objType of objectTypes) {
    console.log(`# Find ${objType.name}`);
    console.log(`sui client objects --filter "MoveModule==${objType.type}"`);
    console.log("");
  }

  console.log("\n" + "=".repeat(80));
  console.log("Alternative: Use Sui GraphQL");
  console.log("=".repeat(80) + "\n");

  const graphqlQuery = `
query GetSharedObjects {
  objects(
    filter: {
      type: "${PACKAGE_ID}::core::ProfileRegistry"
    }
  ) {
    nodes {
      address
      owner {
        __typename
        ... on Shared {
          initialSharedVersion
        }
      }
    }
  }
}`;

  console.log("GraphQL Query Example:");
  console.log(graphqlQuery);
  console.log("\nRun at: https://sui-testnet.mystenlabs.com/graphql\n");

  // Try to fetch from a known deploy transaction if provided
  const deployTxDigest = process.argv[2];

  if (deployTxDigest) {
    console.log("\n" + "=".repeat(80));
    console.log(`Fetching from deploy transaction: ${deployTxDigest}`);
    console.log("=".repeat(80) + "\n");

    try {
      const txBlock = await client.getTransactionBlock({
        digest: deployTxDigest,
        options: {
          showObjectChanges: true,
          showEffects: true,
        },
      });

      console.log("📦 Created Objects:\n");

      if (txBlock.objectChanges) {
        const sharedObjects = txBlock.objectChanges.filter(
          (change) =>
            change.type === "created" &&
            "owner" in change &&
            change.owner &&
            typeof change.owner === "object" &&
            "Shared" in change.owner
        );

        sharedObjects.forEach((change) => {
          if (change.type === "created" && "objectType" in change) {
            const typeName = change.objectType.split("::").pop();
            console.log(`✅ ${typeName}`);
            console.log(`   ID: ${change.objectId}`);
            console.log("");
          }
        });

        console.log("\n📝 Copy these IDs to your test page:\n");
        console.log("```typescript");
        console.log("// Update in src/app/test-contract/page.tsx\n");

        sharedObjects.forEach((change) => {
          if (change.type === "created" && "objectType" in change) {
            const fullType = change.objectType;
            const typeName = fullType.split("::").pop();

            if (typeName === "UsageTracker") {
              console.log(`const USAGE_TRACKER_ID = "${change.objectId}";`);
            } else if (typeName === "MatchChatRegistry") {
              console.log(`const MATCH_CHAT_REGISTRY_ID = "${change.objectId}";`);
            } else if (typeName === "ChatRegistry") {
              console.log(`const CHAT_REGISTRY_ID = "${change.objectId}";`);
            } else if (typeName === "MessageIndex") {
              console.log(`const MESSAGE_INDEX_ID = "${change.objectId}";`);
            } else if (typeName === "AllowlistRegistry") {
              console.log(`const ALLOWLIST_REGISTRY_ID = "${change.objectId}";`);
            } else if (typeName === "ProfileRegistry") {
              console.log(`const PROFILE_REGISTRY_ID = "${change.objectId}";`);
            } else if (typeName === "MatchRegistry") {
              console.log(`const MATCH_REGISTRY_ID = "${change.objectId}";`);
            }
          }
        });

        console.log("```\n");

      } else {
        console.log("No object changes found in transaction");
      }

    } catch (error: any) {
      console.error("Error fetching transaction:", error.message);
    }
  } else {
    console.log("💡 Tip: Run with deploy transaction digest:");
    console.log("   npx tsx scripts/get-shared-objects.ts <DEPLOY_TX_DIGEST>\n");
  }
}

// Run the script
getSharedObjects().catch(console.error);
