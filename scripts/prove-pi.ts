import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import odds, { ODDS_PROVIDER } from '../pi/index.ts';

const PROOF_RUNS_DIR = join(import.meta.dir, '..', 'proof-runs');

const issues = [
  {
    id: 'A-1',
    text: 'Third time asking. Checkout is broken and nobody answers. We are losing money.',
  },
  { id: 'A-2', text: 'Small typo in the docs sidebar, no rush.' },
  { id: 'A-3', text: 'Love the new release, thanks team!' },
];

const questions = {
  frustration: {
    type: 'choice' as const,
    instructions: 'Judge only the emotional tone of the writer.',
    criteria: {
      none: 'Calm or positive',
      mild: 'Some irritation',
      high: 'Clearly frustrated or angry',
    },
  },
  urgent: {
    type: 'bool' as const,
    instructions: 'Does this need action today?',
    criteria: { true: 'Needs action today', false: 'Can wait' },
  },
};

async function main(): Promise<void> {
  const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    extensionFactories: [odds],
  });

  await loader.reload();

  const { session } = await createAgentSession({
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
  });

  try {
    const models = session.modelRuntime;
    const clef = models.getModelOfType('classifier', ODDS_PROVIDER, 'clef');

    if (!clef) throw new Error('odds/clef is not registered in Pi');
    const started = Date.now();

    const results = await Promise.all(
      issues.map((issue) => models.classify(clef, { state: issue, questions })),
    );

    const failures = results.filter((result) => result.stopReason !== 'stop');

    const answers = results.map((result, index) => ({
      id: issues[index].id,
      answers: result.answers,
    }));

    const costUsd = results.reduce((sum, result) => sum + (result.usage?.cost.total ?? 0), 0);
    const ordered = answers.map((entry) => entry.answers.frustration);

    const expectHighFirst =
      ordered[0]?.type === 'choice' && ordered[0].choice !== 'none' && ordered[2]?.type === 'choice'
        ? ordered[2].choice === 'none'
        : false;

    const receipt = {
      kind: 'odds.receipt/v0',
      claim: 'Pi codemode models.classify reaches odds/clef through the default AI Gateway',
      verdict: failures.length === 0 && expectHighFirst ? 'observed' : 'failed',
      observed: {
        provider: ODDS_PROVIDER,
        model: clef.id,
        api: clef.api,
        calls: results.length,
        failures: failures.map((failure) => failure.errorMessage),
        sanityHighBeforeCalm: expectHighFirst,
        answers,
        costUsd,
        elapsedMs: Date.now() - started,
      },
      at: new Date().toISOString(),
    };

    mkdirSync(PROOF_RUNS_DIR, { recursive: true });
    const path = join(PROOF_RUNS_DIR, 'pi-classify-clef.json');
    writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify(receipt, null, 2));

    if (receipt.verdict !== 'observed') process.exit(1);
  } finally {
    session.dispose();
  }
}

await main();
