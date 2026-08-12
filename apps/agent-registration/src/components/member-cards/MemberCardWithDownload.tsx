'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

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

  const openPreview = useCallback(async () => {
    if (canvasRefForDownload.current) {
      setPreviewSrc(canvasRefForDownload.current.toDataURL('image/png'));
      setPreviewOpen(true);
      return;
    }
    if (cardRef.current) {
      try {
        const dataUrl = await toPng(cardRef.current, {
          cacheBust: true,
          pixelRatio: 2,
        });
        setPreviewSrc(dataUrl);
        setPreviewOpen(true);
      } catch (err) {
        console.error('Failed to open card preview', err);
      }
      return;
    }
    setPreviewSrc(null);
    setPreviewOpen(true);
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

  const previewDialog = (
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] w-auto max-w-[min(96vw,56rem)] border-none bg-transparent p-0 shadow-none sm:max-w-[min(96vw,56rem)]"
        aria-describedby={undefined}
        onInteractOutside={() => setPreviewOpen(false)}
        onPointerDownOutside={() => setPreviewOpen(false)}
      >
        <DialogTitle className="sr-only">Member card preview</DialogTitle>
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={`Member card for ${data.insuredMemberName}`}
            className="mx-auto max-h-[90vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : effectiveTemplateName ? (
          <div className="mx-auto w-full max-w-3xl">
            <ImageBasedMemberCard
              templateName={effectiveTemplateName}
              data={data}
            />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md">
            {(() => {
              const CardTemplate = getCardTemplateComponent(null);
              return <CardTemplate data={data} />;
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

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
        <button
          type="button"
          className="block w-full cursor-zoom-in rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={openPreview}
          aria-label={`Enlarge member card for ${data.insuredMemberName}`}
        >
          <div ref={cardRef} className="pointer-events-none">
            <ImageBasedMemberCard
              templateName={effectiveTemplateName}
              data={data}
              className={className}
              onCanvasReady={handleCanvasReady}
            />
          </div>
        </button>
        {renderDownloadButton()}
        {previewDialog}
      </div>
    );
  }

  const CardTemplate = getCardTemplateComponent(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="block w-full cursor-zoom-in rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={openPreview}
        aria-label={`Enlarge member card for ${data.insuredMemberName}`}
      >
        <div ref={cardRef} className="pointer-events-none">
          <CardTemplate data={data} className={className} />
        </div>
      </button>
      {renderDownloadButton()}
      {previewDialog}
    </div>
  );
}
