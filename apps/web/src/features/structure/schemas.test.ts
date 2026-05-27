/**
 * Purpose: Unit tests for Residents/Houses/Areas form schemas and query serialization.
 * Caller: Vitest test runner.
 * Deps: Structure schemas and payload mappers.
 * MainFuncs: Verifies validation, empty optional field cleanup, and filter query behavior.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { buildStructureQuery, residentFormSchema, toCreateResidentPayload, toUpdateHousePayload } from './schemas';

describe('structure schemas', () => {
  it('validates resident form values and strips blank optional create fields', () => {
    const parsed = residentFormSchema.parse({
      houseId: '11111111-1111-4111-8111-111111111111',
      fullName: '  Siti Aminah  ',
      phone: '',
      defaultJimpitanAmount: '2500',
      notes: '',
    });

    expect(toCreateResidentPayload(parsed)).toEqual({
      houseId: '11111111-1111-4111-8111-111111111111',
      fullName: 'Siti Aminah',
      defaultJimpitanAmount: '2500',
    });
  });

  it('maps blank editable house note to null so users can clear it', () => {
    expect(
      toUpdateHousePayload({
        areaId: '22222222-2222-4222-8222-222222222222',
        houseNumber: 'A-01',
        addressNote: '',
        status: 'EMPTY',
      }),
    ).toEqual({
      areaId: '22222222-2222-4222-8222-222222222222',
      houseNumber: 'A-01',
      addressNote: null,
      status: 'EMPTY',
    });
  });

  it('rejects non-v4 UUIDs to match backend DTO validation', () => {
    expect(() =>
      residentFormSchema.parse({
        houseId: '11111111-1111-1111-8111-111111111111',
        fullName: 'Siti Aminah',
        phone: '',
        defaultJimpitanAmount: '',
        notes: '',
      }),
    ).toThrow();
  });

  it('serializes search and filter params without empty values', () => {
    expect(buildStructureQuery({ page: 2, limit: 20, search: 'Budi', areaId: '', includeArchived: true })).toBe('?page=2&limit=20&search=Budi&includeArchived=true');
  });
});
