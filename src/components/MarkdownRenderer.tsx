// ---------------------------------------------------------------------------
// Markdown Renderer with Syntax Highlighting
// ---------------------------------------------------------------------------

import { memo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Import highlight.js CSS theme
import 'highlight.js/styles/github-dark.css';

// ---- Props ----------------------------------------------------------------

interface MarkdownRendererProps {
  content: unknown;
  className?: string;
}

// ---- Copy Button Component ------------------------------------------------

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
      type="button"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ---- Custom Components ----------------------------------------------------

const components: Components = {
  // Code blocks
  pre: ({ children, ...props }) => {
    // Extract code content from children
    let code = '';
    if (
      children &&
      typeof children === 'object' &&
      'props' in children &&
      children.props &&
      typeof children.props === 'object' &&
      'children' in children.props
    ) {
      const codeChildren = children.props.children;
      if (Array.isArray(codeChildren)) {
        code = codeChildren.join('');
      } else if (typeof codeChildren === 'string') {
        code = codeChildren;
      }
    }

    return (
      <div className="group relative my-3">
        <CopyButton code={code} />
        <pre
          {...props}
          className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm"
        >
          {children}
        </pre>
      </div>
    );
  },

  // Inline code
  code: ({ children, className, ...props }) => {
    // Check if this is a code block (has language class)
    const isBlock = className && className.startsWith('language-');

    if (isBlock) {
      // Let the pre handler take care of this
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    // Inline code
    return (
      <code
        className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-sm text-amber-400"
        {...props}
      >
        {children}
      </code>
    );
  },

  // Headings
  h1: ({ children, ...props }) => (
    <h1 className="mt-4 mb-3 text-lg font-semibold text-zinc-100" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-3 mb-2 text-base font-semibold text-zinc-100" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-3 mb-2 text-sm font-semibold text-zinc-100" {...props}>
      {children}
    </h3>
  ),

  // Paragraphs
  p: ({ children, ...props }) => (
    <p className="mb-3 text-sm leading-relaxed text-zinc-100" {...props}>
      {children}
    </p>
  ),

  // Links
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-amber-400 underline decoration-amber-500/30 hover:decoration-amber-500"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // Lists
  ul: ({ children, ...props }) => (
    <ul className="mb-3 ml-4 list-disc space-y-1 text-sm text-zinc-100" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-3 ml-4 list-decimal space-y-1 text-sm text-zinc-100" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),

  // Tables
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="border-b-2 border-zinc-700" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => (
    <tr className="border-b border-zinc-800" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th className="px-3 py-2 text-left font-medium text-zinc-400" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2 text-zinc-100" {...props}>
      {children}
    </td>
  ),

  // Blockquotes
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-3 border-l-2 border-amber-500 pl-3 text-sm text-zinc-400 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: ({ ...props }) => <hr className="my-4 border-zinc-700" {...props} />,

  // Images
  img: ({ src, alt, ...props }) => (
    <img src={src} alt={alt} className="my-3 max-w-full rounded-lg" {...props} />
  ),
};

// ---- Component ------------------------------------------------------------

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  // Guard against non-string content — JSON.stringify objects as fallback
  const safeContent =
    typeof content === 'string' ? content : content == null ? '' : JSON.stringify(content, null, 2);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeHighlight,
          [
            rehypeSanitize,
            {
              ...defaultSchema,
              // Allow className on code/span for syntax highlighting
              attributes: {
                ...defaultSchema.attributes,
                code: [...(defaultSchema.attributes?.code ?? []), 'className'],
                span: [...(defaultSchema.attributes?.span ?? []), 'className'],
              },
            },
          ],
        ]}
        components={components}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
});
