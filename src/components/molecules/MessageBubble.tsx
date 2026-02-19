import { useState } from 'react';

import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { Message } from '@/stores/chat';

function ToolUseBlock({ name, input }: { name?: string; input?: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const label = name || 'tool';
  const json = input !== undefined ? JSON.stringify(input, null, 2) : '';

  return (
    <div className="my-1 rounded-md border border-zinc-700 bg-zinc-950 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-amber-400 hover:bg-zinc-900"
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span className="font-mono font-medium">{label}</span>
        <span className="text-zinc-500">(tool_use)</span>
      </button>
      {expanded && json && (
        <pre className="overflow-x-auto border-t border-zinc-800 px-2 py-1.5 text-zinc-300">
          {json}
        </pre>
      )}
    </div>
  );
}

function ToolResultBlock({ output, isError }: { output?: unknown; isError?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const text =
    typeof output === 'string'
      ? output
      : output !== undefined
        ? JSON.stringify(output, null, 2)
        : '';

  return (
    <div
      className={`my-1 rounded-md border text-xs ${isError ? 'border-red-700 bg-red-950/30' : 'border-zinc-700 bg-zinc-950'}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-900"
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span className={`font-mono font-medium ${isError ? 'text-red-400' : 'text-zinc-300'}`}>
          {isError ? 'error' : 'result'}
        </span>
        <span className="text-zinc-500">(tool_result)</span>
      </button>
      {expanded && text && (
        <pre
          className={`overflow-x-auto border-t px-2 py-1.5 ${isError ? 'border-red-800 text-red-300' : 'border-zinc-800 text-zinc-300'}`}
        >
          {text}
        </pre>
      )}
    </div>
  );
}

function ThinkingBlock({ text }: { text?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  return (
    <div className="my-1 rounded-md border border-zinc-800 bg-zinc-950/50 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-zinc-500 hover:bg-zinc-900 hover:text-zinc-400"
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span className="italic">thinking…</span>
      </button>
      {expanded && (
        <div className="border-t border-zinc-800 px-2 py-1.5 text-zinc-500 italic">{text}</div>
      )}
    </div>
  );
}

function isGatewayMetadata(message: Message): boolean {
  if (message.role !== 'system') return false;
  const text = message.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('\n');
  if (/\b(untrusted metadata|conversation.info|conversation_label)\b/i.test(text)) return true;
  if (/^\[?\d{4}-\d{2}-\d{2}.*\b(connected|disconnected|status \d+)\b/i.test(text)) return true;
  if (/\[\[reply_to_current\]\]/i.test(text)) return true;
  return false;
}

export function MessageBubble({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isInjected = message.metadata?.injected === true;
  const [showMetadata, setShowMetadata] = useState(false);

  if (isGatewayMetadata(message)) {
    const preview = message.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join(' ')
      .slice(0, 60);
    return (
      <div className="relative mb-1 flex justify-center">
        <button
          type="button"
          onClick={() => setShowMetadata(!showMetadata)}
          className="max-w-md truncate rounded px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-800/50 hover:text-zinc-400"
        >
          {showMetadata ? '▾' : '▸'} {preview}…
        </button>
        {showMetadata && (
          <div className="absolute z-10 mt-6 max-w-lg rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-500 shadow-lg">
            {message.content
              .filter((c) => c.type === 'text')
              .map((c, i) => (
                <pre key={i} className="whitespace-pre-wrap">
                  {c.text}
                </pre>
              ))}
          </div>
        )}
      </div>
    );
  }

  const textBlocks = message.content.filter((c) => c.type === 'text');
  const images = message.content.filter((c) => c.type === 'image');
  const files = message.content.filter((c) => c.type === 'file');
  const toolUseBlocks = message.content.filter((c) => c.type === 'tool_use');
  const toolResultBlocks = message.content.filter((c) => c.type === 'tool_result');
  const thinkingBlocks = message.content.filter((c) => c.type === 'thinking');
  const textContent = textBlocks
    .map((c) => c.text || '')
    .join('\n')
    .replace(/\[\[reply_to_current\]\]/gi, '')
    .trim();

  return (
    <div
      className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'} ${isSystem ? 'justify-center' : ''}`}
    >
      <div
        className={`max-w-3xl rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-amber-500/10 text-zinc-100'
            : isSystem
              ? 'bg-zinc-800/50 text-zinc-400'
              : 'bg-zinc-900 text-zinc-100'
        } ${isInjected ? 'border-l-2 border-amber-500' : ''}`}
      >
        <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium">
            {isUser ? 'You' : isSystem ? 'System' : isInjected ? 'Injected Note' : 'Assistant'}
          </span>
          <span>
            {message.timestamp === 0 ? '—' : new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {message.model && <span className="text-zinc-600">({message.model})</span>}
        </div>

        {thinkingBlocks.map((block, idx) => (
          <ThinkingBlock key={idx} text={block.text} />
        ))}

        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <img
                key={idx}
                src={img.url}
                alt="Attachment"
                className="max-h-48 rounded-md border border-zinc-800"
              />
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="mb-2 space-y-1">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md bg-zinc-950 px-2 py-1 text-xs"
              >
                <span className="text-zinc-500">📎</span>
                <span className="text-zinc-400">{file.name}</span>
              </div>
            ))}
          </div>
        )}

        {toolUseBlocks.map((block, idx) => (
          <ToolUseBlock key={idx} name={block.toolName} input={block.input} />
        ))}
        {toolResultBlocks.map((block, idx) => (
          <ToolResultBlock key={idx} output={block.output} isError={block.isError} />
        ))}

        {textContent && (
          <div
            className={`${isUser || isSystem ? 'text-sm' : ''} ${isStreaming ? 'relative' : ''}`}
          >
            <MarkdownRenderer content={textContent} />
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-amber-500" />
            )}
          </div>
        )}

        {message.tokenCount && (
          <div className="mt-1 text-xs text-zinc-600">
            {message.tokenCount.input && `${message.tokenCount.input} in`}
            {message.tokenCount.input && message.tokenCount.output && ' / '}
            {message.tokenCount.output && `${message.tokenCount.output} out`}
          </div>
        )}
      </div>
    </div>
  );
}
