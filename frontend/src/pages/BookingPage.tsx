import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiUsers, FiCheck, FiUpload, FiX, FiCheckCircle, FiClock, FiAlertCircle, FiMapPin } from 'react-icons/fi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import clsx from 'clsx';
import MainLayout from '../components/layout/MainLayout';
import { bookingService } from '../services/bookingService';
import {
  channelBookingService,
  type Property,
  type PaymentOption,
  type ChannelBookingResponse,
} from '../services/channelBookingService';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

// The booking flow is a CHANNEL into the PMS (ADR-0003): availability is
// queried live and a confirmed booking is created in the PMS. Payment is a
// PromptPay transfer into the booked property's own receiving account —
// the QR payload arrives with the booking response; nothing is hardcoded
// here.

const PROPERTIES: Property[] = ['hf', 'hfville'];

interface BookingStep {
  number: number;
  title: string;
  completed: boolean;
}

type SlipStatus = 'pending' | 'uploaded' | 'verified' | 'failed';

function formatCountdown(msLeft: number): string {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function BookingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  // Form state
  const [property, setProperty] = useState<Property | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [numGuests, setNumGuests] = useState(1);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(' '),
  );
  const [guestPhone, setGuestPhone] = useState(user?.phone ?? '');
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('deposit50');
  const [currentStep, setCurrentStep] = useState(1);

  // Payment state
  const [createdBooking, setCreatedBooking] = useState<ChannelBookingResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [holdMsLeft, setHoldMsLeft] = useState<number | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipStatus, setSlipStatus] = useState<SlipStatus>('pending');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Date validation
  const today = new Date().toISOString().split('T')[0];
  const minCheckOut = checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : today;

  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Live availability from the PMS via the channel endpoint
  const { data: availability, isLoading: isLoadingRoomTypes } = useQuery({
    queryKey: ['bookings', 'channel-availability', property, checkIn, checkOut, numGuests],
    queryFn: () => {
      if (!property) {
        throw new Error('property is required when availability query is enabled');
      }
      return channelBookingService.getAvailability(property, checkIn, checkOut, numGuests);
    },
    enabled: !!property && !!checkIn && !!checkOut && nights > 0,
  });

  const roomTypes = availability?.room_types;
  const selectedRoomType = roomTypes?.find(rt => rt.room_type_id === selectedRoomTypeId);
  const totalPrice = selectedRoomType ? selectedRoomType.nightly_price * nights : 0;
  const depositAmount = Math.round(totalPrice * 0.5);
  const amountDueNow = paymentOption === 'deposit50' ? depositAmount : totalPrice;

  const createBookingMutation = useMutation({
    mutationFn: () => {
      if (!property || !selectedRoomTypeId) {
        throw new Error('property and room type are required');
      }
      return channelBookingService.createBooking({
        property,
        room_type_id: selectedRoomTypeId,
        check_in: checkIn,
        check_out: checkOut,
        guests: numGuests,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        payment_option: paymentOption,
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(t('booking.bookingSuccess'));
      setCreatedBooking(data);
      setCurrentStep(4);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('booking.bookingError'));
    },
  });

  // Render the per-property PromptPay QR from the payload in the booking
  // response (same QRCode.toDataURL pattern as the coupon QR modal).
  useEffect(() => {
    if (!createdBooking?.promptpay_qr_payload) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(createdBooking.promptpay_qr_payload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch((error: unknown) => {
        logger.error(
          'Failed to render PromptPay QR:',
          error instanceof Error ? error.message : String(error),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [createdBooking]);

  // Hold-expiry countdown. The PMS releases the room if the deposit is not
  // verified before hold_expires_at; keep the guest aware of the clock.
  useEffect(() => {
    if (!createdBooking?.hold_expires_at) {
      setHoldMsLeft(null);
      return;
    }
    const expiresAt = new Date(createdBooking.hold_expires_at).getTime();
    const tick = () => setHoldMsLeft(expiresAt - Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [createdBooking]);

  const holdExpired = holdMsLeft !== null && holdMsLeft <= 0 && slipStatus === 'pending' && !slipPreview;

  // File handling functions
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      toast.error(t('payment.invalidFileType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error(t('payment.fileTooLarge'));
      return;
    }
    setSlipFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSlipPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [t]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const removeSlip = useCallback(() => {
    setSlipFile(null);
    setSlipPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleSlipUpload = useCallback(async () => {
    if (!slipFile || !createdBooking) {return;}

    setIsUploading(true);
    try {
      // Two-step flow (mirrors MyBookingsPage):
      //   1. POST /api/slips/upload      -> stores the file, returns the URL
      //   2. POST /api/bookings/:id/slips -> attaches the URL to the booking
      const { url } = await bookingService.uploadSlip(slipFile);
      await bookingService.addSlip(createdBooking.booking_id, url);

      setSlipStatus('uploaded');
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(t('payment.slipUploaded'));
    } catch (_error) {
      setSlipStatus('failed');
      toast.error(t('payment.uploadError'));
    } finally {
      setIsUploading(false);
    }
  }, [slipFile, createdBooking, t, queryClient]);

  const handleSkipPayment = useCallback(() => {
    navigate('/my-bookings');
  }, [navigate]);

  const handleDateSubmit = () => {
    if (property && checkIn && checkOut && nights > 0) {
      setCurrentStep(2);
    }
  };

  const handleRoomTypeSelect = (roomTypeId: string) => {
    const roomType = roomTypes?.find(rt => rt.room_type_id === roomTypeId);
    if (roomType && roomType.available_count > 0) {
      setSelectedRoomTypeId(roomTypeId);
      setCurrentStep(3);
    }
  };

  const handleBookingSubmit = () => {
    if (!selectedRoomTypeId || !checkIn || !checkOut || !property) {
      return;
    }
    if (!guestName.trim() || !guestPhone.trim()) {
      toast.error(t('booking.guestDetailsRequired'));
      return;
    }
    createBookingMutation.mutate();
  };

  const restartBooking = () => {
    setCreatedBooking(null);
    setSelectedRoomTypeId(null);
    setSlipFile(null);
    setSlipPreview(null);
    setSlipStatus('pending');
    setCurrentStep(1);
  };

  const steps: BookingStep[] = [
    { number: 1, title: t('booking.selectDates'), completed: currentStep > 1 },
    { number: 2, title: t('booking.selectRoom'), completed: currentStep > 2 },
    { number: 3, title: t('booking.confirm'), completed: currentStep > 3 },
    { number: 4, title: t('payment.title'), completed: slipStatus === 'uploaded' || slipStatus === 'verified' },
  ];

  return (
    <MainLayout title={t('booking.title')}>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div
                className={clsx('flex items-center justify-center w-10 h-10 rounded-full', {
                  'bg-brand-600 text-white': currentStep === step.number,
                  'bg-green-500 text-white': currentStep !== step.number && step.completed,
                  'bg-stone-200 text-stone-600': currentStep !== step.number && !step.completed,
                })}
              >
                {step.completed ? <FiCheck className="w-5 h-5" /> : step.number}
              </div>
              <span className={clsx('ml-2', currentStep === step.number ? 'font-semibold' : 'text-stone-500')}>
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <div className={clsx('w-16 h-1 mx-4', step.completed ? 'bg-green-500' : 'bg-stone-200')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Property, dates, guests */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <FiCalendar className="mr-2" />
            {t('booking.selectDates')}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t('booking.selectProperty')}
              </label>
              <div className="grid grid-cols-1 gap-3">
                {PROPERTIES.map((p) => (
                  <label
                    key={p}
                    className={clsx('flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors',
                      property === p ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="property"
                      value={p}
                      checked={property === p}
                      onChange={() => setProperty(p)}
                      className="h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600"
                      data-testid={`property-${p}`}
                    />
                    <FiMapPin className="ml-3 mr-2 text-brand-600 flex-shrink-0" />
                    <span className="font-medium">{t(`property.${p}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {t('booking.checkIn')}
              </label>
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (checkOut && e.target.value >= checkOut) {
                    setCheckOut('');
                  }
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                data-testid="check-in-date"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {t('booking.checkOut')}
              </label>
              <input
                type="date"
                value={checkOut}
                min={minCheckOut}
                onChange={(e) => setCheckOut(e.target.value)}
                disabled={!checkIn}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:ring-brand-500 focus:border-brand-500 disabled:bg-stone-100"
                data-testid="check-out-date"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {t('booking.numberOfGuests')}
              </label>
              <select
                value={numGuests}
                onChange={(e) => setNumGuests(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                data-testid="num-guests"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? t('booking.guest') : t('booking.guests')}
                  </option>
                ))}
              </select>
            </div>

            {nights > 0 && (
              <p className="text-sm text-stone-600">
                {t('booking.nightsSelected', { count: nights })}
              </p>
            )}

            <button
              onClick={handleDateSubmit}
              disabled={!property || !checkIn || !checkOut || nights <= 0}
              className="w-full py-2 px-4 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:bg-stone-300 disabled:cursor-not-allowed"
              data-testid="continue-to-rooms"
            >
              {t('common.continue')}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Room Type */}
      {currentStep === 2 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {t('booking.availableRooms')}
            </h2>
            <button
              onClick={() => setCurrentStep(1)}
              className="text-brand-600 hover:underline"
            >
              {t('booking.changeDates')}
            </button>
          </div>

          <p className="text-stone-600 mb-4">
            {property && <span className="font-medium">{t(`property.${property}`)} · </span>}
            {t('booking.stayDates', {
              checkIn: new Date(checkIn).toLocaleDateString(),
              checkOut: new Date(checkOut).toLocaleDateString(),
              nights
            })}
          </p>

          {isLoadingRoomTypes ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600" />
            </div>
          ) : roomTypes?.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-800">{t('booking.noRoomsAvailable')}</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {roomTypes?.map((roomType) => (
                <div
                  key={roomType.room_type_id}
                  className={clsx('bg-white rounded-lg shadow overflow-hidden',
                    roomType.available_count === 0 ? 'opacity-50' : 'hover:shadow-lg cursor-pointer'
                  )}
                  onClick={() => roomType.available_count > 0 && handleRoomTypeSelect(roomType.room_type_id)}
                  data-testid={`room-type-${roomType.room_type_id}`}
                >
                  {/* Room Image */}
                  {roomType.photo_url ? (
                    <img
                      src={roomType.photo_url}
                      alt={roomType.name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-stone-200 flex items-center justify-center">
                      <span className="text-stone-400">{t('booking.noImage')}</span>
                    </div>
                  )}

                  <div className="p-4">
                    <h3 className="text-lg font-semibold">{roomType.name}</h3>
                    {roomType.description && (
                      <p className="text-stone-600 text-sm mt-1 line-clamp-2">{roomType.description}</p>
                    )}

                    {/* Price and Availability */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-bold text-brand-600">
                            ฿{roomType.nightly_price.toLocaleString()}
                          </span>
                          <span className="text-stone-500 text-sm">/{t('booking.night')}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            ฿{(roomType.nightly_price * nights).toLocaleString()}
                          </div>
                          <div className="text-sm text-stone-500">
                            {t('booking.totalForNights', { nights })}
                          </div>
                        </div>
                      </div>

                      <div className={clsx('mt-2 text-sm',
                        roomType.available_count === 0 ? 'text-red-600' : 'text-green-600'
                      )}
                      >
                        {roomType.available_count === 0
                          ? t('booking.soldOut')
                          : t('booking.roomsLeft', { count: roomType.available_count })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm Booking */}
      {currentStep === 3 && selectedRoomType && (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{t('booking.confirmBooking')}</h2>
            <button
              onClick={() => setCurrentStep(2)}
              className="text-brand-600 hover:underline"
            >
              {t('booking.changeRoom')}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Booking Summary */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-4">{t('booking.bookingSummary')}</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-500">{t('booking.property')}:</span>
                  <span className="ml-2 font-medium">{property ? t(`property.${property}`) : ''}</span>
                </div>
                <div>
                  <span className="text-stone-500">{t('booking.roomType')}:</span>
                  <span className="ml-2 font-medium">{selectedRoomType.name}</span>
                </div>
                <div>
                  <span className="text-stone-500">{t('booking.checkIn')}:</span>
                  <span className="ml-2 font-medium">{new Date(checkIn).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-stone-500">{t('booking.checkOut')}:</span>
                  <span className="ml-2 font-medium">{new Date(checkOut).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-stone-500">{t('booking.nights')}:</span>
                  <span className="ml-2 font-medium">{nights}</span>
                </div>
                <div>
                  <span className="text-stone-500">{t('booking.numberOfGuests')}:</span>
                  <span className="ml-2 font-medium">{numGuests}</span>
                </div>
              </div>
            </div>

            {/* Guest Details */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center">
                <FiUsers className="mr-2" />
                {t('booking.guestDetails')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {t('booking.guestName')}
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                    data-testid="guest-name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {t('booking.guestPhone')}
                  </label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder={t('booking.guestPhonePlaceholder')}
                    className="w-full px-3 py-2 border border-stone-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                    data-testid="guest-phone"
                  />
                </div>
              </div>
            </div>

            {/* Payment option (50% deposit or full) */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-4">{t('payment.selectPaymentType')}</h3>

              <div className="space-y-3">
                <label
                  className={clsx('flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors',
                    paymentOption === 'deposit50' ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300'
                  )}
                >
                  <input
                    type="radio"
                    name="paymentOption"
                    value="deposit50"
                    checked={paymentOption === 'deposit50'}
                    onChange={() => setPaymentOption('deposit50')}
                    className="mt-1 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{t('payment.deposit')}</span>
                      <span className="text-lg font-bold text-brand-600">
                        ฿{depositAmount.toLocaleString('th-TH')}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 mt-1">{t('payment.depositDescription')}</p>
                  </div>
                </label>

                <label
                  className={clsx('flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors',
                    paymentOption === 'full' ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300'
                  )}
                >
                  <input
                    type="radio"
                    name="paymentOption"
                    value="full"
                    checked={paymentOption === 'full'}
                    onChange={() => setPaymentOption('full')}
                    className="mt-1 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{t('payment.payInFull')}</span>
                      <span className="text-lg font-bold text-brand-600">
                        ฿{totalPrice.toLocaleString('th-TH')}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 mt-1">{t('payment.payInFullDescription')}</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Price Details */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-4">{t('booking.priceDetails')}</h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>
                    ฿{selectedRoomType.nightly_price.toLocaleString()} x {nights} {nights === 1 ? t('booking.night') : t('booking.nights')}
                  </span>
                  <span>฿{totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>{t('booking.total')}</span>
                  <span className="text-brand-600">฿{totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-stone-600">
                  <span>{t('payment.amountToPay')}</span>
                  <span>฿{amountDueNow.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleBookingSubmit}
              disabled={createBookingMutation.isPending || !guestName.trim() || !guestPhone.trim()}
              className="w-full py-3 px-4 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:bg-stone-300 disabled:cursor-not-allowed font-semibold"
              data-testid="confirm-booking"
            >
              {createBookingMutation.isPending ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  {t('booking.processing')}
                </span>
              ) : (
                t('booking.confirmAndBook')
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Payment */}
      {currentStep === 4 && createdBooking && (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{t('payment.title')}</h2>
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Amount summary */}
            <div className="p-4 bg-brand-50 border-2 border-brand-200 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">
                    {paymentOption === 'deposit50' ? t('payment.deposit') : t('payment.payInFull')}
                  </p>
                  <p className="text-sm text-stone-500">{t('payment.amountToPay')}</p>
                </div>
                <p className="text-2xl font-bold text-brand-600" data-testid="amount-due-now">
                  ฿{createdBooking.amount_due_now.toLocaleString('th-TH')}
                </p>
              </div>
              {createdBooking.balance_due_at_checkin > 0 && (
                <div className="flex justify-between items-center text-sm border-t border-brand-200 pt-2">
                  <span className="text-stone-600">{t('payment.balanceDueAtCheckin')}</span>
                  <span className="font-semibold" data-testid="balance-due">
                    ฿{createdBooking.balance_due_at_checkin.toLocaleString('th-TH')}
                  </span>
                </div>
              )}
            </div>

            {/* Hold expiry countdown */}
            {holdMsLeft !== null && !holdExpired && slipStatus === 'pending' && (
              <div className="flex items-center justify-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="hold-countdown">
                <FiClock className="w-4 h-4" />
                <span>{t('payment.holdExpiresIn', { time: formatCountdown(holdMsLeft) })}</span>
              </div>
            )}

            {holdExpired ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-4" data-testid="hold-expired">
                <FiAlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                <p className="font-medium text-red-800">{t('payment.holdExpired')}</p>
                <button
                  onClick={restartBooking}
                  className="py-2 px-6 bg-brand-600 text-white rounded-md hover:bg-brand-700"
                >
                  {t('payment.startOver')}
                </button>
              </div>
            ) : (
              <>
                {/* Per-property PromptPay QR */}
                <div className="border-b pb-6">
                  <h3 className="font-semibold text-lg mb-4">{t('payment.scanQRCode')}</h3>

                  <div className="p-4 bg-white border-2 border-stone-200 rounded-lg shadow-sm space-y-4">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="PromptPay QR Code"
                        className="w-full max-w-xs mx-auto"
                        data-testid="promptpay-qr"
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center h-48"
                        data-testid="qr-loading"
                      >
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
                      </div>
                    )}

                    <p className="text-sm text-stone-600 text-center">
                      {t('payment.scanInstructions')}
                    </p>
                    <p className="text-xs text-stone-500 text-center">
                      {t('payment.propertyAccount', { property: t(`property.${availability?.property ?? 'hf'}`) })}
                    </p>
                  </div>
                </div>

                {/* Slip Upload Section */}
                <div className="pb-6">
                  <h3 className="font-semibold text-lg mb-4">{t('payment.uploadSlip')}</h3>
                  <p className="text-sm text-stone-600 mb-4">{t('payment.uploadSlipDescription')}</p>

                  {slipStatus === 'pending' && !slipPreview && (
                    <div
                      className={clsx('border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                        isDragging ? 'border-brand-500 bg-brand-50' : 'border-stone-300 hover:border-brand-400'
                      )}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="slip-dropzone"
                    >
                      <FiUpload className="w-12 h-12 text-stone-400 mx-auto mb-3" />
                      <p className="text-stone-600 mb-2">{t('payment.dragDropSlip')}</p>
                      <p className="text-xs text-stone-400">JPG, PNG (max 10MB)</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleFileInputChange}
                        className="hidden"
                        data-testid="slip-input"
                      />
                    </div>
                  )}

                  {slipPreview && slipStatus === 'pending' && (
                    <div className="relative border rounded-lg overflow-hidden">
                      <img
                        src={slipPreview}
                        alt="Transfer slip preview"
                        className="w-full max-h-64 object-contain bg-stone-100"
                      />
                      <button
                        onClick={removeSlip}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                        data-testid="remove-slip"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {slipStatus === 'uploaded' && (
                    <div className="space-y-4">
                      {slipPreview && (
                        <div className="relative border rounded-lg overflow-hidden">
                          <img
                            src={slipPreview}
                            alt="Uploaded slip"
                            className="w-full max-h-64 object-contain bg-stone-100"
                          />
                        </div>
                      )}

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center">
                        <FiClock className="w-6 h-6 text-yellow-500 mr-3" />
                        <div>
                          <p className="font-medium text-yellow-800">{t('payment.slipUploaded')}</p>
                          <p className="text-sm text-yellow-600">{t('payment.awaitingVerification')}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => navigate(`/my-bookings?openBooking=${createdBooking.booking_id}&tab=payment`)}
                        className="w-full py-2 text-brand-600 border border-brand-300 rounded-lg hover:bg-brand-50 transition-colors"
                      >
                        {t('payment.changeSlip')}
                      </button>
                    </div>
                  )}

                  {slipStatus === 'verified' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                      <FiCheckCircle className="w-6 h-6 text-green-500 mr-3" />
                      <div>
                        <p className="font-medium text-green-800">{t('payment.verified')}</p>
                      </div>
                    </div>
                  )}

                  {slipStatus === 'failed' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                      <FiAlertCircle className="w-6 h-6 text-red-500 mr-3" />
                      <div>
                        <p className="font-medium text-red-800">{t('payment.verificationFailed')}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={handleSkipPayment}
                    className="flex-1 py-3 px-4 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50"
                    data-testid="skip-payment"
                  >
                    {t('payment.payLater')}
                  </button>

                  {slipPreview && slipStatus === 'pending' && (
                    <button
                      onClick={handleSlipUpload}
                      disabled={isUploading}
                      className="flex-1 py-3 px-4 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:bg-stone-300 disabled:cursor-not-allowed font-semibold"
                      data-testid="submit-slip"
                    >
                      {isUploading ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                          {t('common.processing')}
                        </span>
                      ) : (
                        t('payment.submitSlip')
                      )}
                    </button>
                  )}

                  {(slipStatus === 'uploaded' || slipStatus === 'verified') && (
                    <button
                      onClick={() => navigate('/my-bookings')}
                      className="flex-1 py-3 px-4 bg-brand-600 text-white rounded-md hover:bg-brand-700 font-semibold"
                      data-testid="view-bookings"
                    >
                      {t('booking.myBookings')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
