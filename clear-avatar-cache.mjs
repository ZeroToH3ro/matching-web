import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('❌ Failed to connect to Redis after 3 retries');
      return null;
    }
    return Math.min(times * 200, 1000);
  }
});

async function clearAvatarCache() {
  console.log('\n🧹 Clearing Avatar Cache for All Users\n');
  console.log('='.repeat(70));

  try {
    // Get all users with avatars
    const users = await prisma.user.findMany({
      where: {
        publicAvatarBlobId: { not: null }
      },
      select: {
        id: true,
        member: {
          select: { name: true }
        }
      }
    });

    console.log(`\n📊 Found ${users.length} users with avatars\n`);

    // Clear cache for each user
    let clearedCount = 0;
    const cacheKeys = [];

    for (const user of users) {
      // Generate all possible cache keys for this user
      // Pattern: avatar:access:{targetUserId}:{viewerUserId}
      // Pattern: avatar:metadata:{targetUserId}

      // Clear metadata cache
      const metadataKey = `avatar:metadata:${user.id}`;
      cacheKeys.push(metadataKey);

      // Clear access cache for all possible viewer combinations
      for (const viewer of users) {
        if (viewer.id !== user.id) {
          const accessKey = `avatar:access:${user.id}:${viewer.id}`;
          cacheKeys.push(accessKey);
        }
      }

      // Also clear single user cache (without viewer)
      const singleUserKey = `avatar:access:${user.id}:`;
      cacheKeys.push(singleUserKey);
    }

    console.log(`\n🔍 Generated ${cacheKeys.length} cache keys to clear\n`);

    // Clear all cache keys in batches
    const batchSize = 100;
    for (let i = 0; i < cacheKeys.length; i += batchSize) {
      const batch = cacheKeys.slice(i, i + batchSize);

      // Use pipeline for better performance
      const pipeline = redis.pipeline();
      batch.forEach(key => pipeline.del(key));
      const results = await pipeline.exec();

      const deleted = results.filter(([err, result]) => !err && result === 1).length;
      clearedCount += deleted;

      console.log(`   Batch ${Math.floor(i / batchSize) + 1}: Cleared ${deleted}/${batch.length} keys`);
    }

    console.log(`\n✅ Successfully cleared ${clearedCount} cache entries`);
    console.log(`\n💡 Note: Matched users should now see private avatars on next fetch!`);

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Redis not running - cache clearing skipped');
      console.log('   This is OK in development. Users can hard refresh (Ctrl+Shift+R) their browser.');
    } else {
      console.error('\n❌ Error clearing cache:', error.message);
    }
  } finally {
    console.log('\n' + '='.repeat(70));
    await redis.quit();
    await prisma.$disconnect();
  }
}

clearAvatarCache();
