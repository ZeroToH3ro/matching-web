# Seal Protocol Media Access Control Implementation

## Overview

This document explains how media access control has been implemented using Seal Protocol's MatchAllowlist for the Matching.Me dating app.

## Architecture

### Components

1. **MatchAllowlist Smart Contract** (`matching_me::seal_policies`)
   - Controls who can decrypt media based on active matches
   - Stored on Sui blockchain as shared objects
   - Linked to Match objects via registry

2. **Walrus Decentralized Storage**
   - Stores encrypted media blobs
   - Accessed via publisher/aggregator proxies (no WAL tokens needed)

3. **Seal Protocol**
   - Threshold encryption (2 servers required)
   - Namespace-based encryption IDs
   - On-chain proof verification via `seal_approve_match`

4. **MediaContent On-Chain Record**
   - References Walrus blob ID
   - Stores seal_policy_id (MatchAllowlist ID)
   - Tracks visibility level, caption, tags, etc.

## Encryption Flow

### 1. Upload Media with Match-Based Encryption

```typescript
// Step 1: Get or create MatchAllowlist for the match
const matchAllowlistId = await getOrCreateMatchAllowlist(matchId);

// Step 2: Build namespace for encryption
// Format: [TYPE_MATCH (0x03)][allowlist_id_bytes][random_nonce]
const TYPE_MATCH = 0x03;
const allowlistIdBytes = fromHex(matchAllowlistId.replace("0x", ""));
const nonce = crypto.getRandomValues(new Uint8Array(5));
const namespace = new Uint8Array([TYPE_MATCH, ...allowlistIdBytes, ...nonce]);
const encryptionId = toHex(namespace);

// Step 3: Encrypt file with Seal
const { encryptedObject } = await sealClient.encrypt({
  threshold: 2,
  packageId: PACKAGE_ID,
  id: encryptionId,
  data: fileData,
});

// Step 4: Upload encrypted data to Walrus
const response = await fetch(`/publisher1/v1/blobs?epochs=1`, {
  method: 'PUT',
  body: encryptedObject,
});
const { blobId } = await response.json();

// Step 5: Create MediaContent on-chain with seal_policy_id
tx.moveCall({
  target: `${PACKAGE_ID}::core::create_media_content`,
  arguments: [
    // ... other args
    tx.pure.option("string", matchAllowlistId), // seal_policy_id
  ],
});
```

### Key Points:
- **Namespace format** links encryption to MatchAllowlist
- Only users in the match can decrypt (enforced by Seal servers)
- No plaintext data ever leaves client or reaches Walrus

## Decryption Flow

### 2. Decrypt Media with Access Proof

```typescript
// Step 1: Get MediaContent to retrieve blob ID and seal_policy_id
const mediaObj = await client.getObject({ id: mediaId });
const { walrus_blob_id, seal_policy_id } = mediaObj.fields;

// Step 2: Verify user has access via on-chain proof
const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::seal_policies::seal_approve_match`,
  arguments: [
    tx.pure.vector("u8", []), // id_bytes - validated by Seal
    tx.object(seal_policy_id), // MatchAllowlist
    tx.object("0x6"), // Clock
  ],
});
await executeTransaction(tx); // Generates proof event

// Step 3: Download encrypted blob from Walrus
const blobResponse = await fetch(`/aggregator1/v1/blobs/${walrus_blob_id}`);
const encryptedBlob = await blobResponse.arrayBuffer();

// Step 4: Decrypt with Seal (Seal servers verify proof)
const decrypted = await sealClient.decrypt({
  encryptedObject: new Uint8Array(encryptedBlob),
});

// Step 5: Display decrypted media
const blob = new Blob([Buffer.from(decrypted)], { type: 'image/jpeg' });
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
```

### Key Points:
- **seal_approve_match** verifies caller is in the match
- Seal servers check on-chain proof before releasing decryption keys
- Access control is cryptographically enforced

## Smart Contract Integration

### MatchAllowlist Structure

```move
public struct MatchAllowlist has key, store {
    id: UID,
    match_id: ID,
    user_a: address,
    user_b: address,
    active: bool,
    created_at: u64,
    expires_at: Option<u64>,
}
```

### Create MatchAllowlist

```typescript
const matchAllowlist = tx.moveCall({
  target: `${PACKAGE_ID}::seal_policies::create_match_allowlist`,
  arguments: [
    tx.object(ALLOWLIST_REGISTRY_ID),
    tx.object(matchId),
    tx.object(profileId),
    tx.pure.option("u64", null), // expires_at
    tx.object("0x6"), // Clock
  ],
});

// Share so both users can access
tx.moveCall({
  target: "0x2::transfer::public_share_object",
  typeArguments: [`${PACKAGE_ID}::seal_policies::MatchAllowlist`],
  arguments: [matchAllowlist],
});
```

## UI Implementation

### Media Upload Form

1. **Select file and visibility level**
   - If "Matches Only" → Show Match ID input field
   - Auto-detect content type (image/video)

2. **Upload to Walrus**
   - Creates/gets MatchAllowlist if needed
   - Encrypts with namespace
   - Returns blob ID and seal_policy_id

3. **Create on-chain record**
   - Links to Profile
   - Stores seal_policy_id
   - Sets visibility level

### Media Display Grid

- Shows lock icon for sealed media
- "Check Access" button verifies match status
- "🔓 Decrypt" button (only for sealed media):
  - Generates on-chain proof
  - Downloads encrypted blob
  - Decrypts and displays

## Security Guarantees

1. **Encryption at Rest**: Media never stored unencrypted on Walrus
2. **Access Control**: Only matched users can decrypt (verified on-chain)
3. **Threshold Security**: Requires 2/3 Seal servers to decrypt
4. **Revocable Access**: Deactivating MatchAllowlist blocks decryption
5. **Audit Trail**: All access attempts recorded as events

## Testing

### Test Flow

1. Create two user profiles
2. Create a match between them
3. Upload media with Match ID (visibility = MATCHES_ONLY)
4. Verify:
   - Blob ID stored correctly
   - seal_policy_id set to MatchAllowlist ID
   - Non-matched user cannot decrypt
   - Matched users can decrypt successfully

### Test Page Features

- `/test-contract` page has full media management UI
- Step-by-step upload with visual feedback
- Media grid shows seal status
- One-click decrypt for authorized users

## Contract IDs (Testnet)

```typescript
PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821"
ALLOWLIST_REGISTRY_ID = "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399"
MEDIA_REGISTRY_ID = "0xd860be341dddb4ce09950e1b88a5264df84db0b9443932aab44c899f95ed6f73"
MATCH_REGISTRY_ID = "0xcae785a9aa1022cf38e274c01ad3d28cf5dc42ae60e2a9814f7d72b06fdf567b"
```

## Next Steps

1. **Auto-create MatchAllowlist**: Create allowlist automatically when match is created
2. **Batch decrypt**: Support decrypting multiple media at once
3. **Preview thumbnails**: Generate encrypted thumbnails for preview
4. **Access logs**: Track who viewed media and when
5. **Expiring content**: Add time-based expiration for media
6. **Custom allowlists**: Support user-defined access groups beyond matches

## References

- Seal Protocol Docs: https://docs.sui.io/guides/developer/cryptography/seal
- Walrus Docs: https://docs.walrus.site/
- Sui Move Docs: https://docs.sui.io/guides/developer/sui-101
