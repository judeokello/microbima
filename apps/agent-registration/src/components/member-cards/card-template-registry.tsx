'use client';

import type { MemberCardData } from '@/types/member-card';
import DefaultCardTemplate from './templates/DefaultCardTemplate';
import WellnessCardTemplate from './templates/WellnessCardTemplate';

export type CardTemplateComponent = React.ComponentType<{
  data: MemberCardData;
  className?: string;
}>;

export const CARD_TEMPLATE_REGISTRY: Record<string, CardTemplateComponent> = {
  default: DefaultCardTemplate,
  WellnessCard: WellnessCardTemplate,
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
