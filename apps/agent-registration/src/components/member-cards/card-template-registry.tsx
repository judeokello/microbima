'use client';

import type { MemberCardData } from '@/types/member-card';
import DefaultCardTemplate from './templates/DefaultCardTemplate';

export type CardTemplateComponent = React.ComponentType<{
  data: MemberCardData;
  className?: string;
}>;

/**
 * Registry for component-based card templates.
 * Only used as fallback when no image template exists (config.json 404).
 * New templates should be added as image templates (public/member-cards/{name}/)
 * with no code changes required.
 */
export const CARD_TEMPLATE_REGISTRY: Record<string, CardTemplateComponent> = {
  default: DefaultCardTemplate,
};

export function getCardTemplateComponent(
  templateName: string | null | undefined
): CardTemplateComponent {
  const name = templateName?.trim();
  if (name && name in CARD_TEMPLATE_REGISTRY) {
    return CARD_TEMPLATE_REGISTRY[name];
  }
  return CARD_TEMPLATE_REGISTRY.default;
}
