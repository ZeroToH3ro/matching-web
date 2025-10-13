interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  userSegments: string[];
  conditions: FeatureFlagCondition[];
  metadata: {
    description: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  };
}

interface FeatureFlagCondition {
  type: 'user_id' | 'email' | 'role' | 'subscription' | 'registration_date' | 'custom';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | number | string[];
}

interface UserContext {
  userId: string;
  email?: string;
  role?: string;
  subscription?: string;
  registrationDate?: Date;
  customAttributes?: Record<string, any>;
}

interface RolloutConfig {
  strategy: 'percentage' | 'user_segments' | 'conditional' | 'hybrid';
  percentage: number;
  segments: string[];
  conditions: FeatureFlagCondition[];
  enabledUsers: string[];
  disabledUsers: string[];
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private rolloutConfigs: Map<string, RolloutConfig> = new Map();
  private userCache: Map<string, Map<string, boolean>> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeDefaultFlags();
    this.loadFlagsFromEnvironment();
  }

  private initializeDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'avatar_upload_enabled',
        enabled: true,
        rolloutPercentage: 100,
        userSegments: ['all'],
        conditions: [],
        metadata: {
          description: 'Enable avatar upload functionality',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      },
      {
        key: 'avatar_display_enabled',
        enabled: true,
        rolloutPercentage: 100,
        userSegments: ['all'],
        conditions: [],
        metadata: {
          description: 'Enable avatar display functionality',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      },
      {
        key: 'avatar_face_swap_enabled',
        enabled: true,
        rolloutPercentage: 100,
        userSegments: ['all'],
        conditions: [],
        metadata: {
          description: 'Enable face swap functionality for public avatars',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      },
      {
        key: 'avatar_encryption_enabled',
        enabled: true,
        rolloutPercentage: 100,
        userSegments: ['all'],
        conditions: [],
        metadata: {
          description: 'Enable Seal Protocol encryption for private avatars',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      },
      {
        key: 'avatar_analytics_enabled',
        enabled: true,
        rolloutPercentage: 100,
        userSegments: ['all'],
        conditions: [],
        metadata: {
          description: 'Enable avatar analytics tracking',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      },
      {
        key: 'avatar_moderation_enabled',
        enabled: true,
        rolloutPercentage: 100,
        userSegments: ['all'],
        conditions: [],
        metadata: {
          description: 'Enable avatar content moderation',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      },
      {
        key: 'avatar_progressive_loading_enabled',
        enabled: true,
        rolloutPercentage: 80,
        userSegments: ['beta', 'premium'],
        conditions: [],
        metadata: {
          description: 'Enable progressive image loading for avatars',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      },
      {
        key: 'avatar_cdn_enabled',
        enabled: true,
        rolloutPercentage: 90,
        userSegments: ['all'],
        conditions: [],
        metadata: {
          description: 'Enable CDN for avatar delivery',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });
  }

  private loadFlagsFromEnvironment(): void {
    // Load feature flags from environment variables
    const envFlags = {
      avatar_upload_enabled: process.env.AVATAR_UPLOAD_ENABLED === 'true',
      avatar_display_enabled: process.env.AVATAR_DISPLAY_ENABLED === 'true',
      avatar_face_swap_enabled: process.env.AVATAR_FACE_SWAP_ENABLED === 'true',
      avatar_encryption_enabled: process.env.AVATAR_ENCRYPTION_ENABLED === 'true',
      avatar_analytics_enabled: process.env.AVATAR_ANALYTICS_ENABLED === 'true',
      avatar_moderation_enabled: process.env.AVATAR_MODERATION_ENABLED === 'true',
      avatar_progressive_loading_enabled: process.env.AVATAR_PROGRESSIVE_LOADING_ENABLED === 'true',
      avatar_cdn_enabled: process.env.AVATAR_CDN_ENABLED === 'true'
    };

    // Update flags based on environment variables
    Object.entries(envFlags).forEach(([key, enabled]) => {
      const flag = this.flags.get(key);
      if (flag) {
        flag.enabled = enabled;
        flag.metadata.updatedAt = new Date().toISOString();
        this.flags.set(key, flag);
      }
    });

    // Load rollout configurations
    this.loadRolloutConfigs();
  }

  private loadRolloutConfigs(): void {
    // Load rollout configurations from environment
    const rolloutConfigs: Record<string, RolloutConfig> = {
      avatar_upload_enabled: {
        strategy: 'percentage',
        percentage: parseInt(process.env.AVATAR_UPLOAD_ROLLOUT_PERCENTAGE || '100'),
        segments: (process.env.AVATAR_UPLOAD_ROLLOUT_SEGMENTS || 'all').split(','),
        conditions: [],
        enabledUsers: (process.env.AVATAR_UPLOAD_ENABLED_USERS || '').split(',').filter(Boolean),
        disabledUsers: (process.env.AVATAR_UPLOAD_DISABLED_USERS || '').split(',').filter(Boolean)
      },
      avatar_progressive_loading_enabled: {
        strategy: 'hybrid',
        percentage: parseInt(process.env.AVATAR_PROGRESSIVE_ROLLOUT_PERCENTAGE || '80'),
        segments: ['beta', 'premium'],
        conditions: [
          {
            type: 'registration_date',
            operator: 'greater_than',
            value: '2024-01-01'
          }
        ],
        enabledUsers: [],
        disabledUsers: []
      }
    };

    Object.entries(rolloutConfigs).forEach(([key, config]) => {
      this.rolloutConfigs.set(key, config);
    });
  }

  /**
   * Check if a feature flag is enabled for a specific user
   */
  async isEnabled(flagKey: string, userContext: UserContext): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.getCachedResult(flagKey, userContext.userId);
      if (cached !== null) {
        return cached;
      }

      const flag = this.flags.get(flagKey);
      if (!flag) {
        console.warn(`Feature flag '${flagKey}' not found`);
        return false;
      }

      // If flag is globally disabled, return false
      if (!flag.enabled) {
        this.setCachedResult(flagKey, userContext.userId, false);
        return false;
      }

      // Check rollout configuration
      const rolloutConfig = this.rolloutConfigs.get(flagKey);
      if (rolloutConfig) {
        const result = await this.evaluateRollout(rolloutConfig, userContext);
        this.setCachedResult(flagKey, userContext.userId, result);
        return result;
      }

      // Default evaluation based on flag configuration
      const result = await this.evaluateFlag(flag, userContext);
      this.setCachedResult(flagKey, userContext.userId, result);
      return result;

    } catch (error) {
      console.error(`Error evaluating feature flag '${flagKey}':`, error);
      return false;
    }
  }

  private async evaluateFlag(flag: FeatureFlag, userContext: UserContext): Promise<boolean> {
    // Check user segments
    if (flag.userSegments.length > 0 && !flag.userSegments.includes('all')) {
      const userSegment = await this.getUserSegment(userContext);
      if (!flag.userSegments.includes(userSegment)) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions.length > 0) {
      const conditionsResult = await this.evaluateConditions(flag.conditions, userContext);
      if (!conditionsResult) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = this.hashUserId(userContext.userId);
      const userPercentile = userHash % 100;
      return userPercentile < flag.rolloutPercentage;
    }

    return true;
  }

  private async evaluateRollout(config: RolloutConfig, userContext: UserContext): Promise<boolean> {
    // Check explicit user lists first
    if (config.enabledUsers.includes(userContext.userId)) {
      return true;
    }

    if (config.disabledUsers.includes(userContext.userId)) {
      return false;
    }

    switch (config.strategy) {
      case 'percentage':
        return this.evaluatePercentageRollout(config.percentage, userContext.userId);

      case 'user_segments':
        const userSegment = await this.getUserSegment(userContext);
        return config.segments.includes(userSegment) || config.segments.includes('all');

      case 'conditional':
        return await this.evaluateConditions(config.conditions, userContext);

      case 'hybrid':
        // Combine percentage, segments, and conditions
        const percentageResult = this.evaluatePercentageRollout(config.percentage, userContext.userId);
        const segmentResult = config.segments.length === 0 || config.segments.includes('all') || 
                             config.segments.includes(await this.getUserSegment(userContext));
        const conditionsResult = config.conditions.length === 0 || 
                               await this.evaluateConditions(config.conditions, userContext);

        return percentageResult && segmentResult && conditionsResult;

      default:
        return false;
    }
  }

  private evaluatePercentageRollout(percentage: number, userId: string): boolean {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    const userHash = this.hashUserId(userId);
    const userPercentile = userHash % 100;
    return userPercentile < percentage;
  }

  private async evaluateConditions(conditions: FeatureFlagCondition[], userContext: UserContext): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, userContext);
      if (!result) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(condition: FeatureFlagCondition, userContext: UserContext): Promise<boolean> {
    let contextValue: any;

    switch (condition.type) {
      case 'user_id':
        contextValue = userContext.userId;
        break;
      case 'email':
        contextValue = userContext.email;
        break;
      case 'role':
        contextValue = userContext.role;
        break;
      case 'subscription':
        contextValue = userContext.subscription;
        break;
      case 'registration_date':
        contextValue = userContext.registrationDate;
        break;
      case 'custom':
        contextValue = userContext.customAttributes;
        break;
      default:
        return false;
    }

    if (contextValue === undefined || contextValue === null) {
      return false;
    }

    return this.evaluateOperator(condition.operator, contextValue, condition.value);
  }

  private evaluateOperator(operator: string, contextValue: any, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return contextValue === conditionValue;
      case 'contains':
        return String(contextValue).includes(String(conditionValue));
      case 'starts_with':
        return String(contextValue).startsWith(String(conditionValue));
      case 'ends_with':
        return String(contextValue).endsWith(String(conditionValue));
      case 'greater_than':
        return contextValue > conditionValue;
      case 'less_than':
        return contextValue < conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(contextValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(contextValue);
      default:
        return false;
    }
  }

  private async getUserSegment(userContext: UserContext): Promise<string> {
    // Determine user segment based on context
    if (userContext.role === 'ADMIN') {
      return 'admin';
    }

    if (userContext.subscription === 'premium') {
      return 'premium';
    }

    if (userContext.registrationDate) {
      const daysSinceRegistration = (Date.now() - userContext.registrationDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceRegistration < 30) {
        return 'new_user';
      }
    }

    // Check if user is in beta program (this would typically come from database)
    if (userContext.customAttributes?.betaUser) {
      return 'beta';
    }

    return 'standard';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getCachedResult(flagKey: string, userId: string): boolean | null {
    const userCache = this.userCache.get(userId);
    if (!userCache) return null;

    const expiry = this.cacheExpiry.get(`${userId}:${flagKey}`);
    if (!expiry || Date.now() > expiry) {
      // Cache expired
      userCache.delete(flagKey);
      this.cacheExpiry.delete(`${userId}:${flagKey}`);
      return null;
    }

    return userCache.get(flagKey) ?? null;
  }

  private setCachedResult(flagKey: string, userId: string, result: boolean): void {
    let userCache = this.userCache.get(userId);
    if (!userCache) {
      userCache = new Map();
      this.userCache.set(userId, userCache);
    }

    userCache.set(flagKey, result);
    this.cacheExpiry.set(`${userId}:${flagKey}`, Date.now() + this.CACHE_TTL);
  }

  /**
   * Update a feature flag configuration
   */
  updateFlag(flagKey: string, updates: Partial<FeatureFlag>): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      return false;
    }

    const updatedFlag = {
      ...flag,
      ...updates,
      metadata: {
        ...flag.metadata,
        updatedAt: new Date().toISOString()
      }
    };

    this.flags.set(flagKey, updatedFlag);
    this.clearCache(); // Clear cache when flags are updated
    return true;
  }

  /**
   * Update rollout configuration
   */
  updateRollout(flagKey: string, config: RolloutConfig): boolean {
    this.rolloutConfigs.set(flagKey, config);
    this.clearCache(); // Clear cache when rollout configs are updated
    return true;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get rollout configuration for a flag
   */
  getRolloutConfig(flagKey: string): RolloutConfig | null {
    return this.rolloutConfigs.get(flagKey) || null;
  }

  /**
   * Clear user cache
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.userCache.delete(userId);
      // Clear expiry entries for this user
      for (const key of this.cacheExpiry.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.cacheExpiry.delete(key);
        }
      }
    } else {
      this.userCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get feature flag statistics
   */
  getStatistics(): {
    totalFlags: number;
    enabledFlags: number;
    flagsWithRollout: number;
    cacheSize: number;
  } {
    const totalFlags = this.flags.size;
    const enabledFlags = Array.from(this.flags.values()).filter(f => f.enabled).length;
    const flagsWithRollout = this.rolloutConfigs.size;
    const cacheSize = this.userCache.size;

    return {
      totalFlags,
      enabledFlags,
      flagsWithRollout,
      cacheSize
    };
  }
}

// Singleton instance
let featureFlagService: FeatureFlagService | null = null;

export function getFeatureFlagService(): FeatureFlagService {
  if (!featureFlagService) {
    featureFlagService = new FeatureFlagService();
  }
  return featureFlagService;
}