'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { MemberCardData } from '@/types/member-card';
import { getCardTemplateComponent } from './card-template-registry';
import ImageBasedMemberCard, { getConfigUrl } from './ImageBasedMemberCard';

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
  const [useImageTemplate, setUseImageTemplate] = useState<boolean | null>(null);
  const canvasRefForDownload = useRef<HTMLCanvasElement | null>(null);

  const name = templateName?.trim();

  useEffect(() => {
    if (!name) {
      setUseImageTemplate(false);
      return;
    }
    let cancelled = false;
    fetch(getConfigUrl(name))
      .then((res) => {
        if (cancelled) return;
        setUseImageTemplate(res.ok);
      })
      .catch(() => {
        if (!cancelled) setUseImageTemplate(false);
      });
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

  if (useImageTemplate === null) {
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

  if (useImageTemplate && name) {
    return (
      <div className="space-y-2">
        <div ref={cardRef}>
          <ImageBasedMemberCard
            templateName={name}
            data={data}
            className={className}
            onCanvasReady={handleCanvasReady}
          />
        </div>
        {renderDownloadButton()}
      </div>
    );
  }

  const CardTemplate = getCardTemplateComponent(templateName);
  return (
    <div className="space-y-2">
      <div ref={cardRef}>
        <CardTemplate data={data} className={className} />
      </div>
      {renderDownloadButton()}
    </div>
  );
}
