// ---------------------------------------------------------------------------
// Skills View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { useSkillsStore, type SkillStatus } from '@/stores/skills';
import { useConnectionStore } from '@/stores/connection';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';

// ---- Environment Variable Editor ------------------------------------------

function EnvEditor({
  env,
  onSave,
}: {
  env: Record<string, string>;
  onSave: (env: Record<string, string>) => void;
}) {
  const [entries, setEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(env).map(([key, value]) => ({ key, value }))
  );
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const handleUpdate = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...entries];
    const existing = updated[index];
    if (existing) {
      updated[index] = { ...existing, [field]: val };
    }
    setEntries(updated);
    setIsDirty(true);
  };

  const handleRemove = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    setEntries([...entries, { key: newKey.trim(), value: newValue }]);
    setNewKey('');
    setNewValue('');
    setIsDirty(true);
  };

  const handleSave = () => {
    const envMap: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.key.trim()) {
        envMap[entry.key.trim()] = entry.value;
      }
    }
    onSave(envMap);
    setIsDirty(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="text-xs font-medium text-zinc-400">Environment Variables</div>

      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={entry.key}
            onChange={(e) => handleUpdate(i, 'key', e.target.value)}
            placeholder="KEY"
            className="w-32 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <span className="text-xs text-zinc-500">=</span>
          <input
            type="text"
            value={entry.value}
            onChange={(e) => handleUpdate(i, 'value', e.target.value)}
            placeholder="value"
            className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={() => handleRemove(i)}
            className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
            type="button"
          >
            Remove
          </button>
        </div>
      ))}

      {/* Add new entry row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="NEW_KEY"
          className="w-32 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <span className="text-xs text-zinc-500">=</span>
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="value"
          className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newKey.trim()}
          className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
          type="button"
        >
          Add
        </button>
      </div>

      {isDirty && (
        <button
          onClick={handleSave}
          className="rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-amber-400"
          type="button"
        >
          Save Env
        </button>
      )}
    </div>
  );
}

// ---- Skill Card Component -------------------------------------------------

function SkillCard({ skill }: { skill: SkillStatus }) {
  const { updateSkill } = useSkillsStore();
  const [expanded, setExpanded] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    await updateSkill(skill.key, { enabled: !skill.enabled });
    setIsToggling(false);
  };

  const handleEnvSave = (env: Record<string, string>) => {
    updateSkill(skill.key, { env });
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">{skill.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                skill.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {skill.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="text-xs text-zinc-500">Key: {skill.key}</div>
          {skill.version && <div className="text-xs text-zinc-500">Version: {skill.version}</div>}
          {skill.description && (
            <div className="mt-1 text-xs text-zinc-400">{skill.description}</div>
          )}
          {skill.error && <div className="mt-1 text-xs text-red-400">{skill.error}</div>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
            type="button"
          >
            {expanded ? 'Collapse' : 'Config'}
          </button>
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
              skill.enabled
                ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
            }`}
            type="button"
          >
            {isToggling ? '...' : skill.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-zinc-700 pt-3">
          <EnvEditor env={skill.env ?? {}} onSave={handleEnvSave} />
        </div>
      )}
    </div>
  );
}

// ---- Install Skill Panel --------------------------------------------------

function InstallPanel() {
  const { installSkill, bins } = useSkillsStore();
  const [name, setName] = useState('');
  const [installId, setInstallId] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    if (!name.trim() || !installId.trim()) return;
    setIsInstalling(true);
    await installSkill(name.trim(), installId.trim());
    setName('');
    setInstallId('');
    setIsInstalling(false);
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <h3 className="mb-3 text-sm font-medium text-zinc-100">Install Skill</h3>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Skill name"
            list="skill-bins"
            className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <datalist id="skill-bins">
            {bins.map((bin) => (
              <option key={bin} value={bin} />
            ))}
          </datalist>
          <input
            type="text"
            value={installId}
            onChange={(e) => setInstallId(e.target.value)}
            placeholder="Install ID"
            className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInstall();
            }}
          />
          <button
            onClick={handleInstall}
            disabled={!name.trim() || !installId.trim() || isInstalling}
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
        </div>

        {bins.length > 0 && (
          <div className="text-xs text-zinc-500">Available bins: {bins.join(', ')}</div>
        )}
      </div>
    </div>
  );
}

// ---- Main Skills View -----------------------------------------------------

export function Skills() {
  const { skills, isLoading, error, loadSkills, loadBins } = useSkillsStore();

  const { status } = useConnectionStore();

  const load = useCallback(() => {
    loadSkills();
    loadBins();
  }, [loadSkills, loadBins]);

  useEffect(() => {
    if (status === 'connected') {
      load();
    }
  }, [status, load]);

  const enabledSkills = skills.filter((s) => s.enabled);
  const disabledSkills = skills.filter((s) => !s.enabled);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Skills</h1>
        <p className="text-sm text-zinc-400">Installed skills management</p>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={load}
            disabled={isLoading}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <span className="text-xs text-zinc-500">
            {skills.length} skill{skills.length !== 1 ? 's' : ''} installed
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && skills.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : isLoading && skills.length === 0 ? (
          <LoadingSpinner message="Loading skills..." />
        ) : (
          <div className="space-y-4">
            {/* Install Panel */}
            <InstallPanel />

            {/* Enabled Skills */}
            {enabledSkills.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium text-zinc-300">
                  Enabled ({enabledSkills.length})
                </h2>
                <div className="space-y-2">
                  {enabledSkills.map((skill) => (
                    <SkillCard key={skill.key} skill={skill} />
                  ))}
                </div>
              </div>
            )}

            {/* Disabled Skills */}
            {disabledSkills.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium text-zinc-300">
                  Disabled ({disabledSkills.length})
                </h2>
                <div className="space-y-2">
                  {disabledSkills.map((skill) => (
                    <SkillCard key={skill.key} skill={skill} />
                  ))}
                </div>
              </div>
            )}

            {skills.length === 0 && !isLoading && (
              <EmptyState
                message="No skills installed"
                detail="Use the install panel above to add a skill."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
