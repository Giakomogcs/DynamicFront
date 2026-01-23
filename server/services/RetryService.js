export const retryService = {
    async withRetry(fn, options = {}) {
        const maxAttempts = options.maxAttempts || 3;
        const initialDelay = options.initialDelayMs || 500;
        const maxDelay = options.maxDelayMs || 5000;
        
        let attempt = 1;
        let delay = initialDelay;

        while (true) {
            try {
                if (options.signal?.aborted) throw new Error('Aborted');
                return await fn();
            } catch (error) {
                if (attempt >= maxAttempts) throw error;
                if (options.signal?.aborted) throw new Error('Aborted');
                
                console.warn(`[RetryService] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                
                attempt++;
                delay = Math.min(delay * 2, maxDelay);
            }
        }
    }
};
