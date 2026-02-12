'use client';

import { useEffect, useRef, useState } from 'react';
import type { MemberCardData } from '@/types/member-card';
import type { CardTemplateConfig } from '@/types/member-card';

const MEMBER_CARDS_BASE = '/member-cards';

function getConfigUrl(templateName: string): string {
  return `${MEMBER_CARDS_BASE}/${templateName}/config.json`;
}

function getImageUrl(templateName: string): string {
  return `${MEMBER_CARDS_BASE}/${templateName}/${templateName}.jpeg`;
}

function getFieldValue(
  data: MemberCardData,
  key: keyof CardTemplateConfig['fields']
): string {
  let value = '';
  switch (key) {
    case 'schemeName':
      value = data.schemeName;
      break;
    case 'principalMemberName':
      value = data.principalMemberName;
      break;
    case 'insuredMemberName':
      value = data.insuredMemberName;
      break;
    case 'memberNumber':
      value = data.memberNumber ?? 'Not assigned';
      break;
    case 'dateOfBirth':
      value = data.dateOfBirth;
      break;
    case 'datePrinted':
      value = data.datePrinted;
      break;
    default:
      value = '';
  }
  return value.toUpperCase();
}

interface ImageBasedMemberCardProps {
  templateName: string;
  data: MemberCardData;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export default function ImageBasedMemberCard({
  templateName,
  data,
  className = '',
  onCanvasReady,
}: ImageBasedMemberCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAndDraw() {
      try {
        setError(null);
        const [configRes, img] = await Promise.all([
          fetch(getConfigUrl(templateName)),
          new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load template image'));
            image.src = getImageUrl(templateName);
          }),
        ]);

        if (cancelled) return;
        if (!configRes.ok) {
          setError('Template config not found');
          return;
        }

        const config: CardTemplateConfig = await configRes.json();
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not available');
          return;
        }

        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;

        ctx.drawImage(img, 0, 0);

        const defaults = config.defaults ?? {};
        const fontFamily = defaults.fontFamily ?? 'Arial, sans-serif';
        const defaultFontSize = defaults.fontSize ?? 12;
        const defaultColor = defaults.color ?? '#333333';
        const defaultWeight = defaults.fontWeight ?? 'normal';

        const fieldKeys = [
          'schemeName',
          'principalMemberName',
          'insuredMemberName',
          'memberNumber',
          'dateOfBirth',
          'datePrinted',
        ] as const;

        for (const key of fieldKeys) {
          const fieldConfig = config.fields[key];
          if (!fieldConfig) continue;

          const value = getFieldValue(data, key);
          const fontSize = fieldConfig.fontSize ?? defaultFontSize;
          const color = fieldConfig.color ?? defaultColor;
          const fontWeight = fieldConfig.fontWeight ?? defaultWeight;
          const family = fieldConfig.fontFamily ?? fontFamily;

          ctx.fillStyle = color;
          ctx.font = `${fontWeight} ${fontSize}px ${family}`;
          ctx.textBaseline = 'top';
          ctx.fillText(value, fieldConfig.x, fieldConfig.y);
        }

        if (!cancelled) {
          setLoaded(true);
          onCanvasReady?.(canvas);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load card');
        }
      }
    }

    loadAndDraw();
    return () => {
      cancelled = true;
    };
  }, [templateName, data, onCanvasReady]);

  if (error) {
    return (
      <div
        className={`rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive ${className}`}
      >
        {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="max-w-full rounded-lg border border-border"
        style={{
          display: loaded ? 'block' : 'none',
          width: '100%',
          height: 'auto',
        }}
      />
      {!loaded && (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          Loading card…
        </div>
      )}
    </div>
  );
}

export { getConfigUrl };
