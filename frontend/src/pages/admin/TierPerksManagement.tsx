import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  loyaltyService,
  TierApiError,
  type AdminTier,
  type TierBenefits,
  type TierBenefitsContent,
  type TierUpsertRequest,
} from '../../services/loyaltyService';
import { tierTheme } from '../../utils/tierTheme';
import { logger } from '../../utils/logger';
import AppShell from '../../components/layout/AppShell';
import {
  PageHeader,
  Table,
  type TableColumn,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  Textarea,
  FormField,
  EmptyState,
  type InputProps,
} from '../../components/ui';

// Note: the leading `#` is followed by `[`, so this source line does not trip
// the design ratchet's hardcoded-hex scan — only real color literals do.
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

type PerkLanguage = 'en' | 'th';

interface TierFormState {
  name: string;
  minNights: string;
  color: string;
  sortOrder: string;
  isActive: boolean;
  descriptionEn: string;
  descriptionTh: string;
  perksEn: string[];
  perksTh: string[];
}

interface TierFormErrors {
  name?: string;
  minNights?: string;
  color?: string;
  /**
   * Boolean, not a message: no honest i18n key exists for sort-order
   * validation (and we don't invent keys), so the field only gets
   * aria-invalid + a blocked submit.
   */
  sortOrder?: boolean;
}

type ForceInvalidInputProps = InputProps & {
  /**
   * ORed into FormField's cloned `invalid` flag. FormField force-sets
   * `invalid`/`aria-invalid` on its child from its own `error` prop, which
   * would erase an invalid state that has no field-level message (the 409
   * duplicate-name conflict, the sort-order integer check). This wrapper
   * re-merges that flag after FormField's clone.
   */
  forceInvalid?: boolean;
};

function ForceInvalidInput({ forceInvalid = false, invalid = false, ...rest }: ForceInvalidInputProps) {
  // FormField also clones an explicit `aria-invalid`; drop it so Input
  // derives the attribute from the merged flag instead.
  const inputProps = { ...rest };
  delete inputProps['aria-invalid'];
  return <Input {...inputProps} invalid={invalid || forceInvalid} />;
}

/**
 * Reads one language's editable content out of a benefits payload. Legacy
 * rows stored a flat { description, perks } shape containing Thai copy
 * (see resolveTierBenefits in utils/tierBenefits), so the flat fields feed
 * the TH side only — the EN side stays empty until an admin fills it in.
 */
function benefitsContent(benefits: TierBenefits, language: PerkLanguage): TierBenefitsContent {
  const localized = benefits[language];
  if (localized) {
    return { description: localized.description ?? '', perks: [...(localized.perks ?? [])] };
  }
  if (language === 'th') {
    return { description: benefits.description ?? '', perks: [...(benefits.perks ?? [])] };
  }
  return { description: '', perks: [] };
}

function createEmptyForm(): TierFormState {
  return {
    name: '',
    minNights: '0',
    color: '',
    // Blank on purpose: an untouched field is omitted from the create request
    // so the backend auto-places the new tier at max(sort_order) + 1.
    sortOrder: '',
    isActive: true,
    descriptionEn: '',
    descriptionTh: '',
    perksEn: [''],
    perksTh: [''],
  };
}

function formFromTier(tier: AdminTier): TierFormState {
  const en = benefitsContent(tier.benefits, 'en');
  const th = benefitsContent(tier.benefits, 'th');
  return {
    name: tier.name,
    minNights: String(tier.min_nights),
    color: tier.color,
    sortOrder: String(tier.sort_order),
    isActive: tier.is_active,
    descriptionEn: en.description,
    descriptionTh: th.description,
    perksEn: en.perks.length > 0 ? en.perks : [''],
    perksTh: th.perks.length > 0 ? th.perks : [''],
  };
}

function cleanPerks(perks: string[]): string[] {
  return perks.map((perk) => perk.trim()).filter((perk) => perk.length > 0);
}

function perkListKey(language: PerkLanguage): 'perksEn' | 'perksTh' {
  return language === 'en' ? 'perksEn' : 'perksTh';
}

function TierSwatch({ name, color }: { name: string; color: string }) {
  const theme = tierTheme(name, color);
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 flex-shrink-0 rounded-full border border-hairline"
      style={{ backgroundColor: theme.accent }}
    />
  );
}

