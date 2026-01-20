// UTF-8 Configuration for Node.js
// This MUST be at the very top before any other imports

// Set Node.js process encoding
process.env.NODE_OPTIONS = '--no-warnings';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

// Ensure UTF-8 encoding for all stdio
process.stdout.setDefaultEncoding('utf8');
process.stderr.setDefaultEncoding('utf8');

// Set encoding for console
if (process.platform === 'win32') {
    // Windows-specific: ensure console uses UTF-8
    try {
        const { execSync } = await import('child_process');
        execSync('chcp 65001', { stdio: 'ignore' });
    } catch (e) {
        // Silently fail if chcp not available
    }
}

console.log('[UTF-8] Encoding configured ✓');

export const ensureUTF8 = () => {
    return true; // Marker that UTF-8 is configured
};
