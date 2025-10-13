# Requirements Document

## Introduction

This feature introduces a privacy-enhanced profile avatar system using Seal Protocol encryption. The core concept is that profile avatars are encrypted and can only be viewed by users who have successfully matched with the profile owner. This creates a progressive disclosure system where users must demonstrate mutual interest (through matching) before gaining access to more personal visual information.

The feature integrates with the existing matching system, Seal Protocol for encryption/decryption, and the Walrus storage system for decentralized image storage. It provides a balance between privacy protection and social discovery, encouraging meaningful connections while protecting user privacy.

## Requirements

### Requirement 1

**User Story:** As a dating app user, I want to upload an encrypted profile avatar that only matched users can see, so that I can maintain privacy while still sharing personal photos with people I'm interested in.

#### Acceptance Criteria

1. WHEN a user uploads a profile avatar THEN the system SHALL encrypt the image using Seal Protocol before storing it on Walrus
2. WHEN a user uploads a profile avatar THEN the system SHALL create a match-based allowlist that controls access to the encrypted avatar
3. WHEN a user uploads a profile avatar THEN the system SHALL store the Walrus blob ID and Seal policy ID in their profile
4. IF a user already has a profile avatar THEN the system SHALL allow them to replace it with a new encrypted avatar
5. WHEN a profile avatar is uploaded THEN the system SHALL validate the image format and size constraints

### Requirement 2

**User Story:** As a dating app user, I want to see profile avatars of users I've matched with, so that I can have a more personal connection with my matches.

#### Acceptance Criteria

1. WHEN I view a profile of someone I've matched with THEN the system SHALL decrypt and display their profile avatar if available
2. WHEN I view a profile of someone I haven't matched with THEN the system SHALL show a placeholder avatar or blurred version
3. WHEN the decryption process fails THEN the system SHALL gracefully fallback to showing a placeholder avatar
4. WHEN I access a profile avatar THEN the system SHALL verify my match status through the Seal allowlist
5. WHEN viewing a matched user's avatar THEN the system SHALL log the access for analytics and security purposes

### Requirement 3

**User Story:** As a dating app user, I want the avatar access to be automatically managed when matches are created or deleted, so that I don't have to manually manage permissions.

#### Acceptance Criteria

1. WHEN a new match is created THEN the system SHALL automatically grant both users access to each other's encrypted profile avatars
2. WHEN a match is deleted or blocked THEN the system SHALL automatically revoke access to profile avatars for both users
3. WHEN a user deletes their profile THEN the system SHALL revoke all access to their profile avatar
4. WHEN a user updates their match allowlist THEN the avatar access permissions SHALL be updated accordingly
5. WHEN the system processes match changes THEN it SHALL ensure avatar access changes are atomic and consistent

### Requirement 4

**User Story:** As a dating app user, I want to control who can see my profile avatar through privacy settings, so that I can have fine-grained control over my image sharing.

#### Acceptance Criteria

1. WHEN I access my privacy settings THEN I SHALL be able to enable or disable encrypted avatar sharing
2. WHEN I disable avatar sharing THEN existing matches SHALL lose access to my profile avatar
3. WHEN I re-enable avatar sharing THEN current matches SHALL regain access to my profile avatar
4. WHEN I set avatar visibility to "premium matches only" THEN only users with premium subscriptions who match with me SHALL see my avatar
5. WHEN I configure avatar expiry settings THEN access to my avatar SHALL automatically expire after the specified time period

### Requirement 5

**User Story:** As a system administrator, I want to monitor and moderate profile avatars for safety and compliance, so that the platform maintains appropriate content standards.

#### Acceptance Criteria

1. WHEN a profile avatar is uploaded THEN the system SHALL perform automated content moderation checks
2. WHEN inappropriate content is detected THEN the system SHALL flag the avatar for manual review and temporarily restrict access
3. WHEN an avatar is reported by users THEN the system SHALL queue it for moderation review
4. WHEN an avatar is deemed inappropriate THEN the system SHALL remove it and notify the user
5. WHEN moderation actions are taken THEN the system SHALL log all actions for audit purposes

