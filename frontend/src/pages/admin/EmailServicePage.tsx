import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiMail, FiCheck, FiX } from 'react-icons/fi';
import AppShell from '../../components/layout/AppShell';
import { PageHeader, Card, Button, Badge } from '../../components/ui';

// Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
// TODO: Replace with REST service when Rust admin email endpoints are implemented
interface EmailStatus {
  configured: boolean;
  smtpConnected: boolean;
  imapConnected: boolean;
  lastTestResult?: {
    success: boolean;
    timestamp: string;
    deliveryTimeMs?: number;
    error?: string;
  };
}

interface TestResult {
  success: boolean;
  testId?: string;
  smtpSent?: boolean;
  imapReceived?: boolean;
  deliveryTimeMs?: number;
  error?: string;
}

function StatusRow({ label, description, isConnected }: { label: string; description: string; isConnected: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-surface-sunken">
      <div>
        <div className="font-semibold text-ink">{label}</div>
        <div className="text-caption text-ink-muted">{description}</div>
      </div>
      {isConnected ? (
        <FiCheck className="h-6 w-6 text-success-700" aria-hidden="true" />
      ) : (
        <FiX className="h-6 w-6 text-error-700" aria-hidden="true" />
      )}
    </div>
  );
}

export default function EmailServicePage() {
  const { t } = useTranslation();

  // Fetch email service status
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<EmailStatus | null>({
    queryKey: ['admin', 'email', 'status'],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin email endpoints are implemented
      return null;
    },
  });

  // Email test mutation
  const testMutation = useMutation<TestResult, Error, void>({
    mutationFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin email endpoints are implemented
      throw new Error('Admin email service management is being migrated');
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t('emailService.test.success'));
      } else {
        toast.error(t('emailService.test.failed'));
      }
      refetchStatus();
    },
    onError: () => {
      toast.error(t('emailService.test.failed'));
    }
  });

  const handleRunTest = () => {
    testMutation.mutate();
  };

  return (
    <AppShell variant="admin" title={t('emailService.title')}>
      <PageHeader density="admin" title={t('emailService.title')} subtitle={t('emailService.description')} />

      {/* Status Card */}
      <Card className="mb-6">
        <h2 className="text-title text-ink mb-4">{t('emailService.status.title')}</h2>

        {statusLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto" />
            <p className="mt-4 text-caption text-ink-muted">{t('common.loading')}</p>
          </div>
        ) : status ? (
          <div className="space-y-4">
            <StatusRow
              label="Email Configuration"
              description={status.configured ? t('emailService.status.configured') : t('emailService.status.notConfigured')}
              isConnected={status.configured}
            />
            <StatusRow
              label="SMTP Connection"
              description={status.smtpConnected ? t('emailService.status.smtpConnected') : t('emailService.status.smtpDisconnected')}
              isConnected={status.smtpConnected}
            />
            <StatusRow
              label="IMAP Connection"
              description={status.imapConnected ? t('emailService.status.imapConnected') : t('emailService.status.imapDisconnected')}
              isConnected={status.imapConnected}
            />

            {/* Last Test Result */}
            {status.lastTestResult && (
              <Card surface="sunken" padding="md" className={status.lastTestResult.success ? 'border border-success-600' : 'border border-error-600'}>
                <div className="font-semibold text-ink mb-2">{t('emailService.lastTest')}</div>
                <div className="grid grid-cols-2 gap-2 text-caption">
                  <div>
                    <span className="text-ink-muted">Status:</span>
                    <Badge tone={status.lastTestResult.success ? 'success' : 'error'} size="sm" className="ml-2">
                      {status.lastTestResult.success ? 'Passed' : 'Failed'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-ink-muted">Time:</span>
                    <span className="ml-2 text-ink">
                      {new Date(status.lastTestResult.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {status.lastTestResult.deliveryTimeMs && (
                    <div>
                      <span className="text-ink-muted">Delivery:</span>
                      <span className="ml-2 text-ink">{status.lastTestResult.deliveryTimeMs}ms</span>
                    </div>
                  )}
                  {status.lastTestResult.error && (
                    <div className="col-span-2">
                      <span className="text-ink-muted">Error:</span>
                      <span className="ml-2 text-error-700">{status.lastTestResult.error}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-caption text-ink-muted">
            {t('common.error')}
          </div>
        )}
      </Card>

      {/* Test Controls */}
      <Card>
        <h2 className="text-title text-ink mb-4">Email Test</h2>

        <p className="text-caption text-ink-muted mb-4">
          Run a complete end-to-end test that sends an email via SMTP and verifies receipt via IMAP.
        </p>

        <Button onClick={handleRunTest} loading={testMutation.isPending}>
          <FiMail className="h-4 w-4" aria-hidden="true" />
          {testMutation.isPending ? t('emailService.test.running') : t('emailService.test.button')}
        </Button>

        {/* Test Results */}
        {testMutation.data && (
          <Card
            surface="sunken"
            padding="md"
            className={`mt-4 border ${testMutation.data.success ? 'border-success-600' : 'border-error-600'}`}
          >
            <h3 className="font-semibold text-ink mb-2">
              {t('emailService.results.title')}
            </h3>
            <div className="space-y-2 text-caption">
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('emailService.results.testId')}:</span>
                <span className="font-mono text-ink">{testMutation.data.testId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('emailService.results.smtpSent')}:</span>
                <span className={testMutation.data.smtpSent ? 'text-success-700' : 'text-error-700'}>
                  {testMutation.data.smtpSent ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('emailService.results.imapReceived')}:</span>
                <span className={testMutation.data.imapReceived ? 'text-success-700' : 'text-error-700'}>
                  {testMutation.data.imapReceived ? 'Yes' : 'No'}
                </span>
              </div>
              {testMutation.data.deliveryTimeMs && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">{t('emailService.results.deliveryTime')}:</span>
                  <span className="text-ink">{testMutation.data.deliveryTimeMs}ms</span>
                </div>
              )}
              {testMutation.data.error && (
                <div className="mt-2 pt-2 border-t border-hairline">
                  <span className="text-ink-muted">{t('emailService.results.error')}:</span>
                  <p className="text-error-700 mt-1">{testMutation.data.error}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </Card>
    </AppShell>
  );
}
