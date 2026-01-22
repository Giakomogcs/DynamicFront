import prisma from '../../registry.js';

// Pricing per 1 million tokens (input/output)
const MODEL_PRICING = {
    // Gemini
    'gemini-2.0-flash-exp': { input: 0, output: 0 }, // Free tier
    'gemini-2.0-flash': { input: 0, output: 0 }, // Free tier  
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },

    // OpenAI
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.150, output: 0.600 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'o1-preview': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 },

    // Anthropic
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },

    // Groq
    'llama-3.3-70b-versatile': { input: 0, output: 0 }, // Free tier
    'llama-3.1-70b-versatile': { input: 0, output: 0 }, // Free tier
    'llama-3.1-8b-instant': { input: 0, output: 0 }, // Free tier
    'mixtral-8x7b-32768': { input: 0, output: 0 }, // Free tier

    // xAI
    'grok-beta': { input: 5.00, output: 15.00 },

    // Default fallback
    'default': { input: 0, output: 0 }
};

class TokenTrackingService {
    constructor() {
        console.log('[TokenTracker] Service initialized');
    }

    /**
     * Record token usage for a model/provider
     */
    async recordUsage(providerId, modelId, usage, requestType = 'chat', sessionId = null) {
        try {
            const { inputTokens = 0, outputTokens = 0, totalTokens = 0 } = usage;

            // Calculate cost
            const cost = this.calculateCost(modelId, inputTokens, outputTokens);

            // Save to database
            await prisma.tokenUsage.create({
                data: {
                    providerId,
                    modelId,
                    inputTokens,
                    outputTokens,
                    totalTokens: totalTokens || (inputTokens + outputTokens),
                    estimatedCost: cost,
                    requestType,
                    sessionId
                }
            });

            // Update provider quota
            await this.updateQuota(providerId, totalTokens || (inputTokens + outputTokens), 1);

            console.log(`[TokenTracker] Recorded usage for ${modelId}: ${totalTokens} tokens ($${cost.toFixed(4)})`);

            return { success: true, cost };
        } catch (error) {
            console.error('[TokenTracker] Failed to record usage:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate cost for token usage
     */
    calculateCost(modelId, inputTokens, outputTokens) {
        // Find matching pricing (exact match first, then partial match)
        let pricing = MODEL_PRICING[modelId];

        if (!pricing) {
            // Try partial match
            const modelKey = Object.keys(MODEL_PRICING).find(key =>
                modelId.toLowerCase().includes(key.toLowerCase())
            );
            pricing = modelKey ? MODEL_PRICING[modelKey] : MODEL_PRICING.default;
        }

        const inputCost = (inputTokens / 1_000_000) * pricing.input;
        const outputCost = (outputTokens / 1_000_000) * pricing.output;

        return inputCost + outputCost;
    }

    /**
     * Update provider quota usage
     */
    async updateQuota(providerId, tokens, requests = 1) {
        try {
            const now = new Date();

            // Find or create quota record
            let quota = await prisma.providerQuota.findUnique({
                where: { providerId }
            });

            if (!quota) {
                quota = await prisma.providerQuota.create({
                    data: {
                        providerId,
                        currentRpm: 0,
                        currentTPM: 0,
                        dailyTokens: 0,
                        totalRequests: 0,
                        totalTokens: 0
                    }
                });
            }

            // Check if we need to reset counters
            const oneMinuteAgo = new Date(now.getTime() - 60000);
            const oneDayAgo = new Date(now.getTime() - 86400000);

            let updates = {
                totalRequests: { increment: requests },
                totalTokens: { increment: BigInt(tokens) }
            };

            // Reset RPM if more than 1 minute passed
            if (new Date(quota.lastRpmReset) < oneMinuteAgo) {
                updates.currentRpm = requests;
                updates.lastRpmReset = now;
            } else {
                updates.currentRpm = { increment: requests };
            }

            // Reset TPM if more than 1 minute passed
            if (new Date(quota.lastTPMReset) < oneMinuteAgo) {
                updates.currentTPM = tokens;
                updates.lastTPMReset = now;
            } else {
                updates.currentTPM = { increment: tokens };
            }

            // Reset daily tokens if more than 1 day passed
            if (new Date(quota.lastDailyReset) < oneDayAgo) {
                updates.dailyTokens = tokens;
                updates.lastDailyReset = now;
            } else {
                updates.dailyTokens = { increment: tokens };
            }

            await prisma.providerQuota.update({
                where: { providerId },
                data: updates
            });

            return { success: true };
        } catch (error) {
            console.error('[TokenTracker] Failed to update quota:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if provider has exceeded quota
     */
    async checkQuota(providerId) {
        try {
            const quota = await prisma.providerQuota.findUnique({
                where: { providerId }
            });

            if (!quota) {
                return { exceeded: false, status: 'no_quota_set' };
            }

            // Check RPM limit
            if (quota.rpmLimit && quota.currentRpm >= quota.rpmLimit) {
                return {
                    exceeded: true,
                    type: 'rpm',
                    current: quota.currentRpm,
                    limit: quota.rpmLimit,
                    resetsIn: this._getTimeUntilReset(quota.lastRpmReset, 60000)
                };
            }

            // Check TPM limit
            if (quota.tokensPerMinuteLimit && quota.currentTPM >= quota.tokensPerMinuteLimit) {
                return {
                    exceeded: true,
                    type: 'tpm',
                    current: quota.currentTPM,
                    limit: quota.tokensPerMinuteLimit,
                    resetsIn: this._getTimeUntilReset(quota.lastTPMReset, 60000)
                };
            }

            // Check daily limit
            if (quota.dailyTokenLimit && quota.dailyTokens >= quota.dailyTokenLimit) {
                return {
                    exceeded: true,
                    type: 'daily',
                    current: quota.dailyTokens,
                    limit: quota.dailyTokenLimit,
                    resetsIn: this._getTimeUntilReset(quota.lastDailyReset, 86400000)
                };
            }

            return { exceeded: false, quota };
        } catch (error) {
            console.error('[TokenTracker] Failed to check quota:', error);
            return { exceeded: false, error: error.message };
        }
    }

    /**
     * Get quota status for a provider
     */
    async getQuotaStatus(providerId) {
        try {
            const quota = await prisma.providerQuota.findUnique({
                where: { providerId }
            });

            if (!quota) {
                return null;
            }

            return {
                rpmUsage: quota.currentRpm,
                rpmLimit: quota.rpmLimit,
                tpmUsage: quota.currentTPM,
                tpmLimit: quota.tokensPerMinuteLimit,
                dailyUsage: quota.dailyTokens,
                dailyLimit: quota.dailyTokenLimit,
                usagePercentage: quota.dailyTokenLimit
                    ? (quota.dailyTokens / quota.dailyTokenLimit) * 100
                    : 0,
                resetsIn: this._getTimeUntilReset(quota.lastDailyReset, 86400000),
                totalRequests: quota.totalRequests,
                totalTokens: Number(quota.totalTokens)
            };
        } catch (error) {
            console.error('[TokenTracker] Failed to get quota status:', error);
            return null;
        }
    }

    /**
     * Get usage statistics for a timeframe
     */
    async getUsageStats(providerId, timeframe = '24h') {
        try {
            const startTime = this._getStartTime(timeframe);

            const where = {
                timestamp: { gte: startTime }
            };

            if (providerId) {
                where.providerId = providerId;
            }

            const usages = await prisma.tokenUsage.findMany({
                where,
                orderBy: { timestamp: 'desc' }
            });

            const totalTokens = usages.reduce((sum, u) => sum + u.totalTokens, 0);
            const totalCost = usages.reduce((sum, u) => sum + (u.estimatedCost || 0), 0);
            const totalRequests = usages.length;

            // Group by model
            const byModel = {};
            usages.forEach(u => {
                if (!byModel[u.modelId]) {
                    byModel[u.modelId] = {
                        tokens: 0,
                        cost: 0,
                        requests: 0
                    };
                }
                byModel[u.modelId].tokens += u.totalTokens;
                byModel[u.modelId].cost += u.estimatedCost || 0;
                byModel[u.modelId].requests++;
            });

            return {
                timeframe,
                totalTokens,
                totalCost,
                totalRequests,
                byModel,
                averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0
            };
        } catch (error) {
            console.error('[TokenTracker] Failed to get usage stats:', error);
            return null;
        }
    }

    /**
     * Get cost analysis
     */
    async getCostAnalysis(timeframe = '30d') {
        try {
            const startTime = this._getStartTime(timeframe);

            const usages = await prisma.tokenUsage.findMany({
                where: {
                    timestamp: { gte: startTime }
                }
            });

            // Group by provider
            const byProvider = {};
            usages.forEach(u => {
                if (!byProvider[u.providerId]) {
                    byProvider[u.providerId] = {
                        cost: 0,
                        tokens: 0,
                        requests: 0
                    };
                }
                byProvider[u.providerId].cost += u.estimatedCost || 0;
                byProvider[u.providerId].tokens += u.totalTokens;
                byProvider[u.providerId].requests++;
            });

            const totalCost = Object.values(byProvider).reduce((sum, p) => sum + p.cost, 0);

            return {
                timeframe,
                totalCost,
                byProvider,
                currency: 'USD'
            };
        } catch (error) {
            console.error('[TokenTracker] Failed to get cost analysis:', error);
            return null;
        }
    }

    /**
     * Helper: Get start time for timeframe
     */
    _getStartTime(timeframe) {
        const now = new Date();
        const units = {
            'h': 3600000,
            'd': 86400000,
            'w': 604800000,
            'm': 2592000000
        };

        const match = timeframe.match(/^(\d+)([hdwm])$/);
        if (!match) return new Date(now.getTime() - 86400000); // Default 24h

        const [, amount, unit] = match;
        return new Date(now.getTime() - (parseInt(amount) * units[unit]));
    }

    /**
     * Helper: Get time until reset
     */
    _getTimeUntilReset(lastReset, periodMs) {
        const now = Date.now();
        const resetTime = new Date(lastReset).getTime() + periodMs;
        const diff = resetTime - now;

        if (diff <= 0) return 'now';

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    }
}

export const tokenTracker = new TokenTrackingService();
