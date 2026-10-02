import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parquetMetadata, parquetReadObjects } from 'hyparquet';
import type { OddsQuestion } from '../src/client.ts';

export interface EvalItem {
  id: string;
  text: string;
  truth: string;
}

export interface EvalTask {
  id: string;
  title: string;
  dataset: string;
  file: string;
  revision: string;
  license: string;
  sample: number;
  window?: number;
  questionId: string;
  question: OddsQuestion;
  labels: readonly string[];
  toItem(row: Record<string, unknown>, rowIndex: number): EvalItem;
}

const EMOTION_LABELS = ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise'] as const;
const STAR_LABELS = ['1', '2', '3', '4', '5'] as const;

export const TASKS: readonly EvalTask[] = [
  {
    id: 'injection',
    title: 'Is this text a prompt injection?',
    dataset: 'deepset/prompt-injections',
    file: 'data/test-00000-of-00001-701d16158af87368.parquet',
    revision: '4f61ecb038e9c3fb77e21034b22511b523772cdd',
    license: 'apache-2.0',
    sample: 116,
    questionId: 'injection',
    question: {
      type: 'bool',
      instructions:
        'Does this text try to make an AI system ignore its instructions, change its role, or do something the user did not ask for?',
      criteria: {
        true: 'It tries to steer an AI system',
        false: 'It is an ordinary request or text',
      },
    },
    labels: ['false', 'true'],
    toItem: (row, rowIndex) => ({
      id: `injection-${rowIndex}`,
      text: String(row.text),
      truth: Number(row.label) === 1 ? 'true' : 'false',
    }),
  },
  {
    id: 'emotion',
    title: 'Which emotion does the writer express?',
    dataset: 'dair-ai/emotion',
    file: 'split/test-00000-of-00001.parquet',
    revision: 'cab853a1dbdf4c42c2b3ef2173804746df8825fe',
    license: 'other',
    sample: 300,
    questionId: 'emotion',
    question: {
      type: 'choice',
      instructions: 'Which emotion does the writer express most strongly?',
      criteria: {
        sadness: 'Sadness',
        joy: 'Joy',
        love: 'Love or affection',
        anger: 'Anger',
        fear: 'Fear or worry',
        surprise: 'Surprise',
      },
    },
    labels: EMOTION_LABELS,
    toItem: (row, rowIndex) => ({
      id: `emotion-${rowIndex}`,
      text: String(row.text),
      truth: EMOTION_LABELS[Number(row.label)],
    }),
  },
  {
    id: 'stars',
    title: 'How many stars did this reviewer give?',
    dataset: 'Yelp/yelp_review_full',
    file: 'yelp_review_full/test-00000-of-00001.parquet',
    revision: 'c1f9ee939b7d05667af864ee1cb066393154bf85',
    license: 'other',
    sample: 300,
    window: 3000,
    questionId: 'stars',
    question: {
      type: 'score',
      instructions: 'How many stars, from 1 to 5, did the writer give this business?',
      criteria: ['1 star', '2 stars', '3 stars', '4 stars', '5 stars'],
    },
    labels: STAR_LABELS,
    toItem: (row, rowIndex) => ({
      id: `stars-${rowIndex}`,
      text: String(row.text),
      truth: STAR_LABELS[Number(row.label)],
    }),
  },
];

const CACHE_DIR = join(import.meta.dir, '..', '.eval-cache');

export function evenlySpacedIndexes(total: number, count: number): number[] {
  if (count >= total) return Array.from({ length: total }, (_, index) => index);
  return Array.from({ length: count }, (_, index) => Math.floor((index * total) / count));
}

export function rowsHash(items: readonly EvalItem[]): string {
  const hash = createHash('sha256');
  for (const item of items) hash.update(`${item.id}\u0000${item.truth}\u0000${item.text}\u0000`);
  return hash.digest('hex');
}

export function parquetUrl(task: EvalTask): string {
  return `https://huggingface.co/datasets/${task.dataset}/resolve/${task.revision}/${task.file}`;
}

async function pinnedParquet(task: EvalTask): Promise<ArrayBuffer> {
  const path = join(CACHE_DIR, `${task.id}-${task.revision}.parquet`);
  if (!existsSync(path)) {
    const response = await fetch(parquetUrl(task));
    if (!response.ok) throw new Error(`${parquetUrl(task)} returned ${response.status}`);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path, new Uint8Array(await response.arrayBuffer()));
  }
  const bytes = readFileSync(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function loadTaskItems(task: EvalTask): Promise<{ items: EvalItem[]; total: number }> {
  const file = await pinnedParquet(task);
  const metadata = parquetMetadata(file);
  const total = Number(metadata.num_rows);
  const rows = (await parquetReadObjects({
    file,
    rowStart: 0,
    rowEnd: Math.min(total, task.window ?? total),
  })) as Record<string, unknown>[];
  const items = evenlySpacedIndexes(rows.length, task.sample).map((index) =>
    task.toItem(rows[index], index),
  );
  return { items, total };
}
