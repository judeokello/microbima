'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TruncatedDescriptionProps {
  description: string;
  fullDescription: string;
}

export function TruncatedDescription({
  description,
  fullDescription,
}: TruncatedDescriptionProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span>{description}</span>
      {fullDescription.length > 40 && (
        <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setTooltipOpen(!tooltipOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-md">
            <p>{fullDescription}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

