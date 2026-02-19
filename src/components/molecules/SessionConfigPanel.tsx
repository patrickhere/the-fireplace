import { useChatStore, type SessionConfig } from '@/stores/chat';
import { useModelsStore } from '@/stores/models';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SessionConfigPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
        <div>
          <label htmlFor="model" className="mb-1 block text-xs text-zinc-400">
            Model
          </label>
          <Select
            value={sessionConfig.model || defaultModelToken}
            onValueChange={(value) =>
              updateSessionConfig({ model: value === defaultModelToken ? undefined : value })
            }
          >
            <SelectTrigger id="model">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={defaultModelToken}>Default</SelectItem>
              {models.map((m) => (
                <SelectItem key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="thinking" className="mb-1 block text-xs text-zinc-400">
            Thinking Level
          </label>
          <Select
            value={sessionConfig.thinkingLevel || 'medium'}
            onValueChange={(value) =>
              updateSessionConfig({ thinkingLevel: value as SessionConfig['thinkingLevel'] })
            }
          >
            <SelectTrigger id="thinking">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t border-zinc-800 pt-2">
          <p className="mb-2 text-xs text-zinc-600">
            The following settings are stored locally only and are not persisted to the gateway.
          </p>
        </div>

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
                maxTokens: e.target.value ? parseInt(e.target.value, 10) : undefined,
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
const defaultModelToken = '__default_model__';
