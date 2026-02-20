import { useEffect, useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useDemonMemoryStore } from '@/stores/demonMemory';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';

const DEMON_IDS = ['calcifer', 'buer', 'paimon', 'alloces', 'dantalion', 'andromalius', 'malphas'];

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year!, month! - 1, day!);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DemonMemory() {
  const agents = useAgentsStore((s) => s.agents);
  const {
    selectedDemon,
    entries,
    currentEntry,
    isLoading,
    isSaving,
    activeTab,
    sharedEntries,
    currentShared,
    selectDemon,
    loadEntries,
    loadEntry,
    saveEntry,
    createTodayEntry,
    setActiveTab,
    loadSharedEntries,
    loadSharedEntry,
    saveSharedEntry,
  } = useDemonMemoryStore();

  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (agents.length === 0) {
      void useAgentsStore.getState().loadAgents();
    }
  }, [agents.length]);

  useEffect(() => {
    if (currentEntry) {
      setEditorContent(currentEntry.content);
      setIsDirty(false);
    }
  }, [currentEntry]);

  useEffect(() => {
    if (currentShared) {
      setEditorContent(currentShared.content);
      setIsDirty(false);
    }
  }, [currentShared]);

  function handleSelectDemon(demonId: string) {
    selectDemon(demonId);
    void loadEntries(demonId);
  }

  function handleSelectDate(date: string) {
    if (!selectedDemon) return;
    void loadEntry(selectedDemon, date);
  }

  function handleEditorChange(value: string) {
    setEditorContent(value);
    const original =
      activeTab === 'shared' ? (currentShared?.content ?? '') : (currentEntry?.content ?? '');
    setIsDirty(value !== original);
  }

  function handleSave() {
    if (activeTab === 'shared' && currentShared) {
      void saveSharedEntry(currentShared.topic, editorContent);
      setIsDirty(false);
      return;
    }
    if (!selectedDemon || !currentEntry) return;
    void saveEntry(selectedDemon, currentEntry.date, editorContent);
    setIsDirty(false);
  }

  function handleNewEntry() {
    if (!selectedDemon) return;
    void createTodayEntry(selectedDemon);
  }

  function handleTabSwitch(tab: 'daily' | 'shared') {
    setActiveTab(tab);
    setEditorContent('');
    setIsDirty(false);
    if (tab === 'shared') {
      void loadSharedEntries();
    }
  }

  function handleSelectSharedEntry(topic: string) {
    void loadSharedEntry(topic);
  }

  function handleCreateSharedTopic() {
    if (!newTopicName.trim()) return;
    const topic = newTopicName.trim().toLowerCase().replace(/\s+/g, '-');
    const content = `# ${newTopicName.trim()}\n\nShared knowledge base entry.\n`;
    void saveSharedEntry(topic, content);
    setNewTopicName('');
  }

  const handleExport = useCallback(async () => {
    try {
      const defaultName =
        activeTab === 'shared'
          ? `shared-${currentShared?.topic ?? 'entry'}.md`
          : `${selectedDemon ?? 'demon'}-${currentEntry?.date ?? 'entry'}.md`;
      const filePath = await save({
        title: 'Export Memory',
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, editorContent);
      toast.success('Memory exported');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg);
    }
  }, [editorContent, activeTab, currentShared, selectedDemon, currentEntry]);

  const handleImport = useCallback(async () => {
    try {
      const filePath = await open({
        title: 'Import Memory',
        multiple: false,
        directory: false,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!filePath) return;
      const content = await readTextFile(filePath);
      setEditorContent(content);
      setIsDirty(true);
      toast.success('Memory imported — review and save to apply');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(msg);
    }
  }, []);

  const demons = DEMON_IDS.map((id) => {
    const agent = agents.find((a) => a.id === id);
    return {
      id,
      name: agent?.identity?.name ?? id,
      emoji: agent?.identity?.emoji ?? '👤',
    };
  });

  return (
    <div className="flex h-full overflow-hidden bg-zinc-950">
      {/* Left panel — demon selector */}
      <div className="flex w-48 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-3">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Demons</h2>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {demons.map((demon) => (
            <li key={demon.id}>
              <button
                type="button"
                onClick={() => handleSelectDemon(demon.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                  selectedDemon === demon.id
                    ? 'border-l-2 border-amber-500 bg-amber-500/10 pl-1.5 text-amber-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                )}
              >
                <span className="text-base leading-none">{demon.emoji}</span>
                <span className="truncate capitalize">{demon.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Middle panel — entries / shared knowledge */}
      <div className="flex w-48 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800">
          <button
            type="button"
            onClick={() => handleTabSwitch('daily')}
            className={cn(
              'flex-1 px-2 py-2 text-xs font-medium transition-colors',
              activeTab === 'daily'
                ? 'border-b-2 border-amber-500 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('shared')}
            className={cn(
              'flex-1 px-2 py-2 text-xs font-medium transition-colors',
              activeTab === 'shared'
                ? 'border-b-2 border-amber-500 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Shared
          </button>
        </div>

        {activeTab === 'daily' ? (
          <>
            <div className="flex items-center justify-between border-b border-zinc-800 p-3">
              <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Entries
              </h2>
              <button
                type="button"
                onClick={handleNewEntry}
                disabled={!selectedDemon || isSaving}
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400 hover:bg-amber-500/25 disabled:opacity-40"
              >
                + Today
              </button>
            </div>

            {!selectedDemon ? (
              <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-zinc-600">
                Select a demon
              </div>
            ) : isLoading && entries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
                Loading...
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-zinc-600">
                No entries yet
              </div>
            ) : (
              <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
                {entries.map((entry) => {
                  const isActive = currentEntry?.date === entry.date;
                  const isToday = entry.date === today;
                  return (
                    <li key={entry.date}>
                      <button
                        type="button"
                        onClick={() => handleSelectDate(entry.date)}
                        className={cn(
                          'flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                          isActive
                            ? 'border-l-2 border-amber-500 bg-amber-500/10 pl-1.5'
                            : 'hover:bg-zinc-800'
                        )}
                      >
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isActive
                              ? 'text-amber-400'
                              : isToday
                                ? 'text-zinc-200'
                                : 'text-zinc-400'
                          )}
                        >
                          {formatDateLabel(entry.date)}
                          {isToday && (
                            <span className="ml-1.5 text-xs font-normal text-amber-500">today</span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-600">{entry.date}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-zinc-800 p-3">
              <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Topics
              </h2>
            </div>

            {/* New topic input */}
            <div className="flex gap-1 border-b border-zinc-800 p-2">
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSharedTopic()}
                placeholder="New topic..."
                className="min-w-0 flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:ring-1 focus:ring-amber-500/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateSharedTopic}
                disabled={!newTopicName.trim() || isSaving}
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400 hover:bg-amber-500/25 disabled:opacity-40"
              >
                +
              </button>
            </div>

            {isLoading && sharedEntries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
                Loading...
              </div>
            ) : sharedEntries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-zinc-600">
                No shared topics yet
              </div>
            ) : (
              <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
                {sharedEntries.map((entry) => {
                  const isActive = currentShared?.topic === entry.topic;
                  return (
                    <li key={entry.topic}>
                      <button
                        type="button"
                        onClick={() => handleSelectSharedEntry(entry.topic)}
                        className={cn(
                          'flex w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                          isActive
                            ? 'border-l-2 border-amber-500 bg-amber-500/10 pl-1.5 text-amber-400'
                            : 'text-zinc-400 hover:bg-zinc-800'
                        )}
                      >
                        <span className="truncate capitalize">
                          {entry.topic.replace(/-/g, ' ')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Right panel — editor */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Editor header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 p-3">
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">
              {activeTab === 'shared' ? 'Shared Knowledge' : 'Demon Memory'}
            </h1>
            {activeTab === 'shared' && currentShared ? (
              <p className="text-xs text-zinc-500">{currentShared.topic.replace(/-/g, ' ')}</p>
            ) : selectedDemon && currentEntry ? (
              <p className="text-xs text-zinc-500">
                {demons.find((d) => d.id === selectedDemon)?.name ?? selectedDemon} —{' '}
                {currentEntry.date}
              </p>
            ) : selectedDemon ? (
              <p className="text-xs text-zinc-500">
                {demons.find((d) => d.id === selectedDemon)?.name ?? selectedDemon}
              </p>
            ) : (
              <p className="text-xs text-zinc-600">Select a demon and entry to edit</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImport}
              className="rounded-md bg-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:bg-zinc-600"
            >
              Import
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!editorContent}
              className="rounded-md bg-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-40"
            >
              Export
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={
                !isDirty ||
                isSaving ||
                (activeTab === 'daily' && !currentEntry) ||
                (activeTab === 'shared' && !currentShared)
              }
              className="rounded-md bg-amber-500 px-3 py-1 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'shared' ? (
            !currentShared ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                {isLoading ? 'Loading...' : 'Select a topic or create a new one'}
              </div>
            ) : (
              <CodeMirror
                value={editorContent}
                onChange={handleEditorChange}
                extensions={[markdown()]}
                theme="dark"
                height="100%"
                className="h-full"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightSpecialChars: true,
                  foldGutter: false,
                  drawSelection: true,
                  dropCursor: true,
                  allowMultipleSelections: false,
                  indentOnInput: true,
                  bracketMatching: false,
                  closeBrackets: false,
                  autocompletion: false,
                  rectangularSelection: false,
                  crosshairCursor: false,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  searchKeymap: true,
                }}
              />
            )
          ) : !selectedDemon ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              Select a demon from the left panel
            </div>
          ) : !currentEntry ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              {isLoading ? 'Loading...' : "Select an entry or create today's entry"}
            </div>
          ) : (
            <CodeMirror
              value={editorContent}
              onChange={handleEditorChange}
              extensions={[markdown()]}
              theme="dark"
              height="100%"
              className="h-full"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                foldGutter: false,
                drawSelection: true,
                dropCursor: true,
                allowMultipleSelections: false,
                indentOnInput: true,
                bracketMatching: false,
                closeBrackets: false,
                autocompletion: false,
                rectangularSelection: false,
                crosshairCursor: false,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                searchKeymap: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
