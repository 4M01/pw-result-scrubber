export function decodeBase64(base64String: string): string {
    try {
        return Buffer.from(base64String, 'base64').toString('utf8');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to decode Base64 content: ${message}`);
        return base64String; // Return original content if decoding fails
    }
}

export function encodeBase64(content: string): string {
    return Buffer.from(content, 'utf8').toString('base64');
}