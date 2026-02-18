// ---------------------------------------------------------------------------
// Chat View
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useChatStore, type Attachment, type SessionConfig, type Message } from '@/stores/chat';
import { useConnectionStore } from '@/stores/connection';
import { useModelsStore } from '@/stores/models';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { formatSessionKey } from '@/lib/utils';

// ---- Session Selector Component -------------------------------------------

function SessionSelector() {
  const { activeSessionKey, setActiveSession } = useChatStore();
  const [sessions, setSessions] = useState<Array<{ key: string; label?: string }>>([]);
  const { request, status, snapshot } = useConnectionStore();

  useEffect(() => {
    if (status !== 'connected') return;

    // Load available sessions
    const loadSessions = async () => {
      try {
        const response = await request<{
          sessions: Array<{ key: string; label?: string; lastActive?: number }>;
        }>('sessions.list', {
          limit: 100,
          includeDerivedTitles: false,
          includeGlobal: true,
          includeUnknown: true,
        });
        const sessionList = response.sessions || [];
        const mainSessionKey = snapshot?.sessionDefaults?.mainSessionKey?.trim();

        if (sessionList.length === 0 && mainSessionKey) {
          const fallback = [{ key: mainSessionKey, label: 'Main' }];
          setSessions(fallback);
          if (!activeSessionKey) {
            setActiveSession(mainSessionKey);
          }
          return;
        }

        setSessions(sessionList);

        // Set first session as active if none selected
        if (!activeSessionKey && sessionList.length > 0) {
          const preferred = mainSessionKey
            ? sessionList.find((session) => session.key === mainSessionKey)
            : undefined;
          const target = preferred ?? sessionList[0];
          if (target) {
            setActiveSession(target.key);
          }
        }
      } catch (err) {
        console.error('[Chat] Failed to load sessions:', err);
      }
    };

    loadSessions();
  }, [status, request, snapshot, activeSessionKey, setActiveSession]);

  if (sessions.length === 0) {
    return <div className="text-sm text-zinc-500">No sessions available</div>;
  }

  return (
    <select
      value={activeSessionKey || ''}
      onChange={(e) => setActiveSession(e.target.value)}
      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
    >
      {sessions.map((session) => (
        <option key={session.key} value={session.key}>
          {formatSessionKey(session.key, session.label)}
        </option>
      ))}
    </select>
  );
}

// ---- Session Config Panel -------------------------------------------------

function SessionConfigPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { sessionConfig, updateSessionConfig } = useChatStore();
  const { models } = useModelsStore();

  if (!isOpen) return null;

  return (
    <div className="absolute top-12 right-0 z-10 w-80 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-2xl shadow-black/50">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Session Config</h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-100"
          type="button"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        {/* Model — transmitted via sessions.patch */}
        <div>
          <label htmlFor="model" className="mb-1 block text-xs text-zinc-400">
            Model
          </label>
          <select
            id="model"
            value={sessionConfig.model || ''}
            onChange={(e) => updateSessionConfig({ model: e.target.value || undefined })}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          >
            <option value="">Default</option>
            {models.map((m) => (
              <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Thinking Level — transmitted via sessions.patch */}
        <div>
          <label htmlFor="thinking" className="mb-1 block text-xs text-zinc-400">
            Thinking Level
          </label>
          <select
            id="thinking"
            value={sessionConfig.thinkingLevel || 'medium'}
            onChange={(e) =>
              updateSessionConfig({
                thinkingLevel: e.target.value as SessionConfig['thinkingLevel'],
              })
            }
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          >
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Divider before local-only controls */}
        <div className="border-t border-zinc-800 pt-2">
          <p className="mb-2 text-xs text-zinc-600">
            The following settings are stored locally only and are not persisted to the gateway.
          </p>
        </div>

        {/* Temperature — local only, not transmitted */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="temperature" className="text-xs text-zinc-500">
              Temperature: {sessionConfig.temperature?.toFixed(1) || '1.0'}
            </label>
            <span className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-600">
              local only
            </span>
          </div>
          <input
            type="range"
            id="temperature"
            min="0"
            max="1"
            step="0.1"
            value={sessionConfig.temperature || 1.0}
            onChange={(e) => updateSessionConfig({ temperature: parseFloat(e.target.value) })}
            className="w-full opacity-50"
          />
        </div>

        {/* Max Tokens — local only, not transmitted */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="maxTokens" className="text-xs text-zinc-500">
              Max Tokens
            </label>
            <span className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-600">
              local only
            </span>
          </div>
          <input
            type="number"
            id="maxTokens"
            value={sessionConfig.maxTokens || ''}
            onChange={(e) =>
              updateSessionConfig({
                maxTokens: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
            placeholder="Default"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-sm text-zinc-500 placeholder:text-zinc-700 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/30 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// ---- Tool Use Block -------------------------------------------------------

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

// ---- Tool Result Block ----------------------------------------------------

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

// ---- Thinking Block -------------------------------------------------------

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

// ---- Message Bubble -------------------------------------------------------

/**
 * Detect system messages that are internal gateway metadata — not useful for
 * human display. These include channel status updates, conversation info blocks,
 * and untrusted metadata injections.
 */
function isGatewayMetadata(message: Message): boolean {
  if (message.role !== 'system') return false;
  const text = message.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('\n');
  // Conversation info / untrusted metadata blocks
  if (/\b(untrusted metadata|conversation.info|conversation_label)\b/i.test(text)) return true;
  // Channel connect/disconnect status lines
  if (/^\[?\d{4}-\d{2}-\d{2}.*\b(connected|disconnected|status \d+)\b/i.test(text)) return true;
  // Reply-to instruction metadata
  if (/\[\[reply_to_current\]\]/i.test(text)) return true;
  return false;
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isInjected = message.metadata?.injected === true;
  const [showMetadata, setShowMetadata] = useState(false);

  // Collapse internal gateway metadata into a small toggle
  if (isGatewayMetadata(message)) {
    const preview = message.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join(' ')
      .slice(0, 60);
    return (
      <div className="mb-1 flex justify-center">
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

  // Partition content blocks by type
  const textBlocks = message.content.filter((c) => c.type === 'text');
  const images = message.content.filter((c) => c.type === 'image');
  const files = message.content.filter((c) => c.type === 'file');
  const toolUseBlocks = message.content.filter((c) => c.type === 'tool_use');
  const toolResultBlocks = message.content.filter((c) => c.type === 'tool_result');
  const thinkingBlocks = message.content.filter((c) => c.type === 'thinking');

  // Combine text content for markdown rendering, stripping internal markers
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
        {/* Message header */}
        <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium">
            {isUser ? 'You' : isSystem ? 'System' : isInjected ? 'Injected Note' : 'Assistant'}
          </span>
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {message.model && <span className="text-zinc-600">({message.model})</span>}
        </div>

        {/* Thinking blocks (shown before main content) */}
        {thinkingBlocks.map((block, idx) => (
          <ThinkingBlock key={idx} text={block.text} />
        ))}

        {/* Images */}
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

        {/* Files */}
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

        {/* Tool use blocks */}
        {toolUseBlocks.map((block, idx) => (
          <ToolUseBlock key={idx} name={block.toolName} input={block.input} />
        ))}

        {/* Tool result blocks */}
        {toolResultBlocks.map((block, idx) => (
          <ToolResultBlock key={idx} output={block.output} isError={block.isError} />
        ))}

        {/* Text content */}
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

        {/* Token count */}
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

// ---- Streaming Indicator --------------------------------------------------

function StreamingIndicator() {
  return (
    <div className="animate-fade-in mb-3 flex justify-start">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
              style={{ animationDelay: '0.2s' }}
            />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
          <span className="text-sm text-zinc-400">Streaming...</span>
        </div>
      </div>
    </div>
  );
}

// ---- Attachment Preview ---------------------------------------------------

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const isImage = attachment.type.startsWith('image/');

  return (
    <div className="relative inline-block">
      {isImage ? (
        <div className="group relative">
          <img
            src={attachment.url || `data:${attachment.type};base64,${attachment.data}`}
            alt={attachment.name}
            className="h-16 w-16 rounded-md border border-zinc-700 object-cover"
          />
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 hidden rounded-full bg-zinc-900 p-1 text-xs text-zinc-400 group-hover:block hover:text-red-400"
            type="button"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="group relative flex h-16 w-32 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2">
          <span className="text-xl">📎</span>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-xs text-zinc-400">{attachment.name}</div>
            <div className="text-xs text-zinc-600">{(attachment.size / 1024).toFixed(1)} KB</div>
          </div>
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 hidden rounded-full bg-zinc-950 p-1 text-xs text-zinc-400 group-hover:block hover:text-red-400"
            type="button"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Message Input --------------------------------------------------------

function MessageInput() {
  const {
    sendMessage,
    isStreaming,
    abortStream,
    attachments,
    addAttachment,
    addMultipleAttachments,
    removeAttachment,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isStreaming) return;

    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd+Enter or Ctrl+Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix to get just the base64 data
        const data = base64.split(',')[1] || base64;

        const attachment: Attachment = {
          id: '',
          name: file.name,
          type: file.type,
          size: file.size,
          data,
          url: base64,
        };

        addAttachment(attachment);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBulkUpload = () => {
    bulkFileInputRef.current?.click();
  };

  const handleBulkFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    addMultipleAttachments(Array.from(files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          handleFileSelect(dt.files);
        }
      }
    }
  };

  return (
    <div
      className={`border-t border-zinc-700 bg-zinc-900 p-3 ${isDragging ? 'bg-zinc-800' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Attachments</span>
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
              {attachments.length}
            </span>
            <span className="text-xs text-zinc-600">will be sent to the model</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentPreview
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 rounded-md bg-zinc-800 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          type="button"
          aria-label="Attach file"
        >
          📎
        </button>

        {/* Bulk Upload button */}
        <button
          onClick={handleBulkUpload}
          className="flex-shrink-0 rounded-md bg-zinc-800 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          type="button"
          aria-label="Bulk upload files"
          title="Bulk Upload"
        >
          📁
        </button>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <input
          ref={bulkFileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleBulkFileSelect(e.target.files);
            // Reset so the same files can be selected again
            if (bulkFileInputRef.current) {
              bulkFileInputRef.current.value = '';
            }
          }}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isStreaming ? 'Waiting for response...' : 'Message (Cmd+Enter to send)...'}
          disabled={isStreaming}
          className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none disabled:opacity-50"
          rows={1}
          style={{ maxHeight: '200px' }}
        />

        {/* Send or Abort button */}
        {isStreaming ? (
          <button
            onClick={abortStream}
            className="flex-shrink-0 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
            type="button"
          >
            Abort
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() && attachments.length === 0}
            className="flex-shrink-0 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            Send
          </button>
        )}
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-900/90">
          <div className="rounded-lg border-2 border-dashed border-amber-500 p-6">
            <p className="text-amber-400">Drop files here</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Chat View -------------------------------------------------------

export function Chat() {
  const {
    messages,
    isStreaming,
    streamingMessageId,
    activeSessionKey,
    loadHistory,
    subscribeToEvents,
    unsubscribeFromEvents,
    error,
  } = useChatStore();
  const { status } = useConnectionStore();
  const [showConfig, setShowConfig] = useState(false);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

  // Load history when session changes
  useEffect(() => {
    if (activeSessionKey && status === 'connected') {
      loadHistory(activeSessionKey);
    }
  }, [activeSessionKey, status, loadHistory]);

  // Subscribe to events when session is active
  useEffect(() => {
    if (activeSessionKey && status === 'connected') {
      subscribeToEvents();
    }
    return () => {
      unsubscribeFromEvents();
    };
  }, [activeSessionKey, status, subscribeToEvents, unsubscribeFromEvents]);

  // Auto-scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (isScrolledToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScrolledToBottom]);

  // Track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsScrolledToBottom(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Chat</h2>
          <SessionSelector />
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-500'
                  : status === 'error'
                    ? 'bg-red-500'
                    : 'bg-zinc-500'
              }`}
            />
            <span className="text-xs text-zinc-400">{status}</span>
          </div>

          {/* Config button */}
          <div className="relative">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Config
            </button>
            <SessionConfigPanel isOpen={showConfig} onClose={() => setShowConfig(false)} />
          </div>

          {/* Inject note button */}
          <button
            onClick={() => setShowInjectModal(true)}
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Inject Note
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">
              {status === 'connected' ? 'Start a conversation...' : 'Connecting to gateway...'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && msg.id === streamingMessageId}
          />
        ))}

        {isStreaming && !streamingMessageId && <StreamingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isScrolledToBottom && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute right-6 bottom-24 rounded-full bg-zinc-800 p-2 text-zinc-400 shadow-lg hover:bg-zinc-700 hover:text-zinc-100"
          type="button"
          aria-label="Scroll to bottom"
        >
          ↓
        </button>
      )}

      {/* Input area */}
      <MessageInput />

      {/* Inject Note Modal */}
      {showInjectModal && <InjectNoteModal onClose={() => setShowInjectModal(false)} />}
    </div>
  );
}

// ---- Inject Note Modal ----------------------------------------------------

function InjectNoteModal({ onClose }: { onClose: () => void }) {
  const { injectNote } = useChatStore();
  const [note, setNote] = useState('');

  const handleInject = () => {
    if (!note.trim()) return;
    injectNote(note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl shadow-black/50">
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">Inject Assistant Note</h3>
        <p className="mb-3 text-sm text-zinc-400">
          Add a note to the assistant's context without triggering a new response.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter note..."
          className="mb-3 w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          rows={6}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleInject}
            disabled={!note.trim()}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            Inject
          </button>
        </div>
      </div>
    </div>
  );
}
