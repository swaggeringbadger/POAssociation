/**
 * AddressInput Component
 *
 * Address input with Radar.io autocomplete and validation.
 * Shows suggestions as user types and validates the final address.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, MapPin, AlertCircle, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface AddressSuggestion {
  formattedAddress: string;
  addressLabel: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface AddressValidationResult {
  isValid: boolean;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: string | null;
  verificationStatus: 'verified' | 'unverified' | 'ambiguous';
  components: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  } | null;
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidated?: (result: AddressValidationResult) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressInput({
  value,
  onChange,
  onValidated,
  label = 'Property Address',
  placeholder = 'Start typing an address...',
  required = false,
  error,
  className,
  disabled = false,
}: AddressInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [validationResult, setValidationResult] = useState<AddressValidationResult | null>(null);
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use ref to track selection across render cycles (avoids stale closure in setTimeout)
  const hasSelectedRef = useRef(false);

  // Check if Radar is configured
  const { data: addressStatus } = useQuery({
    queryKey: ['address-status'],
    queryFn: () => apiRequest('GET', '/api/address/status'),
    staleTime: Infinity,
  });

  // Autocomplete query with debouncing
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { data: suggestions, isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['address-autocomplete', debouncedQuery],
    queryFn: () => apiRequest('GET', `/api/address/autocomplete?query=${encodeURIComponent(debouncedQuery)}`),
    enabled: !!debouncedQuery && debouncedQuery.length >= 3 && !hasSelectedSuggestion && addressStatus?.configured,
    staleTime: 30000,
  });

  // Validation mutation - accepts address and optional coordinates from autocomplete selection
  const validateMutation = useMutation({
    mutationFn: (params: { address: string; latitude?: number; longitude?: number }) =>
      apiRequest('POST', '/api/address/validate', params),
    onSuccess: (result: AddressValidationResult) => {
      setValidationResult(result);
      if (result.isValid && result.formattedAddress) {
        onChange(result.formattedAddress);
        setInputValue(result.formattedAddress);
      }
      onValidated?.(result);
    },
  });

  // Debounce input for autocomplete
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (inputValue && inputValue.length >= 3 && !hasSelectedSuggestion) {
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(inputValue);
      }, 300);
    } else {
      setDebouncedQuery('');
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, hasSelectedSuggestion]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHasSelectedSuggestion(false);
    hasSelectedRef.current = false; // Reset ref too
    setValidationResult(null);
    setShowSuggestions(true);
    setSelectedIndex(-1);
    onChange(newValue);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: AddressSuggestion) => {
    console.log('[AddressInput] Selected suggestion:', suggestion);
    console.log('[AddressInput] Coordinates:', suggestion.latitude, suggestion.longitude);

    // Set ref FIRST to prevent blur handler from firing (ref survives across renders)
    hasSelectedRef.current = true;

    setInputValue(suggestion.formattedAddress);
    onChange(suggestion.formattedAddress);
    setHasSelectedSuggestion(true);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Validate the selected address - pass coordinates from autocomplete to avoid re-geocoding mismatch
    const payload = {
      address: suggestion.formattedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    };
    console.log('[AddressInput] Sending validation payload:', payload);
    validateMutation.mutate(payload);
  }, [onChange, validateMutation]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const suggestionList = suggestions?.suggestions || [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestionList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestionList[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Handle blur - validate if not already validated
  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
      // Use ref instead of state to avoid stale closure issue
      // The state value would be from when handleBlur was called, not when setTimeout fires
      if (!hasSelectedRef.current && !validateMutation.isPending) {
        // Get current input value from the DOM to avoid stale closure
        const currentValue = inputRef.current?.value || '';
        if (currentValue && addressStatus?.configured) {
          console.log('[AddressInput] Blur validation for manual entry:', currentValue);
          // Manual entry without selecting from autocomplete - no coordinates available
          validateMutation.mutate({ address: currentValue });
        }
      }
    }, 200);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync with external value changes
  useEffect(() => {
    if (value !== inputValue && value !== '') {
      setInputValue(value);
    }
  }, [value]);

  const suggestionList = suggestions?.suggestions || [];
  const isValidating = validateMutation.isPending;
  const showValidationStatus = hasSelectedSuggestion || validationResult;

  // Determine validation status display
  const getValidationStatus = () => {
    if (isValidating) {
      return { icon: Loader2, color: 'text-muted-foreground', message: 'Validating address...', animate: true };
    }
    if (validationResult?.verificationStatus === 'verified') {
      return { icon: Check, color: 'text-green-600', message: 'Address verified', animate: false };
    }
    if (validationResult?.verificationStatus === 'ambiguous') {
      return { icon: AlertCircle, color: 'text-yellow-600', message: 'Address may need verification', animate: false };
    }
    if (validationResult?.verificationStatus === 'unverified') {
      return { icon: AlertCircle, color: 'text-red-600', message: 'Could not verify address', animate: false };
    }
    return null;
  };

  const validationStatus = getValidationStatus();

  return (
    <div className={cn('relative', className)}>
      {label && (
        <Label htmlFor="address-input" className="mb-2 block">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="address-input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 3 && !hasSelectedSuggestion && setShowSuggestions(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pl-10 pr-10',
            validationResult?.verificationStatus === 'verified' && 'border-green-500 focus-visible:ring-green-500',
            validationResult?.verificationStatus === 'unverified' && 'border-red-500 focus-visible:ring-red-500',
            error && 'border-destructive'
          )}
          autoComplete="off"
        />

        {/* Status indicator on right side */}
        {(isValidating || validationResult) && (
          <div className={cn('absolute right-3 top-1/2 -translate-y-1/2', validationStatus?.color)}>
            {validationStatus && (
              <validationStatus.icon
                className={cn('h-4 w-4', validationStatus.animate && 'animate-spin')}
              />
            )}
          </div>
        )}

        {/* Loading indicator for autocomplete */}
        {isLoadingSuggestions && !isValidating && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestionList.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestionList.map((suggestion: AddressSuggestion, index: number) => (
            <button
              key={`${suggestion.formattedAddress}-${index}`}
              type="button"
              className={cn(
                'w-full px-3 py-2 text-left hover:bg-muted transition-colors',
                'flex items-start gap-2',
                selectedIndex === index && 'bg-muted'
              )}
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{suggestion.addressLabel}</p>
                {suggestion.city && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[suggestion.city, suggestion.state, suggestion.postalCode].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Validation status message */}
      {validationStatus && !isValidating && (
        <p className={cn('text-sm mt-1', validationStatus.color)}>
          {validationStatus.message}
        </p>
      )}

      {/* Formatted address display when different from input */}
      {validationResult?.formattedAddress && validationResult.formattedAddress !== inputValue && (
        <p className="text-sm text-muted-foreground mt-1">
          Formatted: {validationResult.formattedAddress}
        </p>
      )}

      {/* Coordinates display for debugging/confirmation */}
      {validationResult?.latitude && validationResult?.longitude && (
        <p className="text-xs text-muted-foreground mt-1">
          Coordinates: {validationResult.latitude.toFixed(6)}, {validationResult.longitude.toFixed(6)}
        </p>
      )}

      {/* Error message */}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}

      {/* No Radar configured warning */}
      {addressStatus && !addressStatus.configured && (
        <p className="text-xs text-muted-foreground mt-1">
          Address validation is not configured. Addresses will not be verified.
        </p>
      )}
    </div>
  );
}
