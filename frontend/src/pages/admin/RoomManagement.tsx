import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppShell from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, FormField, Input, Modal, Select, Table, Textarea } from '../../components/ui';
import type { TableColumn } from '../../components/ui';

// Types based on backend schema
interface Room {
  id: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roomType?: {
    id: string;
    name: string;
  };
}

interface RoomType {
  id: string;
  name: string;
  isActive: boolean;
}

interface RoomFormData {
  roomTypeId: string;
  roomNumber: string;
  floor: number | string;
  notes: string;
  isActive: boolean;
}

const initialFormData: RoomFormData = {
  roomTypeId: '',
  roomNumber: '',
  floor: '',
  notes: '',
  isActive: true,
};

const CHECKBOX_CLASSES = 'h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600';

interface RoomFormFieldsProps {
  formId: string;
  formData: RoomFormData;
  setFormData: React.Dispatch<React.SetStateAction<RoomFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  roomTypes: RoomType[] | undefined;
  activeToggleId: string;
}

const RoomFormFields: React.FC<RoomFormFieldsProps> = ({
  formId,
  formData,
  setFormData,
  onSubmit,
  roomTypes,
  activeToggleId,
}) => {
  const { t } = useTranslation();

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-4">
      <FormField label={t('admin.booking.rooms.roomType')} htmlFor={`${formId}-roomType`} required>
        <Select
          id={`${formId}-roomType`}
          required
          value={formData.roomTypeId}
          onChange={(e) => setFormData({ ...formData, roomTypeId: e.target.value })}
        >
          <option value="">{t('admin.booking.rooms.selectRoomType')}</option>
          {roomTypes?.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t('admin.booking.rooms.roomNumber')} htmlFor={`${formId}-roomNumber`} required>
        <Input
          id={`${formId}-roomNumber`}
          type="text"
          required
          value={formData.roomNumber}
          onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
          placeholder={t('admin.booking.rooms.roomNumberPlaceholder')}
        />
      </FormField>

      <FormField label={t('admin.booking.rooms.floor')} htmlFor={`${formId}-floor`}>
        <Input
          id={`${formId}-floor`}
          type="number"
          value={formData.floor}
          onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
          placeholder={t('admin.booking.rooms.floorPlaceholder')}
        />
      </FormField>

      <FormField label={t('admin.booking.rooms.notes')} htmlFor={`${formId}-notes`}>
        <Textarea
          id={`${formId}-notes`}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder={t('admin.booking.rooms.notesPlaceholder')}
        />
      </FormField>

      <label htmlFor={activeToggleId} className="flex items-center gap-2">
        <input
          type="checkbox"
          id={activeToggleId}
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className={CHECKBOX_CLASSES}
        />
        <span className="text-caption text-ink">{t('admin.booking.rooms.isActive')}</span>
      </label>
    </form>
  );
};

