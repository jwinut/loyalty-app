/* eslint-disable no-console -- Debug tool requires console logging for diagnostics */
import React, { useState } from 'react';
import { surveyService } from '../../services/surveyService';
import { CreateSurveyRequest } from '../../types/survey';
import toast from 'react-hot-toast';
import { FiTool, FiClipboard, FiPlayCircle, FiAlertCircle, FiFileText } from 'react-icons/fi';
import AppShell from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

/**
 * Thai Survey Debug Page
 *
 * This component provides a dedicated interface for testing Thai language
 * survey creation to debug the 400 error. It includes detailed logging
 * and error capture specifically for Thai content validation issues.
 */
const ThaiSurveyDebug: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Pre-filled Thai survey data matching the test scenario
  const [surveyData, setSurveyData] = useState<CreateSurveyRequest>({
    title: "ความพึงพอใจของลูกค้า", // "Customer Satisfaction" in Thai
    description: "กรุณาช่วยเราปรับปรุงบริการ", // "Please help us improve our service" in Thai
    questions: [
      {
        id: "q_thai_001",
        type: "single_choice",
        text: "คุณพอใจกับบริการไหม?", // "Are you satisfied with the service?" in Thai
        required: true,
        order: 1,
        options: [
          {
            id: "opt_thai_001",
            text: "พอใจมาก", // "Very satisfied" in Thai
            value: "very_satisfied"
          },
          {
            id: "opt_thai_002", 
            text: "พอใจ", // "Satisfied" in Thai
            value: "satisfied"
          }
        ]
      }
    ],
    target_segment: {},
    access_type: "public"
  });

  const handleCreateSurvey = async () => {
    setIsCreating(true);
    setLastError(null);

    try {
      console.log('🧪 THAI SURVEY DEBUG - Creating survey...');
      console.log('Survey data:', JSON.stringify(surveyData, null, 2));
      
      // Analyze encoding before sending
      console.log('📊 Encoding analysis:');
      console.log('Title:', {
        text: surveyData.title,
        length: surveyData.title.length,
        bytes: new TextEncoder().encode(surveyData.title).length,
        charCodes: Array.from(surveyData.title).map(char => char.charCodeAt(0))
      });
      
      console.log('Description:', {
        text: surveyData.description,
        length: surveyData.description?.length ?? 0,
        bytes: surveyData.description ? new TextEncoder().encode(surveyData.description).length : 0
      });

      surveyData.questions.forEach((q, i) => {
        console.log('Question', i + 1, ':', {
          text: q.text,
          length: q.text.length,
          bytes: new TextEncoder().encode(q.text).length
        });
        
        q.options?.forEach((opt, j) => {
          console.log('  Option', j + 1, ':', {
            text: opt.text,
            length: opt.text.length,
            bytes: new TextEncoder().encode(opt.text).length
          });
        });
      });

      const result = await surveyService.createSurvey(surveyData);
      console.log('✅ Survey created successfully:', result);
      toast.success('Thai survey created successfully!');

    } catch (error) {
      console.error('❌ THAI SURVEY CREATION ERROR:', error);
      setLastError(error instanceof Error ? error : new Error(String(error)));

      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? (error as Error).message
        : 'Unknown error';
      toast.error(`Failed to create survey: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Type guard for axios-like error
  const getAxiosError = (error: Error | null) => {
    if (!error) {return null;}
    if ('response' in error) {
      return error as unknown as { response?: { status?: number; statusText?: string; data?: Record<string, unknown> }; message?: string };
    }
    return { message: error.message };
  };

  return (
    <AppShell variant="admin" title="Thai Survey Debug">
      <div className="mx-auto max-w-text">
        <Card>
          <h1 className="mb-6 flex items-center gap-2 text-title text-ink">
            <FiTool className="h-5 w-5" aria-hidden="true" />
            Thai Survey Debug Tool
          </h1>

          <div className="mb-6 rounded-lg bg-brand-50 p-4">
            <h2 className="mb-2 text-body font-semibold text-brand-900">Purpose</h2>
            <p className="text-caption text-brand-800">
              This page is designed to debug the 400 error when creating surveys with Thai language content.
              It includes detailed logging and error capture to identify validation issues.
            </p>
          </div>

          {/* Survey Data Preview */}
          <div className="mb-6">
            <h2 className="mb-4 flex items-center gap-2 text-body font-semibold text-ink">
              <FiClipboard className="h-4 w-4" aria-hidden="true" />
              Survey Data
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div className="rounded-lg border border-hairline p-4">
                <label className="mb-2 block text-caption font-semibold text-ink">
                  Title (Thai)
                </label>
                <input
                  type="text"
                  value={surveyData.title}
                  onChange={(e) => setSurveyData({...surveyData, title: e.target.value})}
                  className="w-full rounded-lg border border-hairline-strong px-3 py-2 text-body focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
                <div className="mt-2 text-fine text-ink-muted">
                  <div>Length: {surveyData.title.length} chars</div>
                  <div>Bytes: {new TextEncoder().encode(surveyData.title).length}</div>
                  <div>Has Thai: {/[\u0E00-\u0E7F]/.test(surveyData.title) ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-lg border border-hairline p-4">
                <label className="mb-2 block text-caption font-semibold text-ink">
                  Description (Thai)
                </label>
                <textarea
                  value={surveyData.description}
                  onChange={(e) => setSurveyData({...surveyData, description: e.target.value})}
                  className="w-full rounded-lg border border-hairline-strong px-3 py-2 text-body focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
                  rows={3}
                />
                <div className="mt-2 text-fine text-ink-muted">
                  <div>Length: {surveyData.description?.length ?? 0} chars</div>
                  <div>Bytes: {surveyData.description ? new TextEncoder().encode(surveyData.description).length : 0}</div>
                </div>
              </div>

              {/* Question */}
              <div className="rounded-lg border border-hairline p-4">
                <label className="mb-2 block text-caption font-semibold text-ink">
                  Question Text (Thai)
                </label>
                <input
                  type="text"
                  value={surveyData.questions[0]?.text ?? ''}
                  onChange={(e) => {
                    const updated = {...surveyData};
                    if (updated.questions[0]) {
                      updated.questions[0].text = e.target.value;
                      setSurveyData(updated);
                    }
                  }}
                  className="w-full rounded-lg border border-hairline-strong px-3 py-2 text-body focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
                <div className="mt-2 text-fine text-ink-muted">
                  <div>Length: {surveyData.questions[0]?.text.length ?? 0} chars</div>
                  <div>Bytes: {surveyData.questions[0]?.text ? new TextEncoder().encode(surveyData.questions[0].text).length : 0}</div>
                </div>
              </div>

              {/* Options */}
              <div className="rounded-lg border border-hairline p-4">
                <label className="mb-2 block text-caption font-semibold text-ink">
                  Options (Thai)
                </label>
                {surveyData.questions[0]?.options?.map((option, index) => (
                  <div key={option.id} className="mb-2">
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const updated = {...surveyData};
                        const firstQuestion = updated.questions[0];
                        if (firstQuestion?.options?.[index]) {
                          firstQuestion.options[index].text = e.target.value;
                          setSurveyData(updated);
                        }
                      }}
                      className="w-full rounded-lg border border-hairline-strong px-3 py-2 text-body focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
                      placeholder={`Option ${index + 1}`}
                    />
                    <div className="mt-1 text-fine text-ink-muted">
                      Length: {option.text.length} chars, Bytes: {new TextEncoder().encode(option.text).length}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-6">
            <Button onClick={handleCreateSurvey} loading={isCreating}>
              <FiPlayCircle className="h-4 w-4" aria-hidden="true" />
              {isCreating ? 'Creating Survey...' : 'Create Thai Survey'}
            </Button>
          </div>

          {/* Error Display */}
          {lastError && (() => {
            const err = getAxiosError(lastError);
            if (!err) {return null as React.ReactElement | null;}

            return (
              <div className="mb-6" key="error-display">
                <h2 className="mb-4 flex items-center gap-2 text-body font-semibold text-error-700">
                  <FiAlertCircle className="h-4 w-4" aria-hidden="true" />
                  Last Error
                </h2>
                <div className="rounded-lg border border-error-600/30 bg-error-50 p-4">
                  <div className="mb-4">
                    <strong>Status:</strong> {err.response?.status} {err.response?.statusText}
                  </div>

                  <div className="mb-4">
                    <strong>Message:</strong> {(err.response?.data?.message as string) ?? err.message ?? 'Unknown error'}
                  </div>

                  {err.response?.data?.validationErrors ? (
                    <div className="mb-4">
                      <strong>Validation Errors:</strong>
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-hairline bg-surface-card p-2 text-fine">
                        {String(JSON.stringify(err.response.data.validationErrors, null, 2))}
                      </pre>
                    </div>
                  ) : null}

                  {err.response?.data?.receivedData ? (
                    <div className="mb-4">
                      <strong>Backend Received:</strong>
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-hairline bg-surface-card p-2 text-fine">
                        {String(JSON.stringify(err.response.data.receivedData, null, 2))}
                      </pre>
                    </div>
                  ) : null}

                  <div>
                    <strong>Full Error:</strong>
                    <pre className="mt-2 max-h-60 overflow-auto rounded-lg border border-hairline bg-surface-card p-2 text-fine">
                      {String(JSON.stringify(err.response?.data ?? err, null, 2))}
                    </pre>
                  </div>
                </div>
              </div>
            ) as React.ReactElement | null;
          })() as React.ReactElement | null}

          {/* Instructions */}
          <div className="rounded-lg border border-warning-600/30 bg-warning-50 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-body font-semibold text-warning-700">
              <FiFileText className="h-4 w-4" aria-hidden="true" />
              Instructions
            </h2>
            <ol className="list-inside list-decimal space-y-1 text-caption text-warning-700">
              <li>Open browser dev tools console for detailed logging</li>
              <li>Click &quot;Create Thai Survey&quot; to reproduce the 400 error</li>
              <li>Check the console for detailed request/response data</li>
              <li>Check the &quot;Last Error&quot; section above for validation details</li>
              <li>Check backend server logs for additional debugging info</li>
            </ol>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default ThaiSurveyDebug;