### Requirement 6

**User Story:** As a dating app user, I want the avatar loading to be fast and reliable, so that I have a smooth browsing experience when viewing matched profiles.

#### Acceptance Criteria

1. WHEN I request to view a matched user's avatar THEN the system SHALL cache the decrypted image for improved performance
2. WHEN avatar decryption fails due to network issues THEN the system SHALL retry the operation with exponential backoff
3. WHEN I view multiple matched profiles THEN the system SHALL preload avatars in the background for faster browsing
4. WHEN avatar data is cached THEN the system SHALL respect cache expiry times and refresh stale data
5. WHEN the system is under high load THEN avatar loading SHALL degrade gracefully without blocking other functionality

### Requirement 7

**User Story:** As a dating app user, I want to update my avatar through the profile edit page with both public and private versions, so that I can control what different users see based on our match status.

#### Acceptance Criteria

1. WHEN I access the profile edit page at `/members/edit` THEN I SHALL see an avatar upload section with options for both public and private avatars
2. WHEN I upload an image for my avatar THEN the system SHALL automatically generate a public version using the face swap tool functionality
3. WHEN I upload an avatar image THEN the system SHALL store the original as an encrypted private avatar on-chain with Seal Protocol
4. WHEN I use the face swap functionality THEN the system SHALL integrate with the existing Auto (Humans) function from `/face-swap-tool` page
5. WHEN I save my avatar settings THEN both the public swapped version and private encrypted version SHALL be stored and linked to my profile

### Requirement 8

**User Story:** As a dating app user, I want to see different avatar versions when viewing other users' profiles based on our match status, so that I can have appropriate access to personal information.

#### Acceptance Criteria

1. WHEN I view a user profile at `/members/[userId]` and we are NOT matched THEN I SHALL see only their public avatar (face-swapped version)
2. WHEN I view a user profile at `/members/[userId]` and we ARE matched THEN I SHALL see their true private avatar (decrypted on-chain image)
3. WHEN the private avatar decryption fails THEN the system SHALL gracefully fallback to showing the public avatar
4. WHEN a user has no avatar uploaded THEN the system SHALL show a default placeholder avatar
5. WHEN I view my own profile THEN I SHALL always see my true private avatar regardless of match status

### Requirement 9

**User Story:** As a dating app user, I want the face swap integration to work seamlessly with my avatar upload, so that I can easily create privacy-preserving public avatars.

#### Acceptance Criteria

1. WHEN I upload an avatar image in the profile edit page THEN the system SHALL automatically trigger the face swap process using a random face
2. WHEN the face swap process completes THEN the system SHALL present both the original and swapped versions for my review
3. WHEN I approve the face swap result THEN the system SHALL save the swapped version as my public avatar
4. WHEN the face swap fails THEN the system SHALL allow me to retry with a different random face or upload a different image
5. WHEN I want to regenerate my public avatar THEN I SHALL be able to trigger the face swap process again with the same or new source image

### Requirement 10

**User Story:** As a dating app user, I want to easily access avatar viewing and uploading functions by clicking on my current avatar, so that I can quickly manage my profile image without scrolling through the entire edit form.

#### Acceptance Criteria

1. WHEN I click on my current avatar in the profile edit page THEN the system SHALL display a context menu or modal with "View Avatar" and "Upload Avatar" options
2. WHEN I select "View Avatar" THEN the system SHALL open a modal showing both my public and private avatar versions in full size
3. WHEN I select "Upload Avatar" THEN the system SHALL focus on or scroll to the avatar upload section of the page
4. WHEN viewing my avatar in the modal THEN I SHALL be able to see labels indicating which version is public (visible to all) and which is private (visible to matches only)
5. WHEN the avatar modal is open THEN I SHALL be able to close it by clicking outside the modal, pressing escape, or clicking a close button