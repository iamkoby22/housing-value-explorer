import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import EstimatePage from '@/app/estimate/page';
import { valuationRequestSchema } from '@/lib/valuation';

const validRequest = {
  zip_code: '37601',
  bedrooms: 3,
  other_rooms: 4,
  lot_size: 1 as const,
  year_built: 1995,
  structure_type: '2' as const,
  heating_fuel: '3' as const,
  household_income: 85_000,
  household_size: 3,
  household_type: '1' as const,
  year_moved: 2018,
  first_mortgage: 1_800,
  hoa_fee: 0,
  electricity: 160,
  gas: 80,
  other_fuel: 0,
  water_sewer: 900,
};

describe('Phase 3 valuation workspace', () => {
  it('renders a progressive homeowner workflow with scientific boundaries', () => {
    const html = renderToStaticMarkup(<EstimatePage />);
    expect(html).toContain('<h1>Estimate</h1>');
    expect(html).toContain('Property profile');
    expect(html).toContain('Research estimate, not an appraisal');
    expect(html).toContain('No name, email, or street address requested');
  });

  it('accepts a valid supported-domain request schema', () => {
    expect(valuationRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it('rejects malformed ZIPs, impossible counts, and non-finite numbers', () => {
    expect(() =>
      valuationRequestSchema.parse({ ...validRequest, zip_code: '3760A' }),
    ).toThrow();
    expect(() =>
      valuationRequestSchema.parse({ ...validRequest, bedrooms: -1 }),
    ).toThrow();
    expect(() =>
      valuationRequestSchema.parse({
        ...validRequest,
        first_mortgage: Infinity,
      }),
    ).toThrow();
  });

  it('allows unknown optional model inputs without inventing values', () => {
    const sparse: Record<string, unknown> = Object.fromEntries(
      Object.keys(validRequest).map((key) => [key, null]),
    );
    sparse.zip_code = '37601';
    expect(valuationRequestSchema.parse(sparse).zip_code).toBe('37601');
  });
});
