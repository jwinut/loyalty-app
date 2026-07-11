import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheckCircle, FiXCircle, FiX } from 'react-icons/fi';
import { RedeemCouponResponse, Coupon, UserActiveCoupon } from '../../types/coupon';
import { couponService } from '../../services/couponService';
import { logger } from '../../utils/logger';
import { notify } from '../../utils/notificationManager';
import { useMutation } from '@tanstack/react-query';
import { Button, FormField, Input } from '../ui';
import { cn } from '../ui/cn';

interface CouponScannerProps {
  onRedemptionComplete?: (result: RedeemCouponResponse) => void;
  onClose?: () => void;
  className?: string;
}

const CouponScanner: React.FC<CouponScannerProps> = ({
  onRedemptionComplete,
  onClose,
  className = ''
}) => {
  const { t } = useTranslation();
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const [qrCode, setQrCode] = useState('');
  const [originalAmount, setOriginalAmount] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState('');
  const [location, setLocation] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [validationResult, setValidationResult] = useState<{success: boolean; valid: boolean; message: string; data?: unknown} | null>(null);
  const [redemptionResult, setRedemptionResult] = useState<RedeemCouponResponse | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const validationTimeout = useRef<number | null>(null);

  const redeemCouponMutation = useMutation({
    mutationFn: (data: { qrCode: string; originalAmount: number; transactionReference?: string; location?: string; metadata?: Record<string, unknown> }) =>
      couponService.redeemCoupon(data),
  });

  // Camera functionality (simplified - in production, use a proper QR code scanner library)
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      logger.error('Error accessing camera:', err);
      notify.error(t('coupons.cameraError'));
      setScanMode('manual');
    }
  }, [t]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (scanMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [scanMode, startCamera]);

  useEffect(() => {
    return () => {
      if (validationTimeout.current) {
        window.clearTimeout(validationTimeout.current);
      }
    };
  }, []);

  const validateCoupon = async (code: string) => {
    if (!code.trim()) {
      setValidationResult(null);
      return null;
    }

    try {
      const result = await couponService.validateCoupon(code.trim());
      setValidationResult(result);
      return result;
    } catch (err: unknown) {
      logger.error('Error validating coupon:', err);
      const errorResponse = (err as { response?: { data?: { message?: string } } })?.response?.data;
      const errorMessage = errorResponse?.message ?? t('errors.validationFailed');
      setValidationResult({
        success: false,
        valid: false,
        message: errorMessage
      });
      return {
        success: false,
        valid: false,
        message: errorMessage
      };
    }
  };

  const handleQRCodeChange = (value: string) => {
    setQrCode(value);
    setRedemptionResult(null);
    if (validationTimeout.current) {
      window.clearTimeout(validationTimeout.current);
    }

    validationTimeout.current = window.setTimeout(() => {
      if (value.trim().length >= 6) {
        validateCoupon(value);
      } else {
        setValidationResult(null);
      }
    }, 150);
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    let latestValidation = validationResult;
    if (!latestValidation?.message) {
      latestValidation = await validateCoupon(qrCode);
    }

    if (!qrCode.trim() || !originalAmount || !latestValidation?.valid) {
      return;
    }

    const amount = parseFloat(originalAmount);
    if (isNaN(amount) || amount <= 0) {
      notify.error(t('coupons.invalidAmount'));
      return;
    }

    try {
      setIsRedeeming(true);

      const result = await redeemCouponMutation.mutateAsync({
        qrCode: qrCode.trim(),
        originalAmount: amount,
        transactionReference: transactionReference.trim() || undefined,
        location: location.trim() || undefined,
        metadata: {
          redemptionChannel: 'staff_interface',
          timestamp: new Date().toISOString()
        }
      });

      setRedemptionResult(result);

      if (result.success) {
        // Reset form for next redemption
        setQrCode('');
        setOriginalAmount('');
        setTransactionReference('');
        setValidationResult(null);

        if (onRedemptionComplete) {
          onRedemptionComplete(result);
        }
      }
    } catch (err: unknown) {
      logger.error('Error redeeming coupon:', err);
      const errorMessage = err instanceof Error ? err.message : 'Redemption failed';
      const errorResult: RedeemCouponResponse = {
        success: false,
        message: errorMessage,
        discountAmount: 0,
        finalAmount: parseFloat(originalAmount) || 0
      };
      setRedemptionResult(errorResult);
    } finally {
      setIsRedeeming(false);
    }
  };

  // Calculate preview of discount
  const couponData = validationResult?.data as Coupon | UserActiveCoupon | undefined;
  const discountPreview = validationResult?.valid && originalAmount && couponData
    ? couponService.calculateDiscount(couponData, parseFloat(originalAmount))
    : null;

  return (
    <div className={cn('rounded-card border border-hairline bg-surface-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline p-4">
        <h2 className="text-title text-ink">
          {t('coupons.scanCoupon')}
        </h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            {'×'}
          </Button>
        )}
      </div>

      <div className="p-6">
        {/* Scan Mode Toggle */}
        <div className="mb-6 flex rounded-lg bg-surface-sunken p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={scanMode === 'manual'}
            className={cn(
              'flex-1 rounded-lg',
              scanMode === 'manual'
                ? 'bg-surface-card text-ink hover:bg-surface-card'
                : 'text-ink-muted hover:bg-transparent hover:text-ink'
            )}
            onClick={() => setScanMode('manual')}
          >
            {t('coupons.manualEntry')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={scanMode === 'camera'}
            className={cn(
              'flex-1 rounded-lg',
              scanMode === 'camera'
                ? 'bg-surface-card text-ink hover:bg-surface-card'
                : 'text-ink-muted hover:bg-transparent hover:text-ink'
            )}
            onClick={() => setScanMode('camera')}
          >
            {t('coupons.scanCamera')}
          </Button>
        </div>

        {/* Camera View */}
        {scanMode === 'camera' && (
          <div className="mb-6">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="mx-auto w-full max-w-sm rounded-lg bg-surface-sunken"
            />
            {cameraActive && (
              <p className="mt-2 text-center text-caption text-ink-muted">
                {t('coupons.pointCameraAtQR')}
              </p>
            )}
          </div>
        )}

        {/* Redemption Form */}
        <form onSubmit={handleRedeemCoupon} className="space-y-4" noValidate>
          {/* QR Code Input */}
          <FormField label={t('coupons.qrCode')} htmlFor="qrCode" required>
            <Input
              value={qrCode}
              onChange={(e) => handleQRCodeChange(e.target.value)}
              placeholder={t('coupons.enterQRCode')}
              required
            />
          </FormField>

          {/* Validation Result */}
          {validationResult && (
            <div className={cn('rounded-lg p-3', validationResult.valid ? 'bg-success-50' : 'bg-error-50')}>
              <div
                className={cn(
                  'flex items-center gap-2',
                  validationResult.valid ? 'text-success-700' : 'text-error-700'
                )}
              >
                {validationResult.valid ? (
                  <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <FiXCircle className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="font-semibold">{String(validationResult?.message ?? '')}</span>
              </div>

              {validationResult.valid && validationResult.data ? (
                <div className="mt-2 text-caption text-success-700">
                  <div className="font-semibold">{(validationResult.data as Coupon | UserActiveCoupon)?.name ?? ''}</div>
                  <div>{(validationResult.data as Coupon | UserActiveCoupon)?.description ?? ''}</div>
                  <div className="mt-1">
                    {t('coupons.value')}: {couponService.formatCouponValue(validationResult.data as Coupon | UserActiveCoupon)}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Original Amount */}
          <FormField label={t('coupons.originalAmount')} htmlFor="originalAmount" required>
            <Input
              type="number"
              value={originalAmount}
              onChange={(e) => setOriginalAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              leadingIcon={<span>$</span>}
              required
            />
          </FormField>

          {/* Discount Preview */}
          {discountPreview && discountPreview.isValid && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
              <h4 className="mb-2 font-semibold text-brand-900">
                {t('coupons.discountPreview')}
              </h4>
              <div className="space-y-1 text-caption">
                <div className="flex justify-between">
                  <span className="text-brand-700">{t('coupons.originalAmount')}:</span>
                  <span className="font-semibold">฿{parseFloat(originalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-700">{t('coupons.discount')}:</span>
                  <span className="font-semibold text-success-700">
                    -฿{discountPreview.discountAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-brand-200 pt-1">
                  <span className="font-semibold text-brand-900">{t('coupons.finalAmount')}:</span>
                  <span className="text-body font-bold text-brand-900">
                    ฿{discountPreview.finalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Reference */}
          <FormField label={t('coupons.transactionReference')} htmlFor="transactionReference">
            <Input
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder={t('coupons.enterTransactionReference')}
            />
          </FormField>

          {/* Location */}
          <FormField label={t('coupons.location')} htmlFor="location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('coupons.enterLocation')}
            />
          </FormField>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            loading={isRedeeming}
            disabled={!qrCode.trim() || !originalAmount}
          >
            {isRedeeming ? t('common.processing') : t('coupons.redeemCoupon')}
          </Button>
        </form>

        {/* Redemption Result */}
        {redemptionResult && (
          <div className={cn('mt-6 rounded-lg p-4', redemptionResult.success ? 'bg-success-50' : 'bg-error-50')}>
            <div
              className={cn(
                'mb-2 flex items-center gap-2',
                redemptionResult.success ? 'text-success-700' : 'text-error-700'
              )}
            >
              {redemptionResult.success ? (
                <FiCheckCircle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <FiX className="h-5 w-5" aria-hidden="true" />
              )}
              <span className="font-semibold">{redemptionResult.message}</span>
            </div>

            {redemptionResult.success && (
              <div className="space-y-1 text-caption text-success-700">
                <div className="flex justify-between">
                  <span>{t('coupons.discountApplied')}:</span>
                  <span className="font-semibold">
                    ฿{redemptionResult.discountAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('coupons.customerPays')}:</span>
                  <span className="text-body font-bold">
                    ฿{redemptionResult.finalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponScanner;
