// Classify an article into exactly one of the fixed contract categories:
// research | tools | industry | models | tutorials | other
//
// Heuristic, source- and keyword-based. Order matters: the first matching
// rule wins, so the list is ordered from most specific/confident to least.

export const CATEGORY_IDS = [
  'research',
  'tools',
  'industry',
  'models',
  'tutorials',
  'other',
];

// Keyword groups. Each entry is a lowercase substring (word-ish) to look for
// in the title + excerpt haystack.
const TUTORIAL_KW = [
  'how to', 'how-to', 'tutorial', 'guide', 'walkthrough', 'getting started',
  'step by step', 'step-by-step', 'beginner', 'cheatsheet', 'cheat sheet',
  'tips and tricks', 'a primer', 'explained', 'crash course', 'hands-on',
  'hands on', 'learn ',
];

const MODEL_KW = [
  'release', 'released', 'releasing', 'introducing', 'announc', 'unveil',
  'launch', 'gpt-', 'gpt ', 'claude', 'gemini', 'llama', 'mistral', 'mixtral',
  'qwen', 'deepseek', 'phi-', 'grok', 'sora', 'dall-e', 'dall·e', 'stable diffusion',
  'flux', 'sdxl', 'open-weight', 'open weights', 'open weight', 'checkpoint',
  'fine-tune', 'foundation model', 'frontier model', ' o1', ' o3', ' o4',
];

const TOOLS_KW = [
  'library', 'framework', 'github.com', 'github', 'sdk', 'cli', 'open source',
  'open-source', 'npm', 'pip install', 'package', 'plugin', 'toolkit', 'api',
  'wrapper', 'extension', 'vscode', 'pytorch', 'tensorflow', 'jax', 'langchain',
  'llamaindex', 'vector db', 'vector database', 'show hn',
];

const INDUSTRY_KW = [
  'funding', 'raises', 'raised', 'valuation', 'acqui', 'merger', 'ipo',
  'startup', 'billion', 'million', 'revenue', 'lawsuit', 'regulat', 'policy',
  'partnership', 'hires', 'layoff', 'ceo', 'investor', 'venture', 'seed round',
  'series a', 'series b', 'series c', 'antitrust', 'ban', 'market',
];

const RESEARCH_KW = [
  'paper', 'arxiv', 'preprint', 'benchmark', 'state-of-the-art',
  'state of the art', 'sota', 'novel', 'we propose', 'we present',
  'empirical', 'theorem', 'dataset', 'ablation', 'neurips', 'icml', 'iclr',
  'cvpr', 'acl ', 'emnlp', 'study finds', 'research',
];

function haystack(article) {
  return [
    article.title || '',
    article.excerpt || article.summary || '',
  ]
    .join(' ')
    .toLowerCase();
}

function anyMatch(text, keywords) {
  return keywords.some((kw) => text.includes(kw));
}

// Returns one category id from CATEGORY_IDS.
export function categorize(article) {
  const sourceId = (article.sourceId || '').toLowerCase();
  const text = haystack(article);

  // 1) Source-anchored: anything from ArXiv is research, full stop.
  if (sourceId.startsWith('arxiv')) return 'research';

  // 2) Tutorials are intent-specific and rarely collide; check early.
  if (anyMatch(text, TUTORIAL_KW)) return 'tutorials';

  // 3) Model releases — strong signal words.
  if (anyMatch(text, MODEL_KW)) return 'models';

  // 4) Research signals (papers, benchmarks) outside ArXiv.
  if (anyMatch(text, RESEARCH_KW)) return 'research';

  // 5) Tools & libraries.
  if (anyMatch(text, TOOLS_KW)) return 'tools';

  // 6) Industry / business news.
  if (anyMatch(text, INDUSTRY_KW)) return 'industry';

  // 7) Fallback.
  return 'other';
}
