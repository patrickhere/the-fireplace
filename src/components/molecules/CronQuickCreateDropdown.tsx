import { useState } from 'react';
import type { CronTemplate } from '@/components/organisms/CronCreateModal';

export function CronQuickCreateDropdown({
  templates,
  onSelect,
}: {
  templates: CronTemplate[];
  onSelect: (template: CronTemplate) => void;
}) {
  const [open, setOpen] = useState(false);

  // Split into task templates and pulse templates (name ends with -pulse)
  const taskTemplates = templates.filter((t) => !t.name.endsWith('-pulse'));
  const pulseTemplates = templates.filter((t) => t.name.endsWith('-pulse'));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
        type="button"
      >
        Quick Create
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
            {taskTemplates.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium tracking-wider text-zinc-600 uppercase">
                  Tasks
                </div>
                {taskTemplates.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => {
                      onSelect(template);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-zinc-800"
                    type="button"
                  >
                    <span className="text-sm text-zinc-100">{template.label}</span>
                    <span className="text-xs text-zinc-500">{template.description}</span>
                  </button>
                ))}
              </>
            )}
            {pulseTemplates.length > 0 && (
              <>
                <div className="mx-3 my-1 border-t border-zinc-800" />
                <div className="px-3 py-1.5 text-xs font-medium tracking-wider text-zinc-600 uppercase">
                  Demon Pulses
                </div>
                {pulseTemplates.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => {
                      onSelect(template);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-zinc-800"
                    type="button"
                  >
                    <span className="text-sm text-zinc-100">{template.label}</span>
                    <span className="text-xs text-zinc-500">{template.description}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
