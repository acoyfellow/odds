import { spawn } from 'node:child_process';
import { z } from 'zod';

export const MODEL = {
  provider: process.env.NORTHSTAR_PROVIDER ?? 'anthropic',
  id: process.env.NORTHSTAR_MODEL ?? 'claude-opus-5-5',
};

export const PUBLIC_MODEL_LABEL = `claude-opus-5-5 via ${process.env.NORTHSTAR_PROVIDER ? 'a private Anthropic proxy' : 'anthropic'}`;

const usage = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
  cost: z.object({ total: z.number() }),
});

const call = z.object({
  name: z.string(),
  args: z.string(),
  status: z.string(),
  durationMs: z.number(),
  cost: z.number().optional(),
});

const event = z.looseObject({
  type: z.string(),
  message: z
    .looseObject({ role: z.string(), content: z.json().optional(), usage: usage.optional() })
    .optional(),
  toolName: z.string().optional(),
  args: z.json().optional(),
  isError: z.boolean().optional(),
  result: z
    .looseObject({ details: z.looseObject({ calls: z.array(call).optional() }).nullish() })
    .optional(),
});

const textBlock = z.object({ type: z.literal('text'), text: z.string() });

export interface PiRun {
  finalText: string;
  frontierUsd: number;
  frontierInputTokens: number;
  clefUsd: number;
  classifyCalls: number;
  toolCalls: { name: string; isError: boolean }[];
  scripts: string[];
  wallMs: number;
}

export function summarize(lines: readonly string[], wallMs: number): PiRun {
  const run: PiRun = {
    finalText: '',
    frontierUsd: 0,
    frontierInputTokens: 0,
    clefUsd: 0,
    classifyCalls: 0,
    toolCalls: [],
    scripts: [],
    wallMs,
  };

  for (const line of lines) {
    const parsed = event.safeParse(JSON.parse(line));

    if (!parsed.success) continue;
    const item = parsed.data;

    if (item.type === 'message_end' && item.message?.role === 'assistant' && item.message.usage) {
      const u = item.message.usage;

      run.frontierUsd += u.cost.total;
      run.frontierInputTokens += u.input + u.cacheRead + u.cacheWrite;
      const blocks = z.array(z.json()).safeParse(item.message.content).data ?? [];

      const texts = blocks.flatMap((block) => {
        const text = textBlock.safeParse(block);

        return text.success ? [text.data.text] : [];
      });

      if (texts.length > 0) run.finalText = texts.join('\n');
    }

    if (item.type === 'tool_execution_start' && item.toolName === 'codemode') {
      const code = z.object({ code: z.string() }).safeParse(item.args);

      if (code.success) run.scripts.push(code.data.code);
    }

    if (item.type === 'tool_execution_end' && item.toolName) {
      run.toolCalls.push({ name: item.toolName, isError: item.isError === true });

      for (const nested of item.result?.details?.calls ?? []) {
        if (nested.name === 'models.classify') {
          run.classifyCalls += 1;
          run.clefUsd += nested.cost ?? 0;
        }
      }
    }
  }

  return run;
}

export function runPi(
  prompt: string,
  cwd: string,
  tools: readonly string[],
  extensions: readonly string[],
): Promise<PiRun & { raw: string[] }> {
  const args = [
    '-p',
    '--no-session',
    '--mode',
    'json',
    '--no-skills',
    '--no-prompt-templates',
    '--provider',
    MODEL.provider,
    '--model',
    MODEL.id,
    ...(tools.length > 0 ? ['--tools', tools.join(',')] : ['--no-tools']),
    ...extensions.flatMap((path) => ['-e', path]),
    prompt,
  ];

  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn('pi', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '';
    const lines: string[] = [];
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split('\n');

      buffer = parts.pop() ?? '';

      for (const part of parts) if (part.trim()) lines.push(part);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (buffer.trim()) lines.push(buffer);
      const wallMs = Math.round(performance.now() - started);

      if (code !== 0) reject(new Error(`pi exited ${code}: ${stderr.slice(-400)}`));
      else resolve({ ...summarize(lines, wallMs), raw: lines });
    });
  });
}
