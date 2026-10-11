import type { AttachmentsConfig } from "@copilotkit/react-core/v2";

type AttachmentUploadResult = Awaited<ReturnType<NonNullable<AttachmentsConfig["onUpload"]>>>;
import mammoth from "mammoth/mammoth.browser.js";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACCEPT = `application/pdf,text/plain,text/markdown,${DOCX_MIME},.pdf,.txt,.md,.docx`;
export const MAX_SIZE = 5 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Anthropic reads PDF and text but not DOCX, so DOCX becomes plain text here; other files travel inline as base64. */
export async function onUpload(file: File): Promise<AttachmentUploadResult> {
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".docx") || file.type === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return { type: "data", value: toBase64(new TextEncoder().encode(value.trim())), mimeType: "text/plain", metadata: { filename: file.name } };
  }
  return { type: "data", value: toBase64(new Uint8Array(buffer)), mimeType: file.type || "application/octet-stream", metadata: { filename: file.name } };
}

/** CV upload config for `CopilotChat`; `onError` shows the message inline in the page. */
export function createAttachments(onError: (message: string) => void): AttachmentsConfig {
  return {
    enabled: true,
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    onUpload,
    onUploadFailed: (error) => onError(error.message),
  };
}
