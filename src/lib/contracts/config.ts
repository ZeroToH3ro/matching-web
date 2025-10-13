// Contract configuration for matching_me - uses environment variables
export const CONTRACT_CONFIG = {
  // Package ID
  PACKAGE_ID: process.env.NEXT_PUBLIC_PACKAGE_ID || '0xfd972d776b539416d5ca7b1c23a80f7c205c01d27aacfe920ba192e927c47169',
  
  // Core Registries (Shared Objects)
  PROFILE_REGISTRY: process.env.NEXT_PUBLIC_PROFILE_REGISTRY_ID || '0xfcc68641f11da2e5e5c165e0cff868622c093fd108cc5a22bbdcb0da5a09c29f',
  MEDIA_REGISTRY: process.env.NEXT_PUBLIC_MEDIA_REGISTRY_ID || '0xac3a29abd6c0adf8332d0eee17501e873851573274f125d3485ae77658a5a796',
  MATCH_REGISTRY: process.env.NEXT_PUBLIC_MATCH_REGISTRY_ID || '0x5783cfcf108c6725375073cadae913f74548e1e78301618ccacb737ab9ff0e01',
  ALLOWLIST_REGISTRY: process.env.NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID || '0xddd7e55d690838376f8e8d02704a3dea81fb0b749cc7b6a62da786257a6cb1db',
  
  // Chat System
  CHAT_REGISTRY: process.env.NEXT_PUBLIC_CHAT_REGISTRY_ID || '0xfe59f320ba036d2b00d448c7ec13e693c356f5185d7a88bfaec7dd8046d3d299',
  MESSAGE_INDEX: process.env.NEXT_PUBLIC_MESSAGE_INDEX_ID || '0x3ad6932b984fc1743fad059b938b3298dc862b5018a22cb5b3423e8179feb63a',
  
  // Integration
  MATCH_CHAT_REGISTRY: process.env.NEXT_PUBLIC_MATCH_CHAT_REGISTRY_ID || '0x7c19b1d267007bac773fee0c91ee4290321998923754ddb44be491a68db9bdf5',
  USAGE_TRACKER: process.env.NEXT_PUBLIC_USAGE_TRACKER_ID || '0x8f9366d6e0c1edd5cc5e52988a46d8d1c6ab78fa469fcfb9cf58fa1f9f81e207',
  
  // Admin Capabilities (Owned by deployer) - not exposed to client
  CORE_ADMIN_CAP: process.env.CORE_ADMIN_CAP_ID || '0x8306c89566db879fe8a47dd38afaab9a9c71715d0d9d77ccb8b31137c1082be0',
  CHAT_ADMIN_CAP: process.env.CHAT_ADMIN_CAP_ID || '0x3f453340120136b3184037ceb1c48e5bc871ee16504233235ca12c8a5eb0b7bb',
  UPGRADE_CAP: process.env.UPGRADE_CAP_ID || '0x11489986adbdaf984da59257b8a3c5e64e73a3e32ab6d0e56a86fef43be7cfda',
  
  // Module Names
  MODULES: {
    CORE: 'core',
    CHAT: 'chat',
    SEAL_POLICIES: 'seal_policies',
    INTEGRATION: 'integration',
    UTILS: 'utils'
  },
  
  // Function Names for Avatar
  FUNCTIONS: {
    // Core module functions
    UPLOAD_PRIVATE_AVATAR: 'upload_private_avatar',
    GRANT_AVATAR_ACCESS: 'grant_avatar_access',
    REVOKE_AVATAR_ACCESS: 'revoke_avatar_access',
    CREATE_MEDIA_CONTENT: 'create_media_content',
    
    // Seal policies functions
    CREATE_AVATAR_ALLOWLIST_SHARED: 'create_avatar_allowlist_shared',
    ADD_MATCHED_USER_TO_AVATAR: 'add_matched_user_to_avatar',
    REMOVE_MATCHED_USER_FROM_AVATAR: 'remove_matched_user_from_avatar',
    SEAL_APPROVE_AVATAR: 'seal_approve_avatar',
    
    // Profile functions
    CREATE_PROFILE: 'create_profile',
    UPDATE_PROFILE: 'update_profile',
    
    // Match functions
    CREATE_MATCH_REQUEST: 'create_match_request',
    UPDATE_MATCH_STATUS: 'update_match_status'
  },
  
  // Content Types
  CONTENT_TYPES: {
    IMAGE: 0,
    AVATAR: 1,
    VIDEO: 2
  },
  
  // Visibility Levels
  VISIBILITY: {
    PUBLIC: 0,
    MATCHES_ONLY: 2
  },
  
  // Match Status
  MATCH_STATUS: {
    PENDING: 0,
    ACTIVE: 1,
    BLOCKED: 3
  },
  
  // Allowlist Types
  ALLOWLIST_TYPES: {
    CHAT: 0x01,
    SUBSCRIPTION: 0x02,
    MATCH: 0x03,
    TIMELOCK: 0x04,
    CUSTOM: 0x05,
    AVATAR: 0x06
  }
} as const;

// Type definitions
export type ContractConfig = typeof CONTRACT_CONFIG;
export type ModuleName = keyof typeof CONTRACT_CONFIG.MODULES;
export type FunctionName = keyof typeof CONTRACT_CONFIG.FUNCTIONS;