'use client';

import type { MemberCardData } from '@/types/member-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface WellnessCardTemplateProps {
  data: MemberCardData;
  className?: string;
}

/**
 * Alternative card layout (e.g. for Wellness package). Same fields as default.
 */
export default function WellnessCardTemplate({ data, className }: WellnessCardTemplateProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2 border-b">
        <p className="text-lg font-semibold">{data.schemeName}</p>
        <p className="text-sm text-muted-foreground">
          Principal: {data.principalMemberName}
        </p>
      </CardHeader>
      <CardContent className="pt-3 space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Insured member: </span>
          {data.insuredMemberName}
        </div>
        <div>
          <span className="text-muted-foreground">Member number: </span>
          {data.memberNumber ?? 'Not assigned'}
        </div>
        <div>
          <span className="text-muted-foreground">Date of birth: </span>
          {data.dateOfBirth}
        </div>
        <div>
          <span className="text-muted-foreground">Date printed: </span>
          {data.datePrinted}
        </div>
      </CardContent>
    </Card>
  );
}
