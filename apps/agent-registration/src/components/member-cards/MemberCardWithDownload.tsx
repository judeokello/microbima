'use client';

import { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { MemberCardData } from '@/types/member-card';
import { getCardTemplateComponent } from './card-template-registry';

interface MemberCardWithDownloadProps {
  data: MemberCardData;
  templateName: string | null | undefined;
  className?: string;
}

export default function MemberCardWithDownload({
  data,
  templateName,
  className,
}: MemberCardWithDownloadProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `member-card-${data.insuredMemberName.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export card as PNG', err);
    }
  };

  const CardTemplate = getCardTemplateComponent(templateName);
  const canDownload = data.memberNumber != null && data.memberNumber !== '';

  return (
    <div className="space-y-2">
      <div ref={cardRef}>
        <CardTemplate data={data} className={className} />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={!canDownload}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Download PNG
      </Button>
    </div>
  );
}