const RoomManagement: React.FC = () => {
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<RoomFormData>(initialFormData);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [filterRoomTypeId, setFilterRoomTypeId] = useState<string>('');

  // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
  // TODO: Replace with REST service when Rust admin booking endpoints are implemented
  const queryClient = useQueryClient();

  const { data: roomTypes } = useQuery<RoomType[]>({
    queryKey: ['admin', 'roomTypes', { includeInactive: true }],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      return [];
    },
    refetchOnWindowFocus: false,
  });

  const { data: rooms, isLoading, error } = useQuery<Room[], Error>({
    queryKey: ['admin', 'rooms', { roomTypeId: filterRoomTypeId || undefined, includeInactive: true }],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      return [];
    },
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (_data: { roomTypeId: string; roomNumber: string; floor?: number; notes?: string; isActive: boolean }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.rooms.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.rooms.createError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (_data: { id: string; data: { roomTypeId: string; roomNumber: string; floor?: number; notes?: string; isActive: boolean } }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.rooms.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      setShowEditModal(false);
      setSelectedRoom(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.rooms.updateError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (_data: { id: string }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.rooms.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      setShowDeleteModal(false);
      setSelectedRoom(null);
      setDeleteConfirmText('');
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.rooms.deleteError'));
    },
  });

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
  }, []);

  const handleOpenCreate = useCallback(() => {
    resetForm();
    // Pre-select the first room type if available
    if (roomTypes && roomTypes.length > 0) {
      const firstRoomType = roomTypes[0];
      if (firstRoomType) {
        setFormData(prev => ({ ...prev, roomTypeId: firstRoomType.id }));
      }
    }
    setShowCreateModal(true);
  }, [resetForm, roomTypes]);

  const handleCancelCreate = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  const handleOpenEdit = useCallback((room: Room) => {
    setSelectedRoom(room);
    setFormData({
      roomTypeId: room.roomTypeId,
      roomNumber: room.roomNumber,
      floor: room.floor ?? '',
      notes: room.notes ?? '',
      isActive: room.isActive,
    });
    setShowEditModal(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setShowEditModal(false);
    setSelectedRoom(null);
    resetForm();
  }, [resetForm]);

  const handleOpenDelete = useCallback((room: Room) => {
    setSelectedRoom(room);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setSelectedRoom(null);
    setDeleteConfirmText('');
  }, []);

  const handleCreate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      roomTypeId: formData.roomTypeId,
      roomNumber: formData.roomNumber,
      floor: formData.floor !== '' ? Number(formData.floor) : undefined,
      notes: formData.notes || undefined,
      isActive: formData.isActive,
    };
    createMutation.mutate(data);
  }, [formData, createMutation]);

  const handleUpdate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) {return;}

    const data = {
      roomTypeId: formData.roomTypeId,
      roomNumber: formData.roomNumber,
      floor: formData.floor !== '' ? Number(formData.floor) : undefined,
      notes: formData.notes || undefined,
      isActive: formData.isActive,
    };
    updateMutation.mutate({ id: selectedRoom.id, data });
  }, [selectedRoom, formData, updateMutation]);

  const handleDelete = useCallback(() => {
    const deleteKeyword = t('admin.booking.rooms.deleteKeyword');
    if (!selectedRoom || deleteConfirmText !== deleteKeyword) {return;}
    deleteMutation.mutate({ id: selectedRoom.id });
  }, [selectedRoom, deleteConfirmText, deleteMutation, t]);

  const getRoomTypeName = useCallback((roomTypeId: string) => {
    const roomType = roomTypes?.find((rt: RoomType) => rt.id === roomTypeId);
    return roomType?.name ?? '-';
  }, [roomTypes]);

  const columns: TableColumn<Room>[] = [
    {
      key: 'roomNumber',
      header: t('admin.booking.rooms.roomNumber'),
      cell: (room) => <span className="text-body font-semibold text-ink">{room.roomNumber}</span>,
    },
    {
      key: 'floor',
      header: t('admin.booking.rooms.floor'),
      cell: (room) => room.floor ?? '-',
    },
    {
      key: 'roomType',
      header: t('admin.booking.rooms.roomType'),
      cell: (room) => getRoomTypeName(room.roomTypeId),
    },
    {
      key: 'notes',
      header: t('admin.booking.rooms.notes'),
      cell: (room) => <span className="block max-w-xs truncate">{room.notes ?? '-'}</span>,
    },
    {
      key: 'status',
      header: t('admin.booking.rooms.status'),
      cell: (room) => (
        <Badge tone={room.isActive ? 'success' : 'neutral'}>
          {room.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('admin.booking.rooms.actions'),
      cell: (room) => (
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(room)}>
            {t('common.edit')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(room)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell variant="admin" title={t('admin.booking.rooms.title')}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="text-caption text-ink-muted">{t('admin.booking.rooms.subtitle')}</p>
        <Button onClick={handleOpenCreate} disabled={!roomTypes || roomTypes.length === 0}>
          {t('admin.booking.rooms.createRoom')}
        </Button>
      </div>

      {/* Filter */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="room-type-filter" className="text-caption font-semibold text-ink">
            {t('admin.booking.rooms.filterByType')}
          </label>
          <Select
            id="room-type-filter"
            value={filterRoomTypeId}
            onChange={(e) => setFilterRoomTypeId(e.target.value)}
            className="w-auto min-w-[200px]"
          >
            <option value="">{t('admin.booking.rooms.allRoomTypes')}</option>
            {roomTypes?.map((rt: RoomType) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {error && (
        <Card className="mb-6 border-error-200 bg-error-50">
          <p className="text-caption font-semibold text-error-700">{t('common.error')}</p>
          <p className="text-caption text-error-600">{error.message}</p>
        </Card>
      )}

      {(!roomTypes || roomTypes.length === 0) && (
        <Card className="mb-6 border-warning-200 bg-warning-50">
          <p className="text-caption font-semibold text-warning-700">{t('admin.booking.rooms.noRoomTypesWarning')}</p>
          <p className="text-caption text-warning-600">{t('admin.booking.rooms.createRoomTypesFirst')}</p>
        </Card>
      )}

      <Table<Room>
        aria-label={t('admin.booking.rooms.title')}
        columns={columns}
        rows={rooms ?? []}
        rowKey={(room) => room.id}
        loading={isLoading}
        empty={
          <EmptyState
            title={t('admin.booking.rooms.noRooms')}
            description={t('admin.booking.rooms.noRoomsDescription')}
          />
        }
        mobileCard={(room) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-body font-semibold text-ink">{room.roomNumber}</p>
              <Badge tone={room.isActive ? 'success' : 'neutral'}>
                {room.isActive ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
            <p className="text-caption text-ink-muted">{getRoomTypeName(room.roomTypeId)}</p>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(room)}>
                {t('common.edit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(room)}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}
      />

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={handleCancelCreate}
        title={t('admin.booking.rooms.createRoom')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCancelCreate}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="room-create-form" loading={createMutation.isPending}>
              {createMutation.isPending ? t('common.processing') : t('common.create')}
            </Button>
          </div>
        }
      >
        <RoomFormFields
          formId="room-create-form"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreate}
          roomTypes={roomTypes}
          activeToggleId="isActive"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal && Boolean(selectedRoom)}
        onClose={handleCancelEdit}
        title={t('admin.booking.rooms.editRoom')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="room-edit-form" loading={updateMutation.isPending}>
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      >
        {selectedRoom && (
          <RoomFormFields
            formId="room-edit-form"
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdate}
            roomTypes={roomTypes}
            activeToggleId="isActiveEdit"
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal && Boolean(selectedRoom)}
        onClose={handleCancelDelete}
        title={t('admin.booking.rooms.deleteRoom')}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmText !== t('admin.booking.rooms.deleteKeyword')}
              loading={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('common.processing') : t('common.delete')}
            </Button>
          </div>
        }
      >
        {selectedRoom && (
          <>
            <Card className="mb-4 border-error-200 bg-error-50">
              <p className="mb-2 text-caption font-semibold text-error-700">
                {t('admin.booking.rooms.deleteWarning')}
              </p>
              <p className="text-caption text-error-600">{t('admin.booking.rooms.deleteConfirmText')}:</p>
              <p className="text-caption font-semibold text-error-700">
                {t('admin.booking.rooms.room')} &quot;{selectedRoom.roomNumber}&quot;
              </p>
            </Card>

            <FormField
              label={`${t('admin.booking.rooms.typeToConfirm')} ${t('admin.booking.rooms.deleteKeyword')} ${t('admin.booking.rooms.toConfirm')}`}
              htmlFor="room-delete-confirm-text"
            >
              <Input
                id="room-delete-confirm-text"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('admin.booking.rooms.deletePlaceholder')}
              />
            </FormField>
          </>
        )}
      </Modal>
    </AppShell>
  );
};

export default RoomManagement;
