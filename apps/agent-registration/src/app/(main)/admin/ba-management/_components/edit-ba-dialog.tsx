'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { updateBrandAmbassador, getPartners, getBrandAmbassadorRoles, BrandAmbassador, Partner, ROLES } from '@/lib/api';
import { formatPhoneNumber, getPhoneValidationError } from '@/lib/phone-validation';
import * as Sentry from '@sentry/nextjs';

interface EditBADialogProps {
  brandAmbassador: BrandAmbassador;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditBADialog({
  brandAmbassador,
  open,
  onOpenChange,
  onSuccess,
}: EditBADialogProps) {
  const [formData, setFormData] = useState({
    partnerId: brandAmbassador.partnerId,
    phoneNumber: brandAmbassador.phoneNumber ?? '',
    perRegistrationRateShillings: brandAmbassador.perRegistrationRateCents
      ? Math.round(brandAmbassador.perRegistrationRateCents / 100).toString()
      : '0',
    isActive: brandAmbassador.isActive,
    roles: [] as string[],
  });
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    try {
      setLoadingPartners(true);
      const partnersData = await getPartners();
      setPartners(partnersData);
    } catch (err) {
      console.error('Failed to load partners:', err);
      setError('Failed to load partners');
    } finally {
      setLoadingPartners(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      setLoadingRoles(true);
      const roles = await getBrandAmbassadorRoles(brandAmbassador.id);
      setFormData(prev => ({ ...prev, roles }));
    } catch (err) {
      console.error('Failed to load roles:', err);
      setError('Failed to load roles');
    } finally {
      setLoadingRoles(false);
    }
  }, [brandAmbassador.id]);

  // Load partners and roles when dialog opens
  useEffect(() => {
    if (open) {
      loadPartners();
      loadRoles();
      // Reset form data when dialog opens (roles will be set by loadRoles)
      setFormData({
        partnerId: brandAmbassador.partnerId,
        phoneNumber: brandAmbassador.phoneNumber ?? '',
        perRegistrationRateShillings: brandAmbassador.perRegistrationRateCents
          ? Math.round(brandAmbassador.perRegistrationRateCents / 100).toString()
          : '0',
        isActive: brandAmbassador.isActive,
        roles: [],
      });
    }
  }, [open, brandAmbassador, loadPartners, loadRoles]);

  const handleRoleToggle = (role: string, checked: boolean) => {
    // Ensure at least one role remains selected
    if (!checked && formData.roles.length === 1) {
      setError('User must have at least one role');
      return;
    }

    setFormData(prev => ({
      ...prev,
      roles: checked
        ? [...prev.roles, role]
        : prev.roles.filter(r => r !== role)
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate phone number if provided
      if (formData.phoneNumber) {
        const phoneErr = getPhoneValidationError(formData.phoneNumber);
        if (phoneErr) {
          setPhoneError(phoneErr);
          setLoading(false);
          return;
        }
      }

      // Validate roles - must have at least one
      if (formData.roles.length === 0) {
        setError('User must have at least one role');
        setLoading(false);
        return;
      }

      const updateData: {
        partnerId?: number;
        phoneNumber?: string;
        perRegistrationRateShillings?: number;
        isActive?: boolean;
        roles?: string[];
      } = {};

      // Only include fields that have changed
      if (formData.partnerId !== brandAmbassador.partnerId) {
        updateData.partnerId = formData.partnerId;
      }

      if (formData.phoneNumber !== (brandAmbassador.phoneNumber ?? '')) {
        updateData.phoneNumber = formData.phoneNumber || undefined;
      }

      const rateShillings = parseFloat(formData.perRegistrationRateShillings) || 0;
      const currentRateShillings = brandAmbassador.perRegistrationRateCents
        ? brandAmbassador.perRegistrationRateCents / 100
        : 0;

      if (Math.abs(rateShillings - currentRateShillings) > 0.01) {
        updateData.perRegistrationRateShillings = rateShillings;
      }

      if (formData.isActive !== brandAmbassador.isActive) {
        updateData.isActive = formData.isActive;
      }

      // Check if roles have changed (need to compare with current roles)
      // We'll always include roles if they were loaded, to ensure they're in sync
      if (formData.roles.length > 0) {
        updateData.roles = formData.roles;
      }

      // Only call API if there are changes
      if (Object.keys(updateData).length > 0) {
        await updateBrandAmbassador(brandAmbassador.id, updateData);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating brand ambassador:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'EditBADialog',
            action: 'update_brand_ambassador',
          },
          extra: {
            baId: brandAmbassador.id,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update brand ambassador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Brand Ambassador</DialogTitle>
          <DialogDescription>Update brand ambassador information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={brandAmbassador.displayName ?? 'N/A'}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              Display name cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partnerId">Partner *</Label>
            <Select
              value={formData.partnerId.toString()}
              onValueChange={(value) => setFormData({ ...formData, partnerId: parseInt(value) })}
              disabled={loadingPartners}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingPartners ? 'Loading partners...' : 'Select a partner'} />
              </SelectTrigger>
              <SelectContent>
                {partners.filter(p => p.isActive).map((partner) => (
                  <SelectItem key={partner.id} value={partner.id.toString()}>
                    {partner.partnerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value);
                setFormData({ ...formData, phoneNumber: formatted });
                setPhoneError(getPhoneValidationError(formatted));
              }}
              placeholder="01XXXXXXXX or 07XXXXXXXX"
              maxLength={10}
            />
            {phoneError && (
              <p className="text-sm text-destructive">{phoneError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="perRegistrationRateShillings">Rate per Registration (KSh)</Label>
              <Input
                id="perRegistrationRateShillings"
                type="number"
                value={formData.perRegistrationRateShillings}
                onChange={(e) => setFormData({ ...formData, perRegistrationRateShillings: e.target.value })}
                placeholder="200"
                min="0"
              />
              <p className="text-sm text-muted-foreground">
                Rate in Kenyan Shillings per successful registration
              </p>
          </div>

          <div className="space-y-3">
            <Label>User Roles *</Label>
            {loadingRoles ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading roles...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="brand_ambassador"
                      checked={formData.roles.includes(ROLES.BRAND_AMBASSADOR)}
                      onCheckedChange={(checked) => handleRoleToggle(ROLES.BRAND_AMBASSADOR, checked as boolean)}
                      disabled={formData.roles.length === 1 && formData.roles.includes(ROLES.BRAND_AMBASSADOR)}
                    />
                    <Label htmlFor="brand_ambassador" className="text-sm font-normal">
                      Agent (can register customers)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="registration_admin"
                      checked={formData.roles.includes(ROLES.REGISTRATION_ADMIN)}
                      onCheckedChange={(checked) => handleRoleToggle(ROLES.REGISTRATION_ADMIN, checked as boolean)}
                      disabled={formData.roles.length === 1 && formData.roles.includes(ROLES.REGISTRATION_ADMIN)}
                    />
                    <Label htmlFor="registration_admin" className="text-sm font-normal">
                      Registration Admin (can manage Agents and resolve MRs)
                    </Label>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select one or both roles. User must have at least one role.
                </p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between space-x-2 p-4 border rounded-md">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-base">
                Status
              </Label>
              <p className="text-sm text-muted-foreground">
                {formData.isActive
                  ? 'Brand Ambassador is active and can log in'
                  : 'Brand Ambassador is inactive and cannot log in'}
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

