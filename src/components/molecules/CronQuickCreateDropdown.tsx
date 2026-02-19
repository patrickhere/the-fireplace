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
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
            {templates.map((template) => (
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
          </div>
        </>
      )}
    </div>
  );
}
