import { classifyModel } from '@/lib/modelTiers';
import { Badge, type BadgeProps } from '@/components/ui/badge';

function resolveVariant(model: string, explicitTier?: string): NonNullable<BadgeProps['variant']> {
  const tier = (explicitTier ?? classifyModel(model).tier).toLowerCase();
  if (tier === 'free') return 'success';
  if (tier === 'cheap') return 'accent';
  if (tier === 'premium') return 'warning';
  if (tier === 'max') return 'outline';
  return 'default';
}

function modelLabel(model: string): string {
  const parts = model.split('/');
  return parts.length > 1 ? (parts[1] ?? model) : model;
}

export interface ModelBadgeProps {
  model: string;
  tier?: string;
  className?: string;
}

export function ModelBadge({ model, tier, className }: ModelBadgeProps) {
  return (
    <Badge variant={resolveVariant(model, tier)} className={className}>
      {modelLabel(model)}
    </Badge>
  );
}
