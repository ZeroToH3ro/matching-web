/**
 * Complete debug script to check why chat is not working
 * Usage: npx tsx scripts/debug-chat-connection.ts <MY_WALLET> <OTHER_WALLET>
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";
const PROFILE_REGISTRY_ID = "0x20e5393af9af450275b4adff795b34c82e9cf21d7e0130d067b9f9c90a930c02";

async function debugChatConnection(myWallet: string, otherWallet: string) {
  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log("🔍 DEBUGGING CHAT CONNECTION");
  console.log("═".repeat(80));
  console.log("My Wallet:", myWallet);
  console.log("Other Wallet:", otherWallet);
  console.log("═".repeat(80));

  let hasError = false;

  // Step 1: Check my profile
  console.log("\n📝 STEP 1: Checking Your Profile");
  console.log("─".repeat(80));

  try {
    const myProfileObjects = await client.getOwnedObjects({
      owner: myWallet,
      filter: {
        StructType: `${PACKAGE_ID}::core::UserProfile`,
      },
      options: {
        showContent: true,
      },
    });

    if (myProfileObjects.data.length === 0) {
      console.log("❌ ERROR: You don't have a profile!");
      console.log("   → Create a profile in /test-contract first");
      hasError = true;
    } else {
      const myProfileId = myProfileObjects.data[0].data?.objectId;
      const profileContent = myProfileObjects.data[0].data?.content as any;
      const fields = profileContent?.fields;

      console.log("✅ Your profile found:");
      console.log("   Profile ID:", myProfileId);
      console.log("   Name:", fields?.display_name);
      console.log("   Age:", fields?.age);
      console.log("   Match Count:", fields?.match_count || 0);
    }
  } catch (err) {
    console.log("❌ ERROR checking your profile:", (err as Error).message);
    hasError = true;
  }

  // Step 2: Check other user's profile
  console.log("\n📝 STEP 2: Checking Other User's Profile");
  console.log("─".repeat(80));

  try {
    const otherProfileObjects = await client.getOwnedObjects({
      owner: otherWallet,
      filter: {
        StructType: `${PACKAGE_ID}::core::UserProfile`,
      },
      options: {
        showContent: true,
      },
    });

    if (otherProfileObjects.data.length === 0) {
      console.log("❌ ERROR: Other user doesn't have a profile!");
      console.log("   → They need to create a profile first");
      hasError = true;
    } else {
      const otherProfileId = otherProfileObjects.data[0].data?.objectId;
      const profileContent = otherProfileObjects.data[0].data?.content as any;
      const fields = profileContent?.fields;

      console.log("✅ Other user's profile found:");
      console.log("   Profile ID:", otherProfileId);
      console.log("   Name:", fields?.display_name);
      console.log("   Age:", fields?.age);
    }
  } catch (err) {
    console.log("❌ ERROR checking other user's profile:", (err as Error).message);
    hasError = true;
  }

  // Step 3: Check matches
  console.log("\n🤝 STEP 3: Checking Matches");
  console.log("─".repeat(80));

  try {
    const myMatches = await client.getOwnedObjects({
      owner: myWallet,
      filter: {
        StructType: `${PACKAGE_ID}::core::Match`,
      },
      options: {
        showContent: true,
      },
    });

    console.log(`Found ${myMatches.data.length} match(es) owned by you`);

    let foundMatch = false;
    let matchId: string | null = null;
    let matchStatus: number | null = null;

    for (const matchObj of myMatches.data) {
      if (matchObj.data?.content && matchObj.data.content.dataType === "moveObject") {
        const fields = matchObj.data.content.fields as any;
        const userA = fields.user_a;
        const userB = fields.user_b;
        const status = fields.status;

        console.log(`\n  Match ID: ${matchObj.data.objectId}`);
        console.log(`    User A: ${userA}`);
        console.log(`    User B: ${userB}`);
        console.log(`    Status: ${status} ${status === 1 ? "(ACTIVE ✅)" : "(NOT ACTIVE ❌)"}`);
        console.log(`    Score: ${fields.compatibility_score}`);

        const involvesOtherUser =
          (userA === myWallet && userB === otherWallet) ||
          (userA === otherWallet && userB === myWallet);

        if (involvesOtherUser) {
          foundMatch = true;
          matchId = matchObj.data.objectId;
          matchStatus = status;
          console.log("    ⭐ THIS IS YOUR MATCH!");
        }
      }
    }

    if (!foundMatch) {
      console.log("\n❌ ERROR: No match found between you and the other user!");
      console.log("   → Create a match in /test-contract first");
      hasError = true;
    } else if (matchStatus !== 1) {
      console.log("\n⚠️  WARNING: Match is not active!");
      console.log("   → Activate the match (set status = 1) before creating chat");
      hasError = true;
    } else {
      console.log("\n✅ Active match found! Match ID:", matchId);

      // Step 4: Check chat room
      console.log("\n💬 STEP 4: Checking Chat Room");
      console.log("─".repeat(80));

      // Search for chat in events
      const chatEvents = await client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::chat::ChatCreated`,
        },
        limit: 50,
        order: "descending",
      });

      let foundChat = false;
      let chatRoomId: string | null = null;

      for (const event of chatEvents.data) {
        const parsedJson = event.parsedJson as any;

        if (parsedJson.match_id === matchId) {
          foundChat = true;
          chatRoomId = parsedJson.chat_id;

          console.log("✅ Chat room found!");
          console.log("   Chat Room ID:", chatRoomId);
          console.log("   Participant A:", parsedJson.participant_a);
          console.log("   Participant B:", parsedJson.participant_b);
          console.log("   Seal Policy:", parsedJson.seal_policy_id);

          // Step 5: Check allowlist
          console.log("\n🔐 STEP 5: Checking Chat Allowlist");
          console.log("─".repeat(80));

          const allowlistEvents = await client.queryEvents({
            query: {
              Transaction: event.id.txDigest,
            },
          });

          let foundAllowlist = false;

          for (const allowlistEvent of allowlistEvents.data) {
            if (allowlistEvent.type.includes("AllowlistCreated")) {
              const allowlistJson = allowlistEvent.parsedJson as any;
              console.log("✅ Chat allowlist found!");
              console.log("   Allowlist ID:", allowlistJson.allowlist_id);
              foundAllowlist = true;
            }
          }

          if (!foundAllowlist) {
            console.log("⚠️  WARNING: Chat allowlist not found in events!");
            console.log("   → You may need to create it manually");
            hasError = true;
          }

          // Check message count
          try {
            const chatObj = await client.getObject({
              id: chatRoomId,
              options: {
                showContent: true,
              },
            });

            if (chatObj.data?.content && chatObj.data.content.dataType === "moveObject") {
              const fields = chatObj.data.content.fields as any;
              console.log("\n📊 Chat Room Stats:");
              console.log("   Total Messages:", fields.total_messages || "0");
              console.log("   Last Message:", new Date(parseInt(fields.last_message_at)).toLocaleString());
              console.log("   Status:", fields.status === 0 ? "Active" : fields.status === 1 ? "Archived" : "Other");
            }
          } catch (err) {
            console.log("⚠️  Could not fetch chat room details");
          }

          break;
        }
      }

      if (!foundChat) {
        console.log("❌ ERROR: Chat room not found!");
        console.log("   → Create a chat room from the match in /test-contract");
        console.log("   → Use 'Create Chat from Match' feature");
        hasError = true;
      }
    }
  } catch (err) {
    console.log("❌ ERROR checking matches:", (err as Error).message);
    hasError = true;
  }

  // Final summary
  console.log("\n" + "═".repeat(80));
  console.log("📋 SUMMARY");
  console.log("═".repeat(80));

  if (hasError) {
    console.log("❌ ISSUES FOUND - Follow the suggestions above to fix them");
    console.log("\n🔧 Quick Fix Steps:");
    console.log("1. Make sure both users have created profiles");
    console.log("2. Create a match between the two users");
    console.log("3. Activate the match (set status = 1)");
    console.log("4. Create a chat room from the active match");
    console.log("5. Verify the chat allowlist was created");
  } else {
    console.log("✅ ALL CHECKS PASSED - You should be able to send messages!");
  }

  console.log("\n🔗 Useful Commands:");
  console.log(`  List your chats: npx tsx scripts/list-user-chats.ts ${myWallet}`);
  console.log(`  Find chat by match: npx tsx scripts/find-chatroom-from-match.ts <MATCH_ID>`);
}

// Main execution
const myWallet = process.argv[2];
const otherWallet = process.argv[3];

if (!myWallet || !otherWallet) {
  console.log("Usage: npx tsx scripts/debug-chat-connection.ts <MY_WALLET> <OTHER_WALLET>");
  console.log("Example: npx tsx scripts/debug-chat-connection.ts 0x1234... 0x5678...");
  process.exit(1);
}

debugChatConnection(myWallet, otherWallet);