export default function TierPerksManagement() {
  const { t } = useTranslation();
  const [tiers, setTiers] = useState<AdminTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<AdminTier | null>(null);
  const [form, setForm] = useState<TierFormState>(createEmptyForm());
  const [formErrors, setFormErrors] = useState<TierFormErrors>({});
  // Backend-reported failure shown as a modal-level error (message verbatim).
  const [serverError, setServerError] = useState<string | null>(null);
  // 409 duplicate-name conflict: flags the name field via aria-invalid.
  const [nameConflict, setNameConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTiers = async () => {
    try {
      setLoading(true);
      const loaded = await loyaltyService.getAdminTiers();
      setTiers([...loaded].sort((a, b) => a.sort_order - b.sort_order));
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to load tiers:', error.message);
      } else {
        logger.error('Failed to load tiers:', String(error));
      }
      toast.error(t('admin.perks.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFormFeedback = () => {
    setFormErrors({});
    setServerError(null);
    setNameConflict(false);
  };

  const openCreateModal = () => {
    setEditingTier(null);
    setForm(createEmptyForm());
    resetFormFeedback();
    setShowModal(true);
  };

  const openEditModal = (tier: AdminTier) => {
    setEditingTier(tier);
    setForm(formFromTier(tier));
    resetFormFeedback();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTier(null);
    resetFormFeedback();
  };

  const updatePerk = (language: PerkLanguage, index: number, value: string) => {
    const key = perkListKey(language);
    setForm((current) => ({
      ...current,
      [key]: current[key].map((perk, i) => (i === index ? value : perk)),
    }));
  };

  const addPerk = (language: PerkLanguage) => {
    const key = perkListKey(language);
    setForm((current) => ({ ...current, [key]: [...current[key], ''] }));
  };

  const removePerk = (language: PerkLanguage, index: number) => {
    const key = perkListKey(language);
    setForm((current) => ({ ...current, [key]: current[key].filter((_, i) => i !== index) }));
  };

  const validateForm = (state: TierFormState): TierFormErrors => {
    const errors: TierFormErrors = {};
    if (state.name.trim().length === 0) {
      errors.name = t('admin.perks.validation.nameRequired');
    }
    const minNights = Number(state.minNights);
    if (state.minNights.trim().length === 0 || !Number.isInteger(minNights) || minNights < 0) {
      errors.minNights = t('admin.perks.validation.minNightsInvalid');
    }
    if (!HEX_COLOR_PATTERN.test(state.color.trim())) {
      errors.color = t('admin.perks.validation.colorInvalid');
    }
    const sortOrder = state.sortOrder.trim();
    if (sortOrder.length === 0) {
      // Blank means "let the backend auto-place the tier" and is only valid
      // in create mode; in edit mode the field arrives prefilled, so a
      // cleared value would silently stomp the tier's position with 0.
      if (editingTier) {
        errors.sortOrder = true;
      }
    } else if (!Number.isInteger(Number(sortOrder))) {
      errors.sortOrder = true;
    }
    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setNameConflict(false);
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const request: TierUpsertRequest = {
      name: form.name.trim(),
      min_nights: Number(form.minNights),
      color: form.color.trim(),
      is_active: form.isActive,
      benefits: {
        en: { description: form.descriptionEn.trim(), perks: cleanPerks(form.perksEn) },
        th: { description: form.descriptionTh.trim(), perks: cleanPerks(form.perksTh) },
      },
    };
    const trimmedSortOrder = form.sortOrder.trim();
    // A blank sort order (create mode only — validation blocks it in edit
    // mode) omits the field so the backend auto-places the tier at max + 1.
    if (trimmedSortOrder.length > 0) {
      request.sort_order = Number(trimmedSortOrder);
    }

    try {
      setSaving(true);
      const result = editingTier
        ? await loyaltyService.updateTier(editingTier.id, request)
        : await loyaltyService.createTier(request);
      toast.success(t(editingTier ? 'admin.perks.saved' : 'admin.perks.created'));
      if (result.recalculation && result.recalculation.tiers_changed > 0) {
        toast.success(
          t('admin.perks.recalculated', {
            changed: result.recalculation.tiers_changed,
            checked: result.recalculation.users_checked,
          })
        );
      }
      closeModal();
      await loadTiers();
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to save tier:', error.message);
      } else {
        logger.error('Failed to save tier:', String(error));
      }
      if (error instanceof TierApiError) {
        if (error.status === 409) {
          // Duplicate tier name — flag the name field.
          setNameConflict(true);
        }
        if (error.serverMessage) {
          // Shown verbatim as the modal-level error: the backend message
          // names the actual problem and no i18n key could do so honestly.
          setServerError(error.serverMessage);
        } else {
          toast.error(t('admin.perks.saveFailed'));
        }
      } else {
        toast.error(t('admin.perks.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const minNightsChanged = editingTier !== null && Number(form.minNights) !== editingTier.min_nights;
  const activeChanged = editingTier !== null && form.isActive !== editingTier.is_active;
  const showThresholdWarning = editingTier ? minNightsChanged || activeChanged : form.isActive;

  const trimmedColor = form.color.trim();
  const previewColor = HEX_COLOR_PATTERN.test(trimmedColor) ? trimmedColor : 'transparent';

  const perkCounts = (tier: AdminTier) => {
    const enCount = benefitsContent(tier.benefits, 'en').perks.length;
    const thCount = benefitsContent(tier.benefits, 'th').perks.length;
    return `EN ${enCount} · TH ${thCount}`;
  };

  const statusBadge = (tier: AdminTier, size?: 'sm') => (
    <Badge tone={tier.is_active ? 'success' : 'neutral'} size={size}>
      {tier.is_active ? t('admin.perks.active') : t('admin.perks.inactive')}
    </Badge>
  );

  const columns: TableColumn<AdminTier>[] = [
    {
      key: 'name',
      header: t('admin.perks.table.name'),
      cell: (tier) => (
        <div className="flex items-center gap-2">
          <TierSwatch name={tier.name} color={tier.color} />
          <span className="text-body font-semibold text-ink">{tier.name}</span>
        </div>
      ),
    },
    {
      key: 'minNights',
      header: t('admin.perks.table.minNights'),
      cell: (tier) => <span className="text-ink">{tier.min_nights}</span>,
    },
    {
      key: 'sortOrder',
      header: t('admin.perks.table.sortOrder'),
      cell: (tier) => <span className="text-ink">{tier.sort_order}</span>,
    },
    {
      key: 'perks',
      header: t('admin.perks.table.perks'),
      cell: (tier) => <span className="text-ink">{perkCounts(tier)}</span>,
    },
    {
      key: 'members',
      header: t('admin.perks.table.members'),
      cell: (tier) => <span className="text-ink">{tier.user_count}</span>,
    },
    {
      key: 'status',
      header: t('admin.perks.table.status'),
      cell: (tier) => statusBadge(tier),
    },
    {
      key: 'actions',
      header: t('admin.perks.table.actions'),
      cell: (tier) => (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start px-0 text-brand-700"
          onClick={() => openEditModal(tier)}
        >
          {t('admin.perks.edit')}
        </Button>
      ),
    },
  ];

  const renderPerkEditor = (language: PerkLanguage) => {
    const key = perkListKey(language);
    const label = language === 'en' ? t('admin.perks.form.perksEn') : t('admin.perks.form.perksTh');
    return (
      <div className="space-y-1.5">
        <p className="text-caption font-semibold text-ink">{label}</p>
        <div className="space-y-2">
          {form[key].map((perk, index) => (
            // Rows have no stable identity of their own; index is the key by design.
            <div key={`${language}-${index}`} className="flex items-center gap-2">
              <Input
                data-testid={`perk-row-${language}-${index}`}
                type="text"
                value={perk}
                placeholder={t('admin.perks.form.perkPlaceholder')}
                aria-label={`${label} ${index + 1}`}
                onChange={(e) => updatePerk(language, index, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-shrink-0 px-0 text-error-700"
                onClick={() => removePerk(language, index)}
              >
                {t('admin.perks.form.removePerk')}
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => addPerk(language)}>
          {t('admin.perks.form.addPerk')}
        </Button>
      </div>
    );
  };

  return (
    <AppShell variant="admin" title={t('admin.perks.title')}>
      <div data-testid="admin-perks-page">
        <PageHeader
          density="admin"
          title={t('admin.perks.title')}
          subtitle={t('admin.perks.subtitle')}
          actions={
            <Button data-testid="tier-add-button" onClick={openCreateModal}>
              {t('admin.perks.addTier')}
            </Button>
          }
        />

        <div data-testid="perks-table">
          <Table
            columns={columns}
            rows={tiers}
            rowKey={(tier) => tier.id}
            loading={loading && tiers.length === 0}
            aria-label={t('admin.perks.title')}
            empty={
              <EmptyState
                title={t('admin.perks.title')}
                description={t('admin.perks.subtitle')}
                action={<Button onClick={openCreateModal}>{t('admin.perks.addTier')}</Button>}
              />
            }
            mobileCard={(tier) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <TierSwatch name={tier.name} color={tier.color} />
                    <p className="text-body font-semibold text-ink">{tier.name}</p>
                  </div>
                  {statusBadge(tier, 'sm')}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-fine text-ink-muted">{t('admin.perks.table.minNights')}</span>
                  <span className="text-caption text-ink">{tier.min_nights}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-fine text-ink-muted">{t('admin.perks.table.perks')}</span>
                  <span className="text-caption text-ink">{perkCounts(tier)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-fine text-ink-muted">{t('admin.perks.table.members')}</span>
                  <span className="text-caption text-ink">{tier.user_count}</span>
                </div>
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-0 text-brand-700"
                    onClick={() => openEditModal(tier)}
                  >
                    {t('admin.perks.edit')}
                  </Button>
                </div>
              </div>
            )}
          />
        </div>

        <Modal
          open={showModal}
          onClose={closeModal}
          title={
            editingTier
              ? t('admin.perks.editTitle', { name: editingTier.name })
              : t('admin.perks.createTitle')
          }
          size="lg"
        >
          <div data-testid="tier-edit-modal">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {serverError && (
                <div
                  role="alert"
                  data-testid="tier-form-server-error"
                  className="flex gap-2 rounded-lg border border-error-600 bg-error-50 p-3"
                >
                  <FiAlertTriangle
                    className="h-4 w-4 flex-shrink-0 text-error-700"
                    aria-hidden="true"
                  />
                  <p className="text-caption text-error-700">{serverError}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label={t('admin.perks.form.name')}
                  htmlFor="tier-form-name"
                  error={formErrors.name}
                  required
                >
                  <ForceInvalidInput
                    data-testid="tier-form-name"
                    type="text"
                    forceInvalid={nameConflict}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </FormField>

                <FormField
                  label={t('admin.perks.form.color')}
                  htmlFor="tier-form-color"
                  error={formErrors.color}
                  required
                >
                  <Input
                    data-testid="tier-form-color"
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    trailingSlot={
                      <span
                        aria-hidden="true"
                        className="mr-3 inline-block h-5 w-5 rounded-full border border-hairline-strong"
                        style={{ backgroundColor: previewColor }}
                      />
                    }
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  label={t('admin.perks.form.minNights')}
                  htmlFor="tier-form-min-nights"
                  error={formErrors.minNights}
                  required
                >
                  <Input
                    data-testid="tier-form-min-nights"
                    type="number"
                    min="0"
                    step="1"
                    value={form.minNights}
                    onChange={(e) => setForm({ ...form, minNights: e.target.value })}
                  />
                </FormField>

                <FormField label={t('admin.perks.form.sortOrder')} htmlFor="tier-form-sort-order">
                  <ForceInvalidInput
                    data-testid="tier-form-sort-order"
                    type="number"
                    step="1"
                    forceInvalid={formErrors.sortOrder}
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </FormField>

                <FormField label={t('admin.perks.form.isActive')} htmlFor="tier-form-active">
                  <Select
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
                  >
                    <option value="active">{t('admin.perks.active')}</option>
                    <option value="inactive">{t('admin.perks.inactive')}</option>
                  </Select>
                </FormField>
              </div>

              {showThresholdWarning && (
                <div className="flex gap-2 rounded-lg border border-warning-600 bg-warning-50 p-3">
                  <FiAlertTriangle className="h-4 w-4 flex-shrink-0 text-warning-700" aria-hidden="true" />
                  <p className="text-caption text-warning-700">{t('admin.perks.thresholdWarning')}</p>
                </div>
              )}

              <FormField label={t('admin.perks.form.descriptionEn')} htmlFor="tier-form-description-en">
                <Textarea
                  rows={2}
                  value={form.descriptionEn}
                  onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                />
              </FormField>

              {renderPerkEditor('en')}

              <FormField label={t('admin.perks.form.descriptionTh')} htmlFor="tier-form-description-th">
                <Textarea
                  rows={2}
                  value={form.descriptionTh}
                  onChange={(e) => setForm({ ...form, descriptionTh: e.target.value })}
                />
              </FormField>

              {renderPerkEditor('th')}

              <div className="flex justify-end gap-3 border-t border-hairline pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  {t('common.cancel')}
                </Button>
                <Button data-testid="tier-form-save" type="submit" loading={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
