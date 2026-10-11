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

export const UNSUPPORTED_MESSAGE = "Please attach your CV as a PDF, Word (.docx), Markdown or text file";

/** Anthropic accepts only PDF and plain text documents, so every file is judged by extension, then type, and sent as one of those. */
function cvMimeType(file: File): "application/pdf" | "text/plain" | "docx" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "application/pdf";
  if (name.endsWith(".docx") || file.type === DOCX_MIME) return "docx";
  if (/\.(md|markdown|txt)$/.test(name) || file.type.startsWith("text/")) return "text/plain";
  throw new Error(UNSUPPORTED_MESSAGE);
}

/** DOCX becomes plain text here (Anthropic reads no DOCX); PDF and text travel inline as base64 with a normalized MIME type. */
export async function onUpload(file: File): Promise<AttachmentUploadResult> {
  const kind = cvMimeType(file);
  const buffer = await file.arrayBuffer();
  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return { type: "data", value: toBase64(new TextEncoder().encode(value.trim())), mimeType: "text/plain", metadata: { filename: file.name } };
  }
  return { type: "data", value: toBase64(new Uint8Array(buffer)), mimeType: kind, metadata: { filename: file.name } };
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
