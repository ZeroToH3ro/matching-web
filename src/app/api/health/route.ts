import { NextResponse } from 'next/server';
import { getProductionConfigService } from '@/services/productionConfigService';
import { getAvatarAnalyticsService } from '@/services/avatarAnalyticsService';
import { prisma } from '@/lib/prisma';

const configService = getProductionConfigService();
const analyticsService = getAvatarAnalyticsService();

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Perform comprehensive health checks
    const [
      dbHealth,
      walrusHealth,
      sealHealth,
      cacheHealth,
      analyticsHealth
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkWalrusHealth(),
      checkSealHealth(),
      checkCacheHealth(),
      checkAnalyticsHealth()
    ]);

    const responseTime = Date.now() - startTime;
    
    // Determine overall health status
    const healthChecks = {
      database: getHealthResult(dbHealth),
      walrus: getHealthResult(walrusHealth),
      seal: getHealthResult(sealHealth),
      cache: getHealthResult(cacheHealth),
      analytics: getHealthResult(analyticsHealth)
    };

    const failedChecks = Object.entries(healthChecks)
      .filter(([_, result]) => result.status === 'error')
      .map(([name]) => name);

    const degradedChecks = Object.entries(healthChecks)
      .filter(([_, result]) => result.status === 'warning')
      .map(([name]) => name);

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    let httpStatus: number;

    if (failedChecks.length === 0) {
      overallStatus = degradedChecks.length === 0 ? 'healthy' : 'degraded';
      httpStatus = 200;
    } else if (failedChecks.includes('database')) {
      // Database failure is critical
      overallStatus = 'unhealthy';
      httpStatus = 503;
    } else {
      // Other service failures are degraded
      overallStatus = 'degraded';
      httpStatus = 200;
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      environment: configService.getConfig().environment,
      version: process.env.npm_package_version || 'unknown',
      checks: healthChecks,
      summary: {
        total: Object.keys(healthChecks).length,
        healthy: Object.values(healthChecks).filter(c => c.status === 'ok').length,
        degraded: degradedChecks.length,
        failed: failedChecks.length
      }
    };

    // Send alert if unhealthy
    if (overallStatus === 'unhealthy') {
      await configService.sendAlert(
        `Avatar service is unhealthy. Failed checks: ${failedChecks.join(', ')}`,
        'error'
      );
    }

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: configService.getConfig().environment
    };

    await configService.sendAlert(
      `Avatar service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    );

    return NextResponse.json(errorResponse, { status: 503 });
  }
}

async function checkDatabaseHealth(): Promise<{ status: string; details: any }> {
  try {
    const startTime = Date.now();
    
    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    // Check if response time is acceptable
    if (responseTime > 5000) {
      return {
        status: 'warning',
        details: {
          message: 'Database response time is slow',
          responseTime,
          threshold: 5000
        }
      };
    }

    return {
      status: 'ok',
      details: {
        responseTime,
        connection: 'active'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      details: {
        message: error instanceof Error ? error.message : 'Database connection failed',
        error: error instanceof Error ? error.name : 'Unknown'
      }
    };
  }
}

async function checkWalrusHealth(): Promise<{ status: string; details: any }> {
  try {
    const connectivity = await configService.validateWalrusConnectivity();
    
    const healthyPublishers = connectivity.publishers.filter(p => p.status === 'ok').length;
    const healthyAggregators = connectivity.aggregators.filter(a => a.status === 'ok').length;
    
    const totalPublishers = connectivity.publishers.length;
    const totalAggregators = connectivity.aggregators.length;
    
    // Check if at least 50% of endpoints are healthy
    const publisherHealthRatio = healthyPublishers / totalPublishers;
    const aggregatorHealthRatio = healthyAggregators / totalAggregators;
    
    if (publisherHealthRatio === 0 || aggregatorHealthRatio === 0) {
      return {
        status: 'error',
        details: {
          message: 'No healthy Walrus endpoints available',
          publishers: `${healthyPublishers}/${totalPublishers}`,
          aggregators: `${healthyAggregators}/${totalAggregators}`,
          connectivity
        }
      };
    }
    
    if (publisherHealthRatio < 0.5 || aggregatorHealthRatio < 0.5) {
      return {
        status: 'warning',
        details: {
          message: 'Some Walrus endpoints are unhealthy',
          publishers: `${healthyPublishers}/${totalPublishers}`,
          aggregators: `${healthyAggregators}/${totalAggregators}`,
          connectivity
        }
      };
    }
    
    return {
      status: 'ok',
      details: {
        publishers: `${healthyPublishers}/${totalPublishers}`,
        aggregators: `${healthyAggregators}/${totalAggregators}`,
        network: configService.getWalrusConfig().network
      }
    };
  } catch (error) {
    return {
      status: 'error',
      details: {
        message: error instanceof Error ? error.message : 'Walrus health check failed',
        error: error instanceof Error ? error.name : 'Unknown'
      }
    };
  }
}

async function checkSealHealth(): Promise<{ status: string; details: any }> {
  try {
    const sealValidation = await configService.validateSealConnectivity();
    
    if (!sealValidation.packageExists) {
      return {
        status: 'error',
        details: {
          message: 'Seal package not found',
          validation: sealValidation
        }
      };
    }
    
    if (!sealValidation.serverObjectsValid) {
      return {
        status: 'warning',
        details: {
          message: 'Seal server objects validation failed',
          validation: sealValidation
        }
      };
    }
    
    return {
      status: 'ok',
      details: {
        network: sealValidation.network,
        packageExists: sealValidation.packageExists,
        serverObjectsValid: sealValidation.serverObjectsValid,
        gasObjectValid: sealValidation.gasObjectValid
      }
    };
  } catch (error) {
    return {
      status: 'error',
      details: {
        message: error instanceof Error ? error.message : 'Seal health check failed',
        error: error instanceof Error ? error.name : 'Unknown'
      }
    };
  }
}

async function checkCacheHealth(): Promise<{ status: string; details: any }> {
  try {
    // Using in-memory cache, always available
    const cacheEnabled = true;
    
    if (!cacheEnabled) {
      return {
        status: 'warning',
        details: {
          message: 'Cache is not configured',
          enabled: false
        }
      };
    }
    
    // Using in-memory cache, no external dependencies to test
    return {
      status: 'ok',
      details: {
        enabled: true,
        url: process.env.REDIS_URL ? 'configured' : 'not configured'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      details: {
        message: error instanceof Error ? error.message : 'Cache health check failed',
        error: error instanceof Error ? error.name : 'Unknown'
      }
    };
  }
}

async function checkAnalyticsHealth(): Promise<{ status: string; details: any }> {
  try {
    // Test analytics service by checking if it's enabled
    const analyticsEnabled = process.env.AVATAR_ANALYTICS_ENABLED === 'true';
    
    if (!analyticsEnabled) {
      return {
        status: 'warning',
        details: {
          message: 'Analytics service is disabled',
          enabled: false
        }
      };
    }
    
    // Try to perform a simple analytics operation
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    try {
      await analyticsService.getUploadSuccessRate(startDate, endDate);
      
      return {
        status: 'ok',
        details: {
          enabled: true,
          message: 'Analytics service is operational'
        }
      };
    } catch (analyticsError) {
      return {
        status: 'warning',
        details: {
          message: 'Analytics service has issues',
          enabled: true,
          error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error'
        }
      };
    }
  } catch (error) {
    return {
      status: 'warning',
      details: {
        message: error instanceof Error ? error.message : 'Analytics health check failed',
        error: error instanceof Error ? error.name : 'Unknown'
      }
    };
  }
}

function getHealthResult(settledResult: PromiseSettledResult<any>): { status: string; details: any } {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  } else {
    return {
      status: 'error',
      details: {
        message: 'Health check promise rejected',
        error: settledResult.reason
      }
    };
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}