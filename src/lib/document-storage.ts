import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | undefined;

function configuration() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (!bucket || !region) return null;
  return { bucket, region, endpoint: process.env.S3_ENDPOINT };
}

function getClient() {
  const config = configuration();
  if (!config) throw new Error("PRIVATE_DOCUMENT_STORAGE_NOT_CONFIGURED");
  if (!client) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {})
    });
  }
  return { client, bucket: config.bucket };
}

export function isPrivateDocumentStorageConfigured() {
  return Boolean(configuration());
}

export async function putPrivateDocument(input: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const { client, bucket } = getClient();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentLength: input.body.length,
    ContentType: input.contentType,
    ServerSideEncryption: "AES256"
  }));
}

export async function signPrivateDocumentDownload(key: string) {
  const { client, bucket } = getClient();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: "attachment"
  }), { expiresIn: 60 });
}

export async function deletePrivateDocument(key: string) {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
