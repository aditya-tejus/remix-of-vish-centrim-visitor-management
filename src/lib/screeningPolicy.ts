/**
 * Shared screening / vaccination / privacy policy.
 *
 * One rule set for both the front desk and the kiosk, so the two entry points
 * cannot drift apart. A switched-off feature means: no step, no validation and
 * nothing new written for that arrival.
 */

export interface ScreeningPolicy {
  /** Check-in questions are asked and stored. */
  screeningEnabled: boolean;
  /** Vaccination details are asked and stored. */
  vaccinationEnabled: boolean;
  /** A privacy acknowledgement is required before sign-in completes. */
  privacyRequired: boolean;
}

export interface PersonTypePolicyDefaults {
  screeningApplies: boolean;
  vaccinationApplies: boolean;
  privacyApplies: boolean;
}

export const OFF_POLICY: ScreeningPolicy = {
  screeningEnabled: false,
  vaccinationEnabled: false,
  privacyRequired: false,
};

/**
 * Resolves the policy for one person type from the person-type configuration
 * already loaded for the current site.
 */
export function resolveScreeningPolicy(
  defaults: PersonTypePolicyDefaults | null | undefined
): ScreeningPolicy {
  if (!defaults) return OFF_POLICY;
  const screeningEnabled = !!defaults.screeningApplies;
  return {
    screeningEnabled,
    // Vaccination is part of the questions pack: it can never be on while
    // check-in questions are off.
    vaccinationEnabled: screeningEnabled && !!defaults.vaccinationApplies,
    privacyRequired: !!defaults.privacyApplies,
  };
}

/**
 * Whether the screening step should appear at all, given the policy and what
 * is actually configured for this site.
 */
export function screeningStepApplies(
  policy: ScreeningPolicy,
  opts: { questionCount: number; vaccinationFieldCount: number; isContractor?: boolean }
): boolean {
  if (opts.isContractor) return true; // contractors always see credential screening
  if (!policy.screeningEnabled) return false;
  const vacc = policy.vaccinationEnabled ? opts.vaccinationFieldCount : 0;
  return opts.questionCount > 0 || vacc > 0;
}
