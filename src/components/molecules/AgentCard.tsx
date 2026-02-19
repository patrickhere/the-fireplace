import { useState } from 'react';
import type { Agent } from '@/stores/agents';
import { ModelBadge } from '@/components/atoms/ModelBadge';

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function FallbackChain({ fallbacks }: { fallbacks: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (fallbacks.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((current) => !current);
        }}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        {expanded ? 'Hide' : `+${fallbacks.length}`} fallback{fallbacks.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {fallbacks.map((fallback) => (
            <ModelBadge key={fallback} model={fallback} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentCard({ agent, isSelected, onSelect, onEdit, onDelete }: AgentCardProps) {
  return (
    <div
      className={`cursor-pointer rounded-lg border p-3 ${
        isSelected
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        {agent.identity?.emoji && <span className="text-lg">{agent.identity.emoji}</span>}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-zinc-100">{agent.name || agent.id}</span>
          {agent.model && (
            <div className="mt-0.5 flex items-center gap-1">
              <ModelBadge model={agent.model.primary} />
            </div>
          )}
        </div>
      </div>

      {agent.model && <FallbackChain fallbacks={agent.model.fallbacks} />}

      {isSelected && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Edit
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
            type="button"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
