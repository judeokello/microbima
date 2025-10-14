'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
  const [errorCount, setErrorCount] = useState(0);

  const triggerClientError = () => {
    setErrorCount(prev => prev + 1);
    // This will trigger a client-side error
    const error = new Error(`Client-side Sentry test error #${errorCount + 1}`);
    console.log('🔍 Triggering client error:', error.message);
    Sentry.captureException(error);
    console.log('✅ Error sent to Sentry before throwing');
    throw error;
  };

  const triggerClientErrorDirect = () => {
    setErrorCount(prev => prev + 1);
    // This will trigger a client-side error directly to Sentry
    const error = new Error(`Direct client-side Sentry test error #${errorCount + 1}`);
    console.log('🔍 Triggering direct client error:', error.message);
    Sentry.captureException(error);
    console.log('✅ Error sent to Sentry');
  };

  const triggerServerErrorViaApi = async () => {
    try {
      // This will trigger a server-side error via API call
      const response = await fetch('http://localhost:3001/api/debug-sentry-public', {
        method: 'GET',
        headers: {
          'x-correlation-id': `test-agent-${Date.now()}`,
          'x-api-key': 'mb_0dcf0acf0562ad7e49e2ed4452e651fd6db23b3f8ca50a8b12c63b5d702573ef'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error captured via API:', errorData);
        // Optionally capture this as a client-side error if the API call itself failed unexpectedly
        Sentry.captureException(new Error(`API call failed: ${response.status} - ${errorData.message ?? JSON.stringify(errorData)}`));
      } else {
        console.log('API call successful, server error should be in Sentry (API project)');
      }
    } catch (error) {
      console.error('Failed to trigger server error via API:', error);
      Sentry.captureException(error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-[450px]">
        <CardHeader>
          <CardTitle>Sentry Test Page</CardTitle>
          <SentryTraceMetadata />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Use these buttons to trigger different types of errors and verify Sentry integration.
          </p>

          <div className="space-y-2">
            <Button
              onClick={triggerClientError}
              variant="destructive"
              className="w-full"
            >
              Trigger Client-Side Error (Browser)
            </Button>
            <div className="text-xs text-gray-500">
              This will throw an error in the browser and should appear in Sentry under client-side errors.
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={triggerClientErrorDirect}
              variant="secondary"
              className="w-full"
            >
              Trigger Direct Client-Side Error (No Throw)
            </Button>
            <div className="text-xs text-gray-500">
              This will capture an error directly with Sentry without throwing, useful for non-fatal issues.
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={triggerServerErrorViaApi}
              variant="outline"
              className="w-full"
            >
              Trigger Server-Side Error (via API)
            </Button>
            <div className="text-xs text-gray-500">
              This calls the API's debug endpoint, which throws an error. This error should appear in the API project in Sentry.
            </div>
          </div>

          <div className="text-xs text-gray-400">
            Errors triggered: {errorCount}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const SentryTraceMetadata = () => {
  const traceId = Sentry.getActiveSpan()?.spanContext().traceId;
  const sentryTrace = Sentry.getTraceData();

  return (
    <div className="mt-2 text-xs text-gray-500">
      <p>
        <strong>Trace ID:</strong> {traceId ?? 'N/A'}
      </p>
      <p>
        <strong>Sentry Trace:</strong> {sentryTrace['sentry-trace'] ?? 'N/A'}
      </p>
    </div>
  );
};
