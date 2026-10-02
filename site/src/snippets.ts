export const install = `pi install git:github.com/acoyfellow/odds

mkdir -p ~/.config/odds && chmod 700 ~/.config/odds
cat > ~/.config/odds/config.json <<'EOF'
{ "accountId": "<gateway-account-id>", "gateway": "default" }
EOF
chmod 600 ~/.config/odds/config.json

security add-generic-password -a "$USER" -s odds-gateway -w`;

export const snippet = `const clef = await models.getModelOfType('classifier', 'odds', 'clef');
const { issues } = await tools.mcp__linear__list_issues({ state: 'open', limit: 250 });

const judged = await Promise.all(issues.map(async (issue) => {
  const r = await models.classify(clef, {
    state: issue,
    questions: {
      frustration: {
        type: 'choice',
        instructions: 'Tone of the writer only.',
        criteria: {
          none: 'Calm',
          mild: 'Irritated',
          high: 'Angry'
        }
      },
      urgent: {
        type: 'bool',
        instructions: 'Needs an engineer today?',
        criteria: {
          true: 'Yes',
          false: 'No'
        }
      },
    },
  });
  return { issue, ...r.answers };
}));

return judged
  .filter((j) => j.urgent.probability > 0.8)
  .map((j) => \`\${j.issue.id} \${j.issue.title}\`);`;
