import * as ImagePicker from "expo-image-picker";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function getApiBase(): string {
  return `${BASE_URL}/api`;
}

export type UploadResult = {
  objectPath: string;
  servingUrl: string;
};

export type MediaType = "image" | "video" | "both";

async function requestPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return false;
  return true;
}

export async function pickAndUploadMedia(options?: {
  mediaTypes?: MediaType;
  allowsEditing?: boolean;
  aspect?: [number, number];
}): Promise<UploadResult | null> {
  const granted = await requestPermissions();
  if (!granted) return null;

  const mediaTypes =
    options?.mediaTypes === "video"
      ? ImagePicker.MediaType.Videos
      : options?.mediaTypes === "both"
        ? ImagePicker.MediaType.All
        : ImagePicker.MediaType.Images;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect ?? [4, 3],
    quality: 0.85,
    base64: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const fileName = uri.split("/").pop() ?? "upload";
  const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
  const fileSize = asset.fileSize ?? 0;

  return uploadFileFromUri(uri, fileName, mimeType, fileSize);
}

export async function pickAndUploadFromCamera(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
}): Promise<UploadResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaType.Images,
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect ?? [4, 3],
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const fileName = uri.split("/").pop() ?? "camera.jpg";
  const mimeType = asset.mimeType ?? "image/jpeg";
  const fileSize = asset.fileSize ?? 0;

  return uploadFileFromUri(uri, fileName, mimeType, fileSize);
}

export async function uploadFileFromUri(
  uri: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<UploadResult | null> {
  const urlRes = await fetch(`${BASE_URL}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: fileName, size: fileSize, contentType: mimeType }),
  });

  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = (await urlRes.json()) as { uploadURL: string; objectPath: string };

  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();

  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
  });

  if (!uploadRes.ok) throw new Error("Failed to upload file");

  const servingUrl = `${BASE_URL}/api/storage${objectPath}`;
  return { objectPath, servingUrl };
}

export function getServingUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  return `${BASE_URL}/api/storage${objectPath}`;
}
