// ---------------------------------------------------------------------------
// Skills View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useSkillsStore } from '@/stores/skills';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import type { Skill } from '@/stores/skills';

// ---- Skill Card -----------------------------------------------------------

function SkillCard({ skill }: { skill: Skill }) {
  const { enableSkill, disableSkill, uninstallSkill } = useSkillsStore();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${skill.enabled ? 'bg-emerald-500' : 'bg-zinc-500'}`}
          />
          <h3 className="text-sm font-semibold text-zinc-100">{skill.name}</h3>
          <span className="text-xs text-zinc-500">v{skill.version}</span>
        </div>
        <button
          onClick={() => setShowActions(!showActions)}
          className="text-zinc-400 hover:text-zinc-100"
          type="button"
        >
          •••
        </button>
      </div>

      {skill.description && <p className="mb-2 text-xs text-zinc-400">{skill.description}</p>}

      <div className="space-y-1 text-xs">
        {skill.author && <div className="text-zinc-500">By: {skill.author}</div>}
        {skill.capabilities && skill.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skill.capabilities.map((cap, idx) => (
              <span key={idx} className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">
                {cap}
              </span>
            ))}
          </div>
        )}
      </div>

      {showActions && !showDeleteConfirm && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => (skill.enabled ? disableSkill(skill.id) : enableSkill(skill.id))}
            className={`rounded px-3 py-1 text-xs ${
              skill.enabled ? 'bg-zinc-700 text-zinc-300' : 'bg-emerald-500/20 text-emerald-400'
            }`}
            type="button"
          >
            {skill.enabled ? 'Disable' : 'Enable'}
          </button>
          {skill.installed && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded bg-red-500/10 px-3 py-1 text-xs text-red-400"
              type="button"
            >
              Uninstall
            </button>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="mt-3 rounded bg-red-500/5 p-2">
          <p className="mb-2 text-xs text-red-400">Uninstall {skill.name}?</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await uninstallSkill(skill.id);
                setShowDeleteConfirm(false);
              }}
              className="flex-1 rounded bg-red-500 px-3 py-1 text-xs text-zinc-950"
              type="button"
            >
              Uninstall
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Skill Row (Desktop) --------------------------------------------------

function SkillRow({ skill }: { skill: Skill }) {
  const { enableSkill, disableSkill, uninstallSkill } = useSkillsStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <tr className="border-b border-zinc-700 hover:bg-zinc-800/50">
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${skill.enabled ? 'bg-emerald-500' : 'bg-zinc-500'}`}
            />
            <span className="text-sm font-medium text-zinc-100">{skill.name}</span>
          </div>
        </td>
        <td className="p-3 text-sm text-zinc-400">{skill.version}</td>
        <td className="p-3 text-sm text-zinc-400">{skill.description || '—'}</td>
        <td className="p-3 text-sm text-zinc-400">{skill.author || '—'}</td>
        <td className="p-3">
          <div className="flex gap-1">
            <button
              onClick={() => (skill.enabled ? disableSkill(skill.id) : enableSkill(skill.id))}
              className={`rounded px-2 py-1 text-xs ${
                skill.enabled ? 'bg-zinc-700 text-zinc-300' : 'bg-emerald-500/20 text-emerald-400'
              }`}
              type="button"
            >
              {skill.enabled ? 'Disable' : 'Enable'}
            </button>
            {skill.installed && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400"
                type="button"
              >
                Uninstall
              </button>
            )}
          </div>
        </td>
      </tr>

      {showDeleteConfirm && (
        <tr>
          <td colSpan={5} className="bg-red-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400">Uninstall {skill.name}?</span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await uninstallSkill(skill.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="rounded-md bg-red-500 px-3 py-1 text-xs text-zinc-950"
                  type="button"
                >
                  Uninstall
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---- Main Skills View -----------------------------------------------------

export function Skills() {
  const { skills, isLoading, error, loadSkills, subscribeToEvents, unsubscribeFromEvents } =
    useSkillsStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (status === 'connected') {
      loadSkills();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadSkills, subscribeToEvents, unsubscribeFromEvents]);

  const installedSkills = skills.filter((s) => s.installed);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Skills</h1>
        <p className="text-sm text-zinc-400">Installed skills and capabilities</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-sm text-zinc-400">Loading skills...</div>
        ) : installedSkills.length === 0 ? (
          <div className="text-sm text-zinc-400">No skills installed yet.</div>
        ) : isMobile ? (
          <div className="space-y-3">
            {installedSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Name</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Version</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Description</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Author</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {installedSkills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
