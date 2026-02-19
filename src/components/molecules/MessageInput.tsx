import { useEffect, useRef, useState } from 'react';

import { useChatStore, type Attachment } from '@/stores/chat';

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

export function MessageInput() {
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isStreaming) return;
    void sendMessage(input);
    setInput('');
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const data = base64.split(',')[1] || base64;
        addAttachment({
          id: '',
          name: file.name,
          type: file.type,
          size: file.size,
          data,
          url: base64,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div
      className={`relative border-t border-zinc-700 bg-zinc-900 p-3 ${isDragging ? 'bg-zinc-800' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
      }}
    >
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

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 rounded-md bg-zinc-800 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          type="button"
          aria-label="Attach file"
        >
          📎
        </button>
        <button
          onClick={() => bulkFileInputRef.current?.click()}
          className="flex-shrink-0 rounded-md bg-zinc-800 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          type="button"
          aria-label="Bulk upload files"
          title="Bulk Upload"
        >
          📁
        </button>

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
            if (e.target.files?.length) addMultipleAttachments(Array.from(e.target.files));
            if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
          }}
        />

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          onPaste={(e) => {
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
          }}
          placeholder={isStreaming ? 'Waiting for response...' : 'Message (Cmd+Enter to send)...'}
          disabled={isStreaming}
          className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none disabled:opacity-50"
          rows={1}
          style={{ maxHeight: '200px' }}
        />

        {isStreaming ? (
          <button
            onClick={() => void abortStream()}
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
