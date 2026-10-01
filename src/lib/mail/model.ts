import type { AmountValue, DatedValue } from "@/lib/entities/extract";

export type NormalizedMessage = {
  subject: string;
  subjectNormalized: string;
  fromEmail: string;
  fromDisplayName: string;
  fromDomain: string;
  fromTld: string;
  to: string[];
  cc: string[];
  replyTo: string[];
  messageId: string | null;
  receivedAt: Date;
  sentAt: Date | null;
  sizeBytes: number;
  attachmentCount: number;
  attachmentNames: string[];
  attachmentExtensions: string[];
  headers: Record<string, string>;
  bodyFullText: string;
  bodyNewText: string;
  bodyPreview: string;
  bodyTruncated: boolean;
  bodyUnavailable: boolean;
  bodyError: string | null;
  quoteSplitConfidence: "high" | "low";
  language: string;
  languageConfidence: number;
  sentiment: string;
  sentimentScore: number;
  urgencyLevel: string;
  urgencyScore: number;
  phonesRaw: string[];
  phonesNormalized: string[];
  emails: string[];
  urls: string[];
  urlDomains: string[];
  urlDomainMismatch: boolean;
  dates: DatedValue[];
  deadlines: DatedValue[];
  earliestDeadline: string | null;
  amounts: AmountValue[];
  currencies: string[];
  contractNumbers: string[];
  invoiceNumbers: string[];
  actNumbers: string[];
  ticketIds: string[];
  innNumbers: string[];
  kppNumbers: string[];
  ogrnNumbers: string[];
  bankAccountCandidates: string[];
  hasAttachments: boolean;
  entityListsTruncated: boolean;
};

export function emptyMessage(receivedAt = new Date()): NormalizedMessage {
  return {
    subject: "",
    subjectNormalized: "",
    fromEmail: "",
    fromDisplayName: "",
    fromDomain: "",
    fromTld: "",
    to: [],
    cc: [],
    replyTo: [],
    messageId: null,
    receivedAt,
    sentAt: null,
    sizeBytes: 0,
    attachmentCount: 0,
    attachmentNames: [],
    attachmentExtensions: [],
    headers: {},
    bodyFullText: "",
    bodyNewText: "",
    bodyPreview: "",
    bodyTruncated: false,
    bodyUnavailable: false,
    bodyError: null,
    quoteSplitConfidence: "high",
    language: "unknown",
    languageConfidence: 0,
    sentiment: "neutral",
    sentimentScore: 0,
    urgencyLevel: "low",
    urgencyScore: 0,
    phonesRaw: [],
    phonesNormalized: [],
    emails: [],
    urls: [],
    urlDomains: [],
    urlDomainMismatch: false,
    dates: [],
    deadlines: [],
    earliestDeadline: null,
    amounts: [],
    currencies: [],
    contractNumbers: [],
    invoiceNumbers: [],
    actNumbers: [],
    ticketIds: [],
    innNumbers: [],
    kppNumbers: [],
    ogrnNumbers: [],
    bankAccountCandidates: [],
    hasAttachments: false,
    entityListsTruncated: false,
  };
}
