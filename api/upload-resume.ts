import { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { fileName, mimeType } = req.body;
        if (!fileName || !mimeType) {
            return res.status(400).json({ error: 'Missing required file data' });
        }

        const endpoint = process.env.B2_ENDPOINT;
        const keyId = process.env.B2_KEY_ID;
        const appKey = process.env.B2_APP_KEY;
        const bucketName = process.env.B2_BUCKET_NAME;

        if (!endpoint || !keyId || !appKey || !bucketName) {
            throw new Error("Missing B2 environment variables.");
        }

        // 1. Initialize the S3 Client pointed at Backblaze B2
        const s3 = new S3Client({
            endpoint: endpoint,
            region: "us-east-001", // Region doesn't matter for B2, but AWS SDK requires a string here
            credentials: {
                accessKeyId: keyId,
                secretAccessKey: appKey,
            },
        });

        // 2. Generate a highly unique filename to prevent overwriting (Simulating a CUID)
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const key = `resumes/${uniqueFileName}`;

        // 3. Define the action we are asking permission for (PutObject)
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: mimeType
        });

        // 4. Generate the VIP Pass (Presigned URL) expiring in 60 seconds
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

        // 5. Construct the final public URL where the file can be viewed later
        // Note: Backblaze supports standard S3 path-style URLs!
        const finalFileUrl = `${endpoint}/${bucketName}/${key}`;

        return res.status(200).json({
            uploadUrl,
            finalFileUrl
        });

    } catch (error: any) {
        console.error('B2 Presigned URL Error:', error);
        return res.status(500).json({
            error: 'Failed to generate upload link: ' + error.message
        });
    }
}
