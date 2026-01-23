import { OAuth2Client } from 'google-auth-library';
// logger is not available globally, so we'll use console or a simple wrapper
const log = { debug: console.log, error: console.error, info: console.info };

const ENDPOINT = 'https://cloudcode-pa.googleapis.com/v1internal';

export class GeminiHandshakeService {
    async performHandshake(client, existingProjectId) {
        if (!client) throw new Error('Not authenticated');
        if (existingProjectId) return existingProjectId;

        log.debug('Performing handshake...');
        const userProjectId = undefined;
        const loadReq = {
            cloudaicompanionProject: userProjectId,
            metadata: { ideType: 'IDE_UNSPECIFIED', pluginType: 'GEMINI' },
        };

        const loadRes = await this.postRequest(client, 'loadCodeAssist', loadReq);

        if (loadRes.cloudaicompanionProject) {
            return loadRes.cloudaicompanionProject;
        }

        const tierId = loadRes.currentTier?.id || 'FREE';
        const onboardReq = {
            tierId: tierId,
            cloudaicompanionProject: tierId === 'FREE' ? undefined : userProjectId,
            metadata: { ideType: 'IDE_UNSPECIFIED', pluginType: 'GEMINI' },
        };

        let lro = await this.postRequest(client, 'onboardUser', onboardReq);

        while (!lro.done && lro.name) {
            log.debug('Waiting for onboarding...');
            await new Promise((r) => setTimeout(r, 2000));
            
            const opRes = await client.request({
                url: `${ENDPOINT}/${lro.name}`,
                method: 'GET',
            });
            lro = opRes.data;
        }

        const finalProjectId = lro.response?.cloudaicompanionProject?.id;
        if (!finalProjectId && tierId !== 'FREE' && userProjectId) {
            return userProjectId;
        }
        if (!finalProjectId) throw new Error('Failed to obtain Project ID.');

        return finalProjectId;
    }

    async postRequest(client, method, body) {
        const res = await client.request({
            url: `${ENDPOINT}:${method}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res.data;
    }
}
