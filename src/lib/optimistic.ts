import { toast } from 'sonner';

interface OptimisticOptions<TState, TResult> {
  snapshot: (state: TState) => Partial<TState>;
  apply: (state: TState) => Partial<TState>;
  execute: () => Promise<TResult>;
  errorMessage?: string;
}

export async function optimisticMutation<TState, TResult>(
  get: () => TState,
  set: (partial: Partial<TState>) => void,
  options: OptimisticOptions<TState, TResult>
): Promise<TResult> {
  const current = get();
  const previous = options.snapshot(current);
  const next = options.apply(current);

  set(next);

  try {
    return await options.execute();
  } catch (err) {
    set(previous);
    if (options.errorMessage) {
      toast.error(options.errorMessage);
    }
    throw err;
  }
}
