import { createHash, createHmac } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { getBackupDir } from "./backup-dir.js";

type RemoteBackupConfig = {
  configured: boolean;
  provider: "digitalocean-spaces";
  bucket?: string;
  region?: string;
  endpoint?: string;
  prefix: string;
};

type UploadResult = {
  enabled: boolean;
  uploaded: boolean;
  provider: "digitalocean-spaces";
  bucket?: string;
  key?: string;
  url?: string;
  error?: string;
};

function cleanPrefix(value: string | undefined) {
  return String(value || "rajesh-shopping-center/backups")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export function getRemoteBackupConfig(): RemoteBackupConfig {
  const bucket = process.env.BACKUP_SPACES_BUCKET;
  const accessKey = process.env.BACKUP_SPACES_ACCESS_KEY_ID;
  const secretKey = process.env.BACKUP_SPACES_SECRET_ACCESS_KEY;
  const region = process.env.BACKUP_SPACES_REGION || "nyc3";
  const endpoint = (process.env.BACKUP_SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`).replace(/\/+$/, "");

  return {
    configured: Boolean(bucket && accessKey && secretKey),
    provider: "digitalocean-spaces",
    bucket,
    region,
    endpoint,
    prefix: cleanPrefix(process.env.BACKUP_SPACES_PREFIX),
  };
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sign(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function encodeKey(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function amzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function shortDate(date: Date) {
  return amzDate(date).slice(0, 8);
}

export async function uploadBackupToRemote(filename: string): Promise<UploadResult> {
  const config = getRemoteBackupConfig();
  if (!config.configured) {
    return {
      enabled: false,
      uploaded: false,
      provider: "digitalocean-spaces",
      bucket: config.bucket,
      error: "Remote backup storage is not configured.",
    };
  }

  const accessKey = process.env.BACKUP_SPACES_ACCESS_KEY_ID!;
  const secretKey = process.env.BACKUP_SPACES_SECRET_ACCESS_KEY!;
  const region = config.region!;
  const endpoint = config.endpoint!;
  const bucket = config.bucket!;
  const key = `${config.prefix}/${filename}`;
  const filePath = path.resolve(getBackupDir(), filename);
  const body = await readFile(filePath);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const now = new Date();
  const xAmzDate = amzDate(now);
  const dateStamp = shortDate(now);
  const endpointUrl = new URL(endpoint);
  const host = `${bucket}.${endpointUrl.host}`;
  const canonicalUri = `/${encodeKey(key)}`;
  const url = `${endpointUrl.protocol}//${host}${canonicalUri}`;
  const contentType = "application/gzip";

  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${xAmzDate}`,
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    xAmzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = sign(signingKey, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": xAmzDate,
    },
    body,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Remote backup upload failed (${response.status}). ${details}`.trim());
  }

  return {
    enabled: true,
    uploaded: true,
    provider: "digitalocean-spaces",
    bucket,
    key,
    url,
  };
}
