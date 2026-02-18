'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getMessagingDelivery, resendMessagingDelivery } from '@/lib/api';

interface DeliveryDetail {
  id: string;
  templateKey: string;
  channel: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  requestedLanguage: string;
  usedLanguage: string | null;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  renderedSubject: string | null;
  renderedBody: string | null;
  renderedTextBody: string | null;
  renderError: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; firstName: string; lastName: string; email?: string; phoneNumber?: string } | null;
  policy?: { id: string; policyNumber: string } | null;
  attachments?: Array<{ id: string; fileName: string; mimeType: string }>;
  providerEvents?: Array<{ id: string; eventType: string; occurredAt: string | null; createdAt: string }>;
}

export default function MessageDetailPage() {
  const params = useParams();
  const deliveryId = params?.deliveryId as string;
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const fetchDelivery = useCallback(async () => {
    if (!deliveryId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getMessagingDelivery(deliveryId);
      setDelivery(data as unknown as DeliveryDetail);
    } catch (err) {
      console.error('Error fetching delivery:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch delivery');
      setDelivery(null);
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  const handleResend = async () => {
    if (!deliveryId || resending) return;
    try {
      setResending(true);
      await resendMessagingDelivery(deliveryId);
      await fetchDelivery();
    } catch (err) {
      console.error('Error resending:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const recipient = delivery?.recipientPhone ?? delivery?.recipientEmail ?? '-';

  if (!deliveryId) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Invalid delivery ID</p>
        <Button asChild variant="outline">
          <Link href="/admin/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  if (loading && !delivery) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3" />
        <div className="animate-pulse h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error && !delivery) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error}</p>
        <Button asChild variant="outline">
          <Link href="/admin/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/messages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Delivery</h1>
          <p className="text-sm text-gray-600">ID: {deliveryId}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Recipient, template, channel, status, and lifecycle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Recipient</span>
              <p className="font-mono">{recipient}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Channel</span>
              <p>{delivery?.channel}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Template</span>
              <p>{delivery?.templateKey}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Status</span>
              <p>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    delivery?.status === 'SENT'
                      ? 'bg-green-100 text-green-800'
                      : delivery?.status === 'FAILED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {delivery?.status}
                </span>
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Language</span>
              <p>{delivery?.requestedLanguage} → {delivery?.usedLanguage ?? '-'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Attempts</span>
              <p>{delivery?.attemptCount} / {delivery?.maxAttempts}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Created</span>
              <p>{formatDate(delivery?.createdAt ?? null)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Last Attempt</span>
              <p>{formatDate(delivery?.lastAttemptAt ?? null)}</p>
            </div>
          </div>
          {(delivery?.renderError ?? delivery?.lastError) && (
            <div>
              <span className="font-medium text-gray-600">Error</span>
              <p className="mt-1 p-2 rounded bg-red-50 text-red-800 text-sm">
                {delivery?.renderError ?? delivery?.lastError}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rendered Content</CardTitle>
          <CardDescription>Subject and body as sent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {delivery?.renderedSubject && (
            <div>
              <span className="font-medium text-gray-600">Subject</span>
              <p className="mt-1">{delivery.renderedSubject}</p>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-600">Body</span>
            <pre className="mt-1 p-3 rounded bg-gray-50 text-sm overflow-auto max-h-64 whitespace-pre-wrap">
              {(delivery?.renderedBody ?? delivery?.renderedTextBody) ?? '(empty)'}
            </pre>
          </div>
        </CardContent>
      </Card>

      {(delivery?.attachments?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>{delivery?.attachments?.length} attachment(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {delivery?.attachments?.map((a) => (
                <li key={a.id}>{a.fileName}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(delivery?.providerEvents?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Provider Events</CardTitle>
            <CardDescription>Webhook events from provider</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {delivery?.providerEvents?.map((e) => (
                <li key={e.id} className="text-sm">
                  {e.eventType} — {formatDate(e.occurredAt ?? e.createdAt)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Button
          onClick={handleResend}
          disabled={resending || delivery?.status === 'PENDING' || delivery?.status === 'PROCESSING'}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Resending…' : 'Resend'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/messages">Back to Messages</Link>
        </Button>
      </div>
    </div>
  );
}
