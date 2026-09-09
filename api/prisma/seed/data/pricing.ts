/**
 * Plausible price bands so that filters, sorting and "similar listings" produce
 * sensible results in a demo. Sale prices are MMK lakh (သိန်း); rent is MMK per
 * month. These are illustrative, not market data.
 */

/** Multiplier applied to the base band for a township, by desirability. */
export const TOWNSHIP_TIER: Record<string, number> = {
  // Yangon — central / high demand
  bahan: 1.9,
  kamayut: 1.6,
  sanchaung: 1.4,
  yankin: 1.5,
  mayangone: 1.4,
  dagon: 1.8,
  kyauktada: 1.7,
  pabedan: 1.5,
  botataung: 1.3,
  lanmadaw: 1.3,
  latha: 1.25,
  ahlone: 1.2,
  tamwe: 1.15,
  hlaing: 1.2,
  kyimyindaing: 1.1,
  'mingalar-taung-nyunt': 1.1,
  pazundaung: 1.1,
  thingangyun: 1.0,
  'south-okkalapa': 0.95,
  'north-okkalapa': 0.95,
  thaketa: 0.9,
  dawbon: 0.9,
  insein: 0.9,
  mingaladon: 0.8,
  'north-dagon': 0.85,
  'south-dagon': 0.8,
  'east-dagon': 0.75,
  'dagon-seikkan': 0.7,
  shwepyithar: 0.65,
  'hlaing-tharyar': 0.6,
  thanlyin: 0.7,
  seikkan: 1.0,
  // Mandalay — generally below Yangon
  chanayethazan: 1.1,
  aungmyaythazan: 1.0,
  mahaaungmyay: 0.95,
  chanmyathazi: 0.9,
  pyigyidagun: 0.85,
  amarapura: 0.7,
};

/** [min, max] in MMK lakh for a SALE, before the township multiplier. */
export const SALE_BAND_LAKH: Record<string, [number, number]> = {
  apartment: [700, 2600],
  condo: [1800, 7000],
  house: [2500, 12000],
  villa: [6000, 30000],
  room: [250, 900],
  'residential-land': [1200, 9000],
  'commercial-land': [3000, 20000],
  farmland: [200, 2000],
  'industrial-land': [4000, 25000],
  office: [2000, 9000],
  shop: [1500, 7000],
  shophouse: [2500, 11000],
  warehouse: [3000, 15000],
  showroom: [2500, 10000],
  hotel: [15000, 60000],
  guesthouse: [4000, 18000],
  'serviced-apartment': [2500, 9000],
};

/** [min, max] in MMK per month for a RENT, before the township multiplier. */
export const RENT_BAND_MMK: Record<string, [number, number]> = {
  apartment: [250_000, 1_200_000],
  condo: [700_000, 3_500_000],
  house: [800_000, 5_000_000],
  villa: [2_500_000, 12_000_000],
  room: [100_000, 350_000],
  'residential-land': [150_000, 800_000],
  'commercial-land': [400_000, 2_500_000],
  farmland: [80_000, 400_000],
  'industrial-land': [800_000, 4_000_000],
  office: [700_000, 4_500_000],
  shop: [500_000, 3_000_000],
  shophouse: [800_000, 4_000_000],
  warehouse: [900_000, 5_000_000],
  showroom: [800_000, 4_000_000],
  hotel: [5_000_000, 25_000_000],
  guesthouse: [1_500_000, 7_000_000],
  'serviced-apartment': [900_000, 4_000_000],
};
