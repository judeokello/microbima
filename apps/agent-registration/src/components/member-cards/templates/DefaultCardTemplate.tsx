'use client';

import type { MemberCardData } from '@/types/member-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface DefaultCardTemplateProps {
  data: MemberCardData;
  className?: string;
}

export default function DefaultCardTemplate({ data, className }: DefaultCardTemplateProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-muted-foreground">{data.schemeName}</p>
        <p className="text-xs text-muted-foreground">
          Principal: {data.principalMemberName}
        </p>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Insured: </span>
          {data.insuredMemberName}
        </p>
        <p>
          <span className="text-muted-foreground">Member No: </span>
          {data.memberNumber ?? 'Not assigned'}
        </p>
        <p>
          <span className="text-muted-foreground">DOB: </span>
          {data.dateOfBirth}
        </p>
        <p>
          <span className="text-muted-foreground">Date printed: </span>
          {data.datePrinted}
        </p>
      </CardContent>
    </Card>
  );
}
