import { createHighlighter } from 'shiki';
import { install, snippet } from './src/snippets.ts';

const engraving = {
  name: 'engraving',
  type: 'light' as const,
  colors: { 'editor.background': '#00000000', 'editor.foreground': '#1b1712' },
  tokenColors: [
    { scope: ['comment'], settings: { foreground: '#8a7e6c', fontStyle: 'italic' } },
    {
      scope: ['keyword', 'storage', 'keyword.control'],
      settings: { foreground: '#a3271b', fontStyle: 'italic' },
    },
    { scope: ['string', 'string.quoted', 'string.template'], settings: { foreground: '#4a5a2a' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#7a4b12' } },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: { foreground: '#1b1712', fontStyle: 'bold' },
    },
    {
      scope: ['variable.other.property', 'meta.object-literal.key'],
      settings: { foreground: '#5b4a8a' },
    },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#8a7e6c' } },
  ],
};

export async function highlightSnippets(): Promise<{ snippet: string; install: string }> {
  const highlighter = await createHighlighter({
    themes: [engraving],
    langs: ['javascript', 'shellscript'],
  });

  const render = (code: string, lang: string) =>
    highlighter.codeToHtml(code, { lang, theme: 'engraving' });

  return { snippet: render(snippet, 'javascript'), install: render(install, 'shellscript') };
}
