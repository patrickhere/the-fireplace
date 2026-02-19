import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import type { AgentFile } from '@/stores/agents';

interface AgentEditorProps {
  selectedAgentId: string | null;
  selectedFile: AgentFile | null;
  fileContent: string | null;
  isSavingFile: boolean;
  onSave: (agentId: string, fileName: string, content: string) => void;
}

function getLanguageExtension(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'md':
    case 'markdown':
      return markdown();
    default:
      return undefined;
  }
}

export function AgentEditor({
  selectedAgentId,
  selectedFile,
  fileContent,
  isSavingFile,
  onSave,
}: AgentEditorProps) {
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    setEditorContent(fileContent || '');
  }, [fileContent]);

  const languageExtension = useMemo(
    () => (selectedFile ? getLanguageExtension(selectedFile.name) : undefined),
    [selectedFile]
  );

  if (!selectedAgentId || !selectedFile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Select a file
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{selectedFile.name}</div>
          <div className="text-xs text-zinc-500">{selectedFile.path}</div>
        </div>
        <button
          onClick={() => onSave(selectedAgentId, selectedFile.name, editorContent)}
          disabled={isSavingFile}
          className="rounded-md bg-amber-500 px-3 py-1 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          type="button"
        >
          {isSavingFile ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={editorContent}
          onChange={(value) => setEditorContent(value)}
          extensions={languageExtension ? [languageExtension] : []}
          theme="dark"
          className="h-full"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>
    </div>
  );
}
