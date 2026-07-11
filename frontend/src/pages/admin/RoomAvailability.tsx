import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppShell from '../../components/layout/AppShell';
import { Button, Card, FormField, Input, Modal, Select } from '../../components/ui';

// Types
interface RoomType {
  id: string;
  name: string;
  isActive: boolean;
}

interface Room {
  id: string;
  roomNumber: string;
  floor: number | null;
  roomTypeId: string;
  isActive: boolean;
}

interface BlockedDateItem {
  id: string;
  roomId: string;
  blockedDate: string;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface RoomBlockedDates {
  roomId: string;
  roomNumber: string;
  dates: BlockedDateItem[];
}

interface Booking {
  id: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
}

type CellStatus = 'available' | 'blocked' | 'booked';

const RoomAvailability: React.FC = () => {
  const { t } = useTranslation();
  // 'all' means show all room types, otherwise show specific room type
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragMoved, setDragMoved] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [viewedBlockReason, setViewedBlockReason] = useState('');

  // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
  // TODO: Replace with REST service when Rust admin booking endpoints are implemented
  const queryClient = useQueryClient();

  const { data: roomTypes } = useQuery<RoomType[]>({
    queryKey: ['admin', 'roomTypes', { includeInactive: false }],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      return [];
    },
    refetchOnWindowFocus: false,
  });

  // When 'all' is selected, don't filter by room type (pass undefined)
  const roomTypeFilter = selectedRoomTypeId === 'all' ? undefined : selectedRoomTypeId;

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ['admin', 'rooms', { roomTypeId: roomTypeFilter, includeInactive: false }],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      return [];
    },
    refetchOnWindowFocus: false,
  });

  // Calculate date range for current month view
  const { startDate, endDate, daysInMonth } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return { startDate: start, endDate: end, daysInMonth: days };
  }, [currentMonth]);

  const { data: blockedDates, isLoading: blockedLoading } = useQuery<RoomBlockedDates[]>({
    queryKey: ['admin', 'blockedDates', { roomTypeId: roomTypeFilter, startDate, endDate }],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      return [];
    },
    refetchOnWindowFocus: false,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['admin', 'roomBookings', { roomTypeId: roomTypeFilter, startDate, endDate }],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      return [];
    },
    refetchOnWindowFocus: false,
  });

  const blockMutation = useMutation({
    mutationFn: async (_data: { roomId: string; dates: Date[]; reason: string }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.availability.blockSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'blockedDates'] });
      setShowBlockModal(false);
      setBlockReason('');
      setSelectedCells(new Set());
      setSelectedRoomId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.availability.blockError'));
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (_data: { roomId: string; dates: Date[] }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.availability.unblockSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'blockedDates'] });
      setSelectedCells(new Set());
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.availability.unblockError'));
    },
  });

  // Build a map of cell statuses
  const cellStatusMap = useMemo(() => {
    const map = new Map<string, { status: CellStatus; reason?: string }>();

    // Mark blocked dates
    if (blockedDates) {
      blockedDates.forEach((roomData: RoomBlockedDates) => {
        roomData.dates.forEach((bd: BlockedDateItem) => {
          // Normalize date format - strip time portion if present (e.g., "2025-01-15T00:00:00.000Z" -> "2025-01-15")
          const normalizedDate = bd.blockedDate.split('T')[0];
          const key = `${bd.roomId}-${normalizedDate}`;
          map.set(key, { status: 'blocked', reason: bd.reason ?? '' });
        });
      });
    }

    // Mark booked dates
    if (bookings) {
      bookings.forEach((booking: Booking) => {
        if (booking.status === 'cancelled') {return;}

        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);

        for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const key = `${booking.roomId}-${dateStr}`;
          // Booked takes precedence over blocked
          map.set(key, { status: 'booked' });
        }
      });
    }

    return map;
  }, [blockedDates, bookings]);

  const getCellStatus = useCallback((roomId: string, date: Date): { status: CellStatus; reason?: string } => {
    const dateStr = date.toISOString().split('T')[0];
    const key = `${roomId}-${dateStr}`;
    return cellStatusMap.get(key) ?? { status: 'available' };
  }, [cellStatusMap]);

  const getCellKey = useCallback((roomId: string, date: Date): string => {
    const dateStr = date.toISOString().split('T')[0];
    return `${roomId}-${dateStr}`;
  }, []);

  const handleCellClick = useCallback((roomId: string, date: Date) => {
    // If we just finished a drag (moved to other cells), don't toggle
    if (dragMoved) {
      return;
    }

    const { status, reason } = getCellStatus(roomId, date);
    const key = getCellKey(roomId, date);

    if (status === 'booked') {
      // Cannot modify booked dates
      toast.error(t('admin.booking.availability.cannotModifyBooked'));
      return;
    }

    if (status === 'blocked') {
      // Show reason and option to unblock
      setViewedBlockReason(reason ?? '');
      setSelectedRoomId(roomId);
      setSelectedCells(new Set([key]));
      setShowReasonModal(true);
      return;
    }

    // For single clicks on available dates, toggle selection
    // But if the cell was just selected by mouseDown (same key as dragStart),
    // keep it selected instead of toggling it off
    if (dragStart === key) {
      // This was a single click - keep the selection from mouseDown
      return;
    }

    // Toggle selection for available dates (Ctrl+click or adding to existing selection)
    setSelectedCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
    setSelectedRoomId(roomId);
  }, [getCellStatus, getCellKey, t, dragMoved, dragStart]);

  const handleMouseDown = useCallback((roomId: string, date: Date) => {
    const { status } = getCellStatus(roomId, date);
    if (status !== 'available') {return;}

    setIsDragging(true);
    setDragMoved(false);
    const key = getCellKey(roomId, date);
    setDragStart(key);
    setSelectedRoomId(roomId);
    setSelectedCells(new Set([key]));
  }, [getCellStatus, getCellKey]);

  const handleMouseEnter = useCallback((roomId: string, date: Date) => {
    if (!isDragging || roomId !== selectedRoomId) {return;}

    const { status } = getCellStatus(roomId, date);
    if (status !== 'available') {return;}

    const key = getCellKey(roomId, date);
    setDragMoved(true); // Mark that we've moved during drag
    setSelectedCells(prev => new Set([...prev, key]));
  }, [isDragging, selectedRoomId, getCellStatus, getCellKey]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Don't clear dragStart here - it's used by onClick to detect single clicks
    // Clear it after a short delay to allow onClick to check it
    setTimeout(() => {
      setDragStart(null);
      setDragMoved(false);
    }, 0);
  }, []);

  const handleBlockSelected = useCallback(() => {
    if (selectedCells.size === 0 || !selectedRoomId) {return;}
    setShowBlockModal(true);
  }, [selectedCells, selectedRoomId]);

  const confirmBlock = useCallback(() => {
    if (!selectedRoomId || !blockReason.trim()) {return;}

    const dates = Array.from(selectedCells).map(key => {
      // Key format: {roomId}-{YYYY-MM-DD}, date is always last 10 chars
      const dateStr = key.slice(-10);
      // Use noon UTC to avoid timezone date shift
      return new Date(dateStr + 'T12:00:00Z');
    });

    blockMutation.mutate({
      roomId: selectedRoomId,
      dates,
      reason: blockReason.trim(),
    });
  }, [selectedRoomId, blockReason, selectedCells, blockMutation]);

  const handleUnblockSelected = useCallback(() => {
    if (!selectedRoomId || selectedCells.size === 0) {return;}

    const dates = Array.from(selectedCells).map(key => {
      // Key format: {roomId}-{YYYY-MM-DD}, date is always last 10 chars
      const dateStr = key.slice(-10);
      // Use noon UTC to avoid timezone date shift
      return new Date(dateStr + 'T12:00:00Z');
    });

    unblockMutation.mutate({
      roomId: selectedRoomId,
      dates,
    });
    setShowReasonModal(false);
  }, [selectedRoomId, selectedCells, unblockMutation]);

  const handleClearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setSelectedRoomId(null);
  }, []);

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedCells(new Set());
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedCells(new Set());
  }, []);

  const formatMonthYear = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  const getCellClassName = useCallback((roomId: string, date: Date) => {
    const { status } = getCellStatus(roomId, date);
    const key = getCellKey(roomId, date);
    const isSelected = selectedCells.has(key);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = date < today;

    let baseClasses = 'h-11 w-11 min-h-11 min-w-11 text-fine flex items-center justify-center cursor-pointer transition-all border';

    if (isSelected) {
      baseClasses += ' ring-2 ring-brand-600 ring-offset-1';
    }

    if (isPast) {
      baseClasses += ' opacity-50';
    }

    switch (status) {
      case 'booked':
        return `${baseClasses} bg-brand-500 text-white border-brand-600 cursor-not-allowed`;
      case 'blocked':
        return `${baseClasses} bg-error-600 text-white border-error-700`;
      default:
        return `${baseClasses} bg-success-50 text-success-700 border-hairline hover:border-success-600`;
    }
  }, [getCellStatus, getCellKey, selectedCells]);

  const isLoading = blockedLoading || bookingsLoading;

  return (
    <div onMouseUp={handleMouseUp}>
      <AppShell variant="admin" title={t('admin.booking.availability.title')}>
        <p className="mb-6 text-caption text-ink-muted">{t('admin.booking.availability.subtitle')}</p>

        {/* Controls */}
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Room Type Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="availability-room-type" className="text-caption font-semibold text-ink">
                {t('admin.booking.availability.selectRoomType')}
              </label>
              <Select
                id="availability-room-type"
                value={selectedRoomTypeId}
                onChange={(e) => {
                  setSelectedRoomTypeId(e.target.value);
                  setSelectedCells(new Set());
                  setSelectedRoomId(null);
                }}
                className="w-auto min-w-[180px]"
              >
                <option value="all">{t('admin.booking.availability.allRoomTypes')}</option>
                {roomTypes?.map((rt: RoomType) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Month Navigation */}
            {selectedRoomTypeId && (
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handlePrevMonth}>
                  {t('common.previous')}
                </Button>
                <span className="min-w-[160px] text-center text-body font-semibold text-ink">
                  {formatMonthYear(currentMonth)}
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={handleNextMonth}>
                  {t('common.next')}
                </Button>
              </div>
            )}

            {/* Selection Actions */}
            {selectedCells.size > 0 && selectedRoomId && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-caption text-ink-muted">
                  {t('admin.booking.availability.selectedDates', { count: selectedCells.size })}
                </span>
                <Button type="button" variant="destructive" size="sm" onClick={handleBlockSelected}>
                  {t('admin.booking.availability.blockSelected')}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleClearSelection}>
                  {t('admin.booking.availability.clearSelection')}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Legend */}
        {selectedRoomTypeId && (
          <Card className="mb-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border border-hairline bg-success-50" />
                <span className="text-caption text-ink">{t('admin.booking.availability.available')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border border-error-700 bg-error-600" />
                <span className="text-caption text-ink">{t('admin.booking.availability.blocked')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border border-brand-600 bg-brand-500" />
                <span className="text-caption text-ink">{t('admin.booking.availability.booked')}</span>
              </div>
              <div className="ml-auto text-caption text-ink-muted">
                {t('admin.booking.availability.dragHint')}
              </div>
            </div>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <Card>
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-1/4 rounded-lg bg-surface-sunken" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-surface-sunken" />
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Calendar Grid */}
        {!isLoading && rooms && (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-surface-sunken">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[120px] bg-surface-sunken px-4 py-3 text-left text-fine font-semibold uppercase tracking-wider text-ink-muted">
                      {t('admin.booking.availability.room')}
                    </th>
                    {daysInMonth.map((date) => (
                      <th
                        key={date.toISOString()}
                        className="px-1 py-3 text-center text-fine font-semibold text-ink-muted"
                      >
                        <div>{date.getDate()}</div>
                        <div className="text-fine text-ink-faint">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline bg-surface-card">
                  {rooms.length === 0 ? (
                    <tr>
                      <td colSpan={daysInMonth.length + 1} className="px-6 py-12 text-center">
                        <div className="text-ink-muted">
                          <p className="text-body font-semibold">{t('admin.booking.availability.noRooms')}</p>
                          <p className="mt-1 text-caption">{t('admin.booking.availability.noRoomsDescription')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rooms.map((room: Room) => (
                      <tr key={room.id} className="hover:bg-surface-sunken">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-card px-4 py-2">
                          <div className="text-caption font-semibold text-ink">
                            {room.roomNumber}
                          </div>
                          {room.floor && (
                            <div className="text-fine text-ink-muted">
                              {t('admin.booking.availability.floor')} {room.floor}
                            </div>
                          )}
                        </td>
                        {daysInMonth.map((date) => (
                          <td
                            key={date.toISOString()}
                            className="px-1 py-2"
                          >
                            <div
                              className={getCellClassName(room.id, date)}
                              onClick={() => handleCellClick(room.id, date)}
                              onMouseDown={() => handleMouseDown(room.id, date)}
                              onMouseEnter={() => handleMouseEnter(room.id, date)}
                              title={getCellStatus(room.id, date).reason ?? getCellStatus(room.id, date).status}
                            >
                              {date.getDate()}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Block Modal */}
        <Modal
          open={showBlockModal}
          onClose={() => {
            setShowBlockModal(false);
            setBlockReason('');
          }}
          title={t('admin.booking.availability.blockDates')}
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowBlockModal(false);
                  setBlockReason('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmBlock}
                disabled={!blockReason.trim()}
                loading={blockMutation.isPending}
              >
                {blockMutation.isPending ? t('common.processing') : t('admin.booking.availability.confirmBlock')}
              </Button>
            </div>
          }
        >
          <Card className="mb-4 border-warning-200 bg-warning-50">
            <p className="text-caption text-warning-700">
              {t('admin.booking.availability.blockingInfo', { count: selectedCells.size })}
            </p>
          </Card>

          <FormField label={t('admin.booking.availability.blockReason')} htmlFor="block-reason" required>
            <Input
              id="block-reason"
              type="text"
              required
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder={t('admin.booking.availability.blockReasonPlaceholder')}
            />
          </FormField>
        </Modal>

        {/* View Blocked Reason Modal */}
        <Modal
          open={showReasonModal}
          onClose={() => {
            setShowReasonModal(false);
            setViewedBlockReason('');
            setSelectedCells(new Set());
            setSelectedRoomId(null);
          }}
          title={t('admin.booking.availability.blockedDate')}
          size="sm"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowReasonModal(false);
                  setViewedBlockReason('');
                  setSelectedCells(new Set());
                  setSelectedRoomId(null);
                }}
              >
                {t('common.close')}
              </Button>
              <Button
                type="button"
                onClick={handleUnblockSelected}
                loading={unblockMutation.isPending}
              >
                {unblockMutation.isPending ? t('common.processing') : t('admin.booking.availability.unblock')}
              </Button>
            </div>
          }
        >
          <Card className="border-error-200 bg-error-50">
            <p className="mb-1 text-caption font-semibold text-error-700">
              {t('admin.booking.availability.blockReason')}:
            </p>
            <p className="text-caption text-error-600">{viewedBlockReason || '-'}</p>
          </Card>
        </Modal>
      </AppShell>
    </div>
  );
};

export default RoomAvailability;
