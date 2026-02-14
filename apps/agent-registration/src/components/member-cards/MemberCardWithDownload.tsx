'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { MemberCardData } from '@/types/member-card';
import { getCardTemplateComponent } from './card-template-registry';
import ImageBasedMemberCard, { getConfigUrl } from './ImageBasedMemberCard';

const DEFAULT_IMAGE_TEMPLATE = 'DefaultWellnessCard';

interface MemberCardWithDownloadProps {
  data: MemberCardData;
  templateName: string | null | undefined;
  className?: string;
  /** When false, download button is hidden (e.g. for package preview). Default true. */
  showDownloadButton?: boolean;
}

export default function MemberCardWithDownload({
  data,
  templateName,
  className,
  showDownloadButton = true,
}: MemberCardWithDownloadProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [effectiveTemplateName, setEffectiveTemplateName] = useState<
    string | null | 'loading'
  >('loading');
  const canvasRefForDownload = useRef<HTMLCanvasElement | null>(null);

  const name = templateName?.trim();

  useEffect(() => {
    let cancelled = false;

    async function resolveTemplate() {
      // 1. If package.cardTemplateName is set, try that template first
      if (name) {
        const res = await fetch(getConfigUrl(name));
        if (cancelled) return;
        if (res.ok) {
          setEffectiveTemplateName(name);
          return;
        }
      }

      // 2. Fallback to DefaultWellnessCard
      const defaultRes = await fetch(getConfigUrl(DEFAULT_IMAGE_TEMPLATE));
      if (cancelled) return;
      if (defaultRes.ok) {
        setEffectiveTemplateName(DEFAULT_IMAGE_TEMPLATE);
        return;
      }

      // 3. Last resort: DefaultCardTemplate component (always exists)
      setEffectiveTemplateName(null);
    }

    resolveTemplate();
    return () => {
      cancelled = true;
    };
  }, [name]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRefForDownload.current = canvas;
  }, []);

  const handleDownload = async () => {
    if (canvasRefForDownload.current) {
      try {
        const dataUrl = canvasRefForDownload.current.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `member-card-${data.insuredMemberName.replace(/\s+/g, '-')}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to export card as PNG', err);
      }
      return;
    }
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

  const canDownload =
    showDownloadButton &&
    (data.memberNumber != null && data.memberNumber !== '');

  const renderDownloadButton = () =>
    showDownloadButton ? (
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
    ) : null;

  if (effectiveTemplateName === 'loading') {
    return (
      <div className="space-y-2">
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          Loading…
        </div>
        {showDownloadButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </Button>
        )}
      </div>
    );
  }

  if (effectiveTemplateName) {
    return (
      <div className="space-y-2">
        <div ref={cardRef}>
          <ImageBasedMemberCard
            templateName={effectiveTemplateName}
            data={data}
            className={className}
            onCanvasReady={handleCanvasReady}
          />
        </div>
        {renderDownloadButton()}
      </div>
    );
  }

  const CardTemplate = getCardTemplateComponent(null);
  return (
    <div className="space-y-2">
      <div ref={cardRef}>
        <CardTemplate data={data} className={className} />
      </div>
      {renderDownloadButton()}
    </div>
  );
}
