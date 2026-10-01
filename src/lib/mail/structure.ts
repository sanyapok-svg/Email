export type StructureNode = {
  part?: string;
  type?: string;
  parameters?: Record<string, string | undefined>;
  encoding?: string;
  disposition?: string | null;
  dispositionParameters?: Record<string, string | undefined>;
  childNodes?: StructureNode[];
  size?: number;
};

export type TextPartRef = {
  part: string;
  mimeType: string;
  charset?: string;
  encoding?: string;
  size?: number;
};

export type AttachmentRef = {
  name: string;
  extension: string;
};

export type ClassifiedStructure = {
  textParts: TextPartRef[];
  attachments: AttachmentRef[];
  encrypted: boolean;
};

export function classifyStructure(root: StructureNode | null | undefined): ClassifiedStructure {
  const textParts: TextPartRef[] = [];
  const attachments: AttachmentRef[] = [];
  let encrypted = false;
  walk(root, textParts, attachments, (value) => {
    encrypted = encrypted || value;
  });
  return { textParts, attachments, encrypted };
}

function walk(
  node: StructureNode | null | undefined,
  textParts: TextPartRef[],
  attachments: AttachmentRef[],
  markEncrypted: (value: boolean) => void,
) {
  if (!node) return;
  const type = (node.type || "").toLowerCase();
  if (type === "multipart/encrypted" || type.includes("pkcs7") || type.includes("pgp")) {
    markEncrypted(true);
  }
  if (node.childNodes?.length) {
    for (const child of node.childNodes) walk(child, textParts, attachments, markEncrypted);
    return;
  }
  const disposition = (node.disposition || "").toLowerCase();
  const filename = node.dispositionParameters?.filename || node.parameters?.name || "";
  const isAttachment = disposition === "attachment" || (filename && !type.startsWith("text/"));
  if (isAttachment || (!type.startsWith("text/") && type && !type.startsWith("multipart/"))) {
    attachments.push(describeAttachment(filename, type, attachments.length + 1));
    return;
  }
  if (type === "text/plain" || type === "text/html" || type.startsWith("text/")) {
    textParts.push({
      part: node.part || "1",
      mimeType: type,
      charset: node.parameters?.charset,
      encoding: node.encoding,
      size: node.size,
    });
  }
}

function describeAttachment(filename: string, type: string, index: number): AttachmentRef {
  const clean = filename.trim();
  const fromName = extensionOf(clean);
  const fromType = type.includes("/") ? type.split("/")[1].split(";")[0].replace(/^x-/, "") : "";
  const extension = (fromName || (fromType && fromType !== "octet-stream" ? fromType : "")).toLowerCase();
  return {
    name: clean || (extension ? `attachment-${index}.${extension}` : `attachment-${index}`),
    extension,
  };
}

function extensionOf(filename: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(filename);
  return match?.[1]?.toLowerCase() ?? "";
}
