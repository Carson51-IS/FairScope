import OpenAI from "openai";

let _client: OpenAI | null = null;
let _totalTokens = 0;

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getOpenAI(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  _client = new OpenAI({ apiKey });
  return _client;
}

export function logTokenUsage(label: string, usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined | null) {
  if (!usage) return;
  const total = usage.total_tokens ?? 0;
  _totalTokens += total;
  console.log(
    `[OpenAI] ${label}: prompt=${usage.prompt_tokens ?? 0} completion=${usage.completion_tokens ?? 0} total=${total} (session: ${_totalTokens})`
  );
}

export async function createEmbedding(text: string): Promise<number[]> {
  const client = getOpenAI();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  logTokenUsage("embedding", response.usage);
  return response.data[0].embedding;
}

export async function createEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAI();
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    logTokenUsage(`embedding-batch[${i}..${i + batch.length}]`, response.usage);
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

const MAX_PASSAGE_CHARS = 2000;

export function truncatePassage(text: string): string {
  if (text.length <= MAX_PASSAGE_CHARS) return text;
  return text.slice(0, MAX_PASSAGE_CHARS) + "...";
}
