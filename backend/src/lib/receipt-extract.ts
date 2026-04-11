import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export interface ExtractedReceiptItem {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  total?: number | null;
  notes?: string | null;
}

export interface ExtractedReceipt {
  supplier?: string | null;
  receiptDate?: string | null; // ISO date (YYYY-MM-DD)
  currency?: string | null;
  total?: number | null;
  notes?: string | null;
  items: ExtractedReceiptItem[];
  rawText?: string;
}

const SYSTEM_PROMPT = `You are a receipt/invoice extraction assistant for a restaurant kitchen.
Given a photo of a supplier receipt, extract structured data as strict JSON matching this shape:

{
  "supplier": string | null,
  "receiptDate": "YYYY-MM-DD" | null,
  "currency": string | null,
  "total": number | null,
  "notes": string | null,
  "items": [
    {
      "name": string,
      "quantity": number | null,
      "unit": string | null,
      "unitPrice": number | null,
      "total": number | null,
      "notes": string | null
    }
  ]
}

Rules:
- Respond with ONLY valid JSON, no markdown fences, no commentary.
- If you cannot read a field, return null for that field.
- "items" must be an array (possibly empty).
- Keep item names concise and human-readable.
- Use the receipt's own currency symbol/code if visible, otherwise null.
- Date should be the date printed on the receipt, not today.`;

export async function extractReceiptFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedReceipt> {
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY is not configured on the server');
  }

  const base64 = buffer.toString('base64');
  const mediaType = (mimeType || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: 'Extract the receipt into JSON following the schema in the system prompt.',
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '';

  // Strip potential markdown fences just in case
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: ExtractedReceipt;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: return an empty shape with rawText so the chef can fill manually
    return { items: [], rawText: raw };
  }

  if (!Array.isArray(parsed.items)) parsed.items = [];
  parsed.rawText = raw;
  return parsed;
}
