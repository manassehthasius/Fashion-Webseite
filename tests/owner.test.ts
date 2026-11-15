import { describe, expect, it } from 'vitest';
import { sizeFits } from '../shared/sizes';
import { ownerWants } from '../shared/owner';

describe('Grössen-Abgleich', () => {
  const T: [string, 'top' | 'bottom' | 'shoes', string[], boolean | null][] = [
    ['S', 'top', ['S', 'M'], true], ['ADULT | M', 'top', ['S', 'M'], true], ['4/S', 'top', ['S', 'M'], true], ['XL', 'top', ['S', 'M'], false],
    ['M - 40', 'top', ['S', 'M'], true], ['4XL', 'top', ['S', 'M'], false], ['SIZE 1 - SMALL', 'top', ['S', 'M'], true], ['48', 'top', ['S', 'M', '46', '48'], true],
    ['30 / 32', 'bottom', ['30', '32'], true], ['W32L32', 'bottom', ['30', '32'], true], ['34', 'bottom', ['30', '32'], false], ['48', 'bottom', ['46', '48'], true],
    ['41', 'shoes', ['41', '42'], true], ['41 1/3', 'shoes', ['41', '42'], true], ['43', 'shoes', ['41', '42'], false], ['UK8', 'shoes', ['41', '42'], true],
    ['UK9', 'shoes', ['41', '42'], false], ['8 (US) / 41 (E', 'shoes', ['41', '42'], true], ['10', 'shoes', ['41', '42'], false], ['ONE SIZE', 'top', ['S'], null],
  ];
  it.each(T)('%s (%s)', (raw, g, w, exp) => expect(sizeFits(raw, g, w)).toBe(exp));
});

describe('Persönlicher Katalog', () => {
  it('nur Herren/Unisex in meinen Grössen', () => {
    expect(ownerWants({ g: 'women', cat: 'tshirt', sza: ['S'] })).toBe(false);
    expect(ownerWants({ g: 'men', cat: 'tshirt', sza: ['L', 'XL'] })).toBe(false);
    expect(ownerWants({ g: 'men', cat: 'tshirt', sza: ['S', 'XL'] })).toBe(true);
    expect(ownerWants({ g: 'unisex', cat: 'sneakers', sza: ['43', '44'] })).toBe(false);
    expect(ownerWants({ g: 'unisex', cat: 'sneakers', sza: ['42', '44'] })).toBe(true);
    expect(ownerWants({ g: 'men', cat: 'bag', sza: [] })).toBe(true);
    expect(ownerWants({ g: 'men', cat: 'jeans', sza: ['31/32', '33/32'] })).toBe(false);
    expect(ownerWants({ g: 'men', cat: 'jeans', sza: ['30/32', '33/32'] })).toBe(true);
    expect(ownerWants({ g: 'kids', cat: 'tshirt', sza: ['S'] })).toBe(false);
  });
});

describe('Unisex-Ausreisser', () => {
  it('sortiert Damen-/Kinderteile ohne Geschlechtsangabe aus', () => {
    expect(ownerWants({ g: 'unisex', cat: 'shirt', sza: ['S'], t: 'EFINARAA FLANELL-BLUSE' })).toBe(false);
    expect(ownerWants({ g: 'unisex', cat: 'dress', sza: ['S'], t: 'Linen Wrapover Dress' })).toBe(false);
    expect(ownerWants({ g: 'unisex', cat: 'sweat', sza: ['S'], t: 'Kids Hoodie' })).toBe(false);
    expect(ownerWants({ g: 'unisex', cat: 'sweat', sza: ['M'], t: 'Heavyweight Hoodie' })).toBe(true);
  });
});
