import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppShell from '../../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, FormField, Input, Modal, Select, Table, Textarea } from '../../components/ui';
import type { TableColumn } from '../../components/ui';

// Types based on backend schema
interface RoomType {
  id: string;
  name: string;
  description: string | null;
  pricePerNight: number;
  maxGuests: number;
  bedType: 'single' | 'double' | 'twin' | 'king' | null;
  amenities: string[];
  images: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface RoomTypeFormData {
  name: string;
  description: string;
  pricePerNight: number;
  maxGuests: number;
  bedType: 'single' | 'double' | 'twin' | 'king' | '';
  amenities: string[];
  images: string[];
  isActive: boolean;
  sortOrder: number;
}

const AMENITIES_OPTIONS = [
  'wifi',
  'airConditioning',
  'minibar',
  'safe',
  'tv',
  'coffeemaker',
  'hairdryer',
  'bathtub',
  'balcony',
  'oceanView',
  'cityView',
  'roomService',
  'laundry',
  'breakfast',
];

const BED_TYPE_OPTIONS = ['single', 'double', 'twin', 'king'] as const;

const initialFormData: RoomTypeFormData = {
  name: '',
  description: '',
  pricePerNight: 0,
  maxGuests: 2,
  bedType: '',
  amenities: [],
  images: [],
  isActive: true,
  sortOrder: 0,
};

const CHECKBOX_CLASSES = 'h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600';

interface RoomTypeFormFieldsProps {
  formId: string;
  formData: RoomTypeFormData;
  setFormData: React.Dispatch<React.SetStateAction<RoomTypeFormData>>;
  imageInput: string;
  setImageInput: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (e: React.FormEvent) => void;
  onAddImage: () => void;
  onRemoveImage: (imageUrl: string) => void;
  onAmenityToggle: (amenity: string) => void;
  activeToggleId: string;
}

const RoomTypeFormFields: React.FC<RoomTypeFormFieldsProps> = ({
  formId,
  formData,
  setFormData,
  imageInput,
  setImageInput,
  onSubmit,
  onAddImage,
  onRemoveImage,
  onAmenityToggle,
  activeToggleId,
}) => {
  const { t } = useTranslation();

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-4">
      <FormField label={t('admin.booking.roomTypes.name')} htmlFor={`${formId}-name`} required>
        <Input
          id={`${formId}-name`}
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </FormField>

      <FormField label={t('admin.booking.roomTypes.description')} htmlFor={`${formId}-description`}>
        <Textarea
          id={`${formId}-description`}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label={`${t('admin.booking.roomTypes.pricePerNight')} (THB)`} htmlFor={`${formId}-price`} required>
          <Input
            id={`${formId}-price`}
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.pricePerNight}
            onChange={(e) => setFormData({ ...formData, pricePerNight: parseFloat(e.target.value) || 0 })}
          />
        </FormField>
        <FormField label={t('admin.booking.roomTypes.maxGuests')} htmlFor={`${formId}-maxGuests`} required>
          <Input
            id={`${formId}-maxGuests`}
            type="number"
            required
            min="1"
            value={formData.maxGuests}
            onChange={(e) => setFormData({ ...formData, maxGuests: parseInt(e.target.value) || 1 })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label={t('admin.booking.roomTypes.bedType')} htmlFor={`${formId}-bedType`}>
          <Select
            id={`${formId}-bedType`}
            value={formData.bedType}
            onChange={(e) => setFormData({ ...formData, bedType: e.target.value as typeof formData.bedType })}
          >
            <option value="">{t('admin.booking.roomTypes.selectBedType')}</option>
            {BED_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {t(`admin.booking.roomTypes.bedTypes.${type}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('admin.booking.roomTypes.sortOrder')} htmlFor={`${formId}-sortOrder`}>
          <Input
            id={`${formId}-sortOrder`}
            type="number"
            min="0"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
          />
        </FormField>
      </div>

      <div>
        <p className="mb-2 text-caption font-semibold text-ink">{t('admin.booking.roomTypes.amenities')}</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {AMENITIES_OPTIONS.map((amenity) => (
            <label key={amenity} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={formData.amenities.includes(amenity)}
                onChange={() => onAmenityToggle(amenity)}
                className={CHECKBOX_CLASSES}
              />
              <span className="text-caption text-ink">
                {t(`admin.booking.roomTypes.amenitiesList.${amenity}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${formId}-imageInput`} className="text-caption font-semibold text-ink">
          {t('admin.booking.roomTypes.images')}
        </label>
        <div className="flex gap-2">
          <Input
            id={`${formId}-imageInput`}
            type="url"
            value={imageInput}
            onChange={(e) => setImageInput(e.target.value)}
            placeholder={t('admin.booking.roomTypes.imageUrlPlaceholder')}
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={onAddImage}>
            {t('admin.booking.roomTypes.addImage')}
          </Button>
        </div>
        {formData.images.length > 0 && (
          <div className="space-y-2 pt-1">
            {formData.images.map((url) => (
              <div key={url} className="flex items-center gap-2 rounded-lg bg-surface-sunken p-2">
                <span className="flex-1 truncate text-caption text-ink-muted">{url}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveImage(url)}>
                  {t('common.remove')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label htmlFor={activeToggleId} className="flex items-center gap-2">
        <input
          type="checkbox"
          id={activeToggleId}
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className={CHECKBOX_CLASSES}
        />
        <span className="text-caption text-ink">{t('admin.booking.roomTypes.isActive')}</span>
      </label>
    </form>
  );
};

const RoomTypeManagement: React.FC = () => {
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [formData, setFormData] = useState<RoomTypeFormData>(initialFormData);
  const [imageInput, setImageInput] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
  // TODO: Replace with REST service when Rust admin booking endpoints are implemented
  const queryClient = useQueryClient();

  const { data: roomTypes, isLoading, error } = useQuery<RoomType[], Error>({
    queryKey: ['admin', 'roomTypes', { includeInactive: true }],
    queryFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      return [];
    },
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (_data: Record<string, unknown>) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.roomTypes.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'roomTypes'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.roomTypes.createError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (_data: { id: string; data: Record<string, unknown> }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.roomTypes.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'roomTypes'] });
      setShowEditModal(false);
      setSelectedRoomType(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.roomTypes.updateError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (_data: { id: string }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust admin booking endpoints are implemented
      throw new Error('Admin booking management is being migrated');
    },
    onSuccess: () => {
      toast.success(t('admin.booking.roomTypes.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'roomTypes'] });
      setShowDeleteModal(false);
      setSelectedRoomType(null);
      setDeleteConfirmText('');
    },
    onError: (error: Error) => {
      toast.error(error.message || t('admin.booking.roomTypes.deleteError'));
    },
  });

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setImageInput('');
  }, []);

  const handleOpenCreate = useCallback(() => {
    resetForm();
    setShowCreateModal(true);
  }, [resetForm]);

  const handleCancelCreate = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  const handleOpenEdit = useCallback((roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setFormData({
      name: roomType.name,
      description: roomType.description ?? '',
      pricePerNight: roomType.pricePerNight,
      maxGuests: roomType.maxGuests,
      bedType: roomType.bedType ?? '',
      amenities: roomType.amenities || [],
      images: roomType.images || [],
      isActive: roomType.isActive,
      sortOrder: roomType.sortOrder,
    });
    setShowEditModal(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setShowEditModal(false);
    setSelectedRoomType(null);
    resetForm();
  }, [resetForm]);

  const handleOpenDelete = useCallback((roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setSelectedRoomType(null);
    setDeleteConfirmText('');
  }, []);

  const handleCreate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      description: formData.description || undefined,
      pricePerNight: formData.pricePerNight,
      maxGuests: formData.maxGuests,
      bedType: formData.bedType || undefined,
      amenities: formData.amenities,
      images: formData.images,
      isActive: formData.isActive,
      sortOrder: formData.sortOrder,
    };
    createMutation.mutate(data as Record<string, unknown>);
  }, [formData, createMutation]);

  const handleUpdate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomType) {return;}

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      pricePerNight: formData.pricePerNight,
      maxGuests: formData.maxGuests,
      bedType: formData.bedType || undefined,
      amenities: formData.amenities,
      images: formData.images,
      isActive: formData.isActive,
      sortOrder: formData.sortOrder,
    };
    updateMutation.mutate({
      id: selectedRoomType.id,
      data: data as Record<string, unknown>
    });
  }, [selectedRoomType, formData, updateMutation]);

  const handleDelete = useCallback(() => {
    const deleteKeyword = t('admin.booking.roomTypes.deleteKeyword');
    if (!selectedRoomType || deleteConfirmText !== deleteKeyword) {return;}
    deleteMutation.mutate({ id: selectedRoomType.id });
  }, [selectedRoomType, deleteConfirmText, deleteMutation, t]);

  const handleAddImage = useCallback(() => {
    if (imageInput.trim() && !formData.images.includes(imageInput.trim())) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, imageInput.trim()],
      }));
      setImageInput('');
    }
  }, [imageInput, formData.images]);

  const handleRemoveImage = useCallback((imageUrl: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img !== imageUrl),
    }));
  }, []);

  const handleAmenityToggle = useCallback((amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  const columns: TableColumn<RoomType>[] = [
    {
      key: 'name',
      header: t('admin.booking.roomTypes.name'),
      cell: (roomType) => (
        <div>
          <p className="text-body font-semibold text-ink">{roomType.name}</p>
          {roomType.description && (
            <p className="max-w-xs truncate text-fine text-ink-muted">{roomType.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: t('admin.booking.roomTypes.pricePerNight'),
      cell: (roomType) => formatCurrency(roomType.pricePerNight),
    },
    {
      key: 'maxGuests',
      header: t('admin.booking.roomTypes.maxGuests'),
      cell: (roomType) => `${roomType.maxGuests} ${t('admin.booking.roomTypes.guests')}`,
    },
    {
      key: 'bedType',
      header: t('admin.booking.roomTypes.bedType'),
      cell: (roomType) => (roomType.bedType ? t(`admin.booking.roomTypes.bedTypes.${roomType.bedType}`) : '-'),
    },
    {
      key: 'status',
      header: t('admin.booking.roomTypes.status'),
      cell: (roomType) => (
        <Badge tone={roomType.isActive ? 'success' : 'neutral'}>
          {roomType.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('admin.booking.roomTypes.actions'),
      cell: (roomType) => (
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(roomType)}>
            {t('common.edit')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(roomType)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell variant="admin" title={t('admin.booking.roomTypes.title')}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="text-caption text-ink-muted">{t('admin.booking.roomTypes.subtitle')}</p>
        <Button onClick={handleOpenCreate}>{t('admin.booking.roomTypes.createRoomType')}</Button>
      </div>

      {error && (
        <Card className="mb-6 border-error-200 bg-error-50">
          <p className="text-caption font-semibold text-error-700">{t('common.error')}</p>
          <p className="text-caption text-error-600">{error.message}</p>
        </Card>
      )}

      <Table<RoomType>
        aria-label={t('admin.booking.roomTypes.title')}
        columns={columns}
        rows={roomTypes ?? []}
        rowKey={(roomType) => roomType.id}
        loading={isLoading}
        empty={
          <EmptyState
            title={t('admin.booking.roomTypes.noRoomTypes')}
            description={t('admin.booking.roomTypes.noRoomTypesDescription')}
          />
        }
        mobileCard={(roomType) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-body font-semibold text-ink">{roomType.name}</p>
              <Badge tone={roomType.isActive ? 'success' : 'neutral'}>
                {roomType.isActive ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-caption text-ink-muted">
              <span>{formatCurrency(roomType.pricePerNight)}</span>
              <span>{roomType.maxGuests} {t('admin.booking.roomTypes.guests')}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(roomType)}>
                {t('common.edit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(roomType)}>
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
        title={t('admin.booking.roomTypes.createRoomType')}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCancelCreate}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="room-type-create-form" loading={createMutation.isPending}>
              {createMutation.isPending ? t('common.processing') : t('common.create')}
            </Button>
          </div>
        }
      >
        <RoomTypeFormFields
          formId="room-type-create-form"
          formData={formData}
          setFormData={setFormData}
          imageInput={imageInput}
          setImageInput={setImageInput}
          onSubmit={handleCreate}
          onAddImage={handleAddImage}
          onRemoveImage={handleRemoveImage}
          onAmenityToggle={handleAmenityToggle}
          activeToggleId="isActive"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal && Boolean(selectedRoomType)}
        onClose={handleCancelEdit}
        title={t('admin.booking.roomTypes.editRoomType')}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="room-type-edit-form" loading={updateMutation.isPending}>
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      >
        {selectedRoomType && (
          <RoomTypeFormFields
            formId="room-type-edit-form"
            formData={formData}
            setFormData={setFormData}
            imageInput={imageInput}
            setImageInput={setImageInput}
            onSubmit={handleUpdate}
            onAddImage={handleAddImage}
            onRemoveImage={handleRemoveImage}
            onAmenityToggle={handleAmenityToggle}
            activeToggleId="isActiveEdit"
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal && Boolean(selectedRoomType)}
        onClose={handleCancelDelete}
        title={t('admin.booking.roomTypes.deleteRoomType')}
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
              disabled={deleteConfirmText !== t('admin.booking.roomTypes.deleteKeyword')}
              loading={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('common.processing') : t('common.delete')}
            </Button>
          </div>
        }
      >
        {selectedRoomType && (
          <>
            <Card className="mb-4 border-error-200 bg-error-50">
              <p className="mb-2 text-caption font-semibold text-error-700">
                {t('admin.booking.roomTypes.deleteWarning')}
              </p>
              <p className="text-caption text-error-600">{t('admin.booking.roomTypes.deleteConfirmText')}:</p>
              <p className="text-caption font-semibold text-error-700">&quot;{selectedRoomType.name}&quot;</p>
            </Card>

            <FormField
              label={`${t('admin.booking.roomTypes.typeToConfirm')} ${t('admin.booking.roomTypes.deleteKeyword')} ${t('admin.booking.roomTypes.toConfirm')}`}
              htmlFor="delete-confirm-text"
            >
              <Input
                id="delete-confirm-text"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('admin.booking.roomTypes.deletePlaceholder')}
              />
            </FormField>
          </>
        )}
      </Modal>
    </AppShell>
  );
};

export default RoomTypeManagement;
