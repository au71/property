import type { FieldSet } from '../../../src/generated/prisma/enums.js';

export interface CategorySeed {
  slug: string;
  nameEn: string;
  nameMy: string;
  fieldSet: FieldSet;
  iconKey: string;
  children: Array<Omit<CategorySeed, 'children'>>;
}

export const categories: CategorySeed[] = [
  {
    slug: 'residential',
    nameEn: 'Residential',
    nameMy: 'နေထိုင်ရန်',
    fieldSet: 'BUILDING',
    iconKey: 'home',
    children: [
      {
        slug: 'apartment',
        nameEn: 'Apartment',
        nameMy: 'တိုက်ခန်း',
        fieldSet: 'BUILDING',
        iconKey: 'building',
      },
      {
        slug: 'condo',
        nameEn: 'Condominium',
        nameMy: 'ကွန်ဒို',
        fieldSet: 'BUILDING',
        iconKey: 'building-2',
      },
      {
        slug: 'house',
        nameEn: 'House',
        nameMy: 'လုံးချင်းအိမ်',
        fieldSet: 'BUILDING',
        iconKey: 'house',
      },
      { slug: 'villa', nameEn: 'Villa', nameMy: 'ဗီလာ', fieldSet: 'BUILDING', iconKey: 'palmtree' },
      { slug: 'room', nameEn: 'Room', nameMy: 'အခန်း', fieldSet: 'BUILDING', iconKey: 'bed' },
    ],
  },
  {
    slug: 'land',
    nameEn: 'Land',
    nameMy: 'မြေကွက်',
    fieldSet: 'LAND',
    iconKey: 'land-plot',
    children: [
      {
        slug: 'residential-land',
        nameEn: 'Residential land',
        nameMy: 'နေရာထိုင်ခင်းမြေ',
        fieldSet: 'LAND',
        iconKey: 'land-plot',
      },
      {
        slug: 'commercial-land',
        nameEn: 'Commercial land',
        nameMy: 'စီးပွားရေးမြေ',
        fieldSet: 'LAND',
        iconKey: 'map',
      },
      {
        slug: 'farmland',
        nameEn: 'Farmland',
        nameMy: 'လယ်ယာမြေ',
        fieldSet: 'LAND',
        iconKey: 'wheat',
      },
      {
        slug: 'industrial-land',
        nameEn: 'Industrial land',
        nameMy: 'စက်မှုဇုန်မြေ',
        fieldSet: 'LAND',
        iconKey: 'factory',
      },
    ],
  },
  {
    slug: 'commercial',
    nameEn: 'Commercial',
    nameMy: 'စီးပွားရေး',
    fieldSet: 'COMMERCIAL',
    iconKey: 'store',
    children: [
      {
        slug: 'office',
        nameEn: 'Office',
        nameMy: 'ရုံးခန်း',
        fieldSet: 'COMMERCIAL',
        iconKey: 'briefcase',
      },
      {
        slug: 'shop',
        nameEn: 'Shop',
        nameMy: 'ဆိုင်ခန်း',
        fieldSet: 'COMMERCIAL',
        iconKey: 'store',
      },
      {
        slug: 'shophouse',
        nameEn: 'Shophouse',
        nameMy: 'ဆိုင်ခန်းနှင့်နေအိမ်',
        fieldSet: 'COMMERCIAL',
        iconKey: 'building',
      },
      {
        slug: 'warehouse',
        nameEn: 'Warehouse',
        nameMy: 'ဂိုဒေါင်',
        fieldSet: 'COMMERCIAL',
        iconKey: 'warehouse',
      },
      {
        slug: 'showroom',
        nameEn: 'Showroom',
        nameMy: 'ပြခန်း',
        fieldSet: 'COMMERCIAL',
        iconKey: 'gallery-horizontal',
      },
    ],
  },
  {
    slug: 'hospitality',
    nameEn: 'Hospitality',
    nameMy: 'ဟိုတယ်နှင့်တည်းခိုခန်း',
    fieldSet: 'COMMERCIAL',
    iconKey: 'hotel',
    children: [
      {
        slug: 'hotel',
        nameEn: 'Hotel',
        nameMy: 'ဟိုတယ်',
        fieldSet: 'COMMERCIAL',
        iconKey: 'hotel',
      },
      {
        slug: 'guesthouse',
        nameEn: 'Guest house',
        nameMy: 'တည်းခိုခန်း',
        fieldSet: 'COMMERCIAL',
        iconKey: 'bed-double',
      },
      {
        slug: 'serviced-apartment',
        nameEn: 'Serviced apartment',
        nameMy: 'ဝန်ဆောင်မှုပါတိုက်ခန်း',
        fieldSet: 'BUILDING',
        iconKey: 'concierge-bell',
      },
    ],
  },
];

export interface AmenitySeed {
  slug: string;
  nameEn: string;
  nameMy: string;
  appliesTo: FieldSet | null;
}

export const amenities: AmenitySeed[] = [
  { slug: 'lift', nameEn: 'Lift', nameMy: 'ဓာတ်လှေကား', appliesTo: 'BUILDING' },
  { slug: 'car-parking', nameEn: 'Car parking', nameMy: 'ကားပါကင်', appliesTo: null },
  { slug: 'generator', nameEn: 'Generator', nameMy: 'မီးစက်', appliesTo: null },
  { slug: 'solar', nameEn: 'Solar power', nameMy: 'ဆိုလာ', appliesTo: null },
  { slug: 'air-con', nameEn: 'Air conditioning', nameMy: 'အဲယားကွန်း', appliesTo: 'BUILDING' },
  { slug: 'water-tank', nameEn: 'Water tank', nameMy: 'ရေကန်', appliesTo: null },
  { slug: 'tube-well', nameEn: 'Tube well', nameMy: 'အက်တွင်း', appliesTo: null },
  { slug: 'city-water', nameEn: 'City water', nameMy: 'မြို့ရေ', appliesTo: null },
  { slug: 'security', nameEn: '24h security', nameMy: '၂၄နာရီလုံခြုံရေး', appliesTo: null },
  { slug: 'cctv', nameEn: 'CCTV', nameMy: 'စီစီတီဗွီ', appliesTo: null },
  { slug: 'gym', nameEn: 'Gym', nameMy: 'အားကစားခန်းမ', appliesTo: 'BUILDING' },
  { slug: 'swimming-pool', nameEn: 'Swimming pool', nameMy: 'ရေကူးကန်', appliesTo: 'BUILDING' },
  { slug: 'playground', nameEn: 'Playground', nameMy: 'ကစားကွင်း', appliesTo: 'BUILDING' },
  { slug: 'garden', nameEn: 'Garden', nameMy: 'ဥယျာဉ်', appliesTo: null },
  { slug: 'balcony', nameEn: 'Balcony', nameMy: 'ဝရန်တာ', appliesTo: 'BUILDING' },
  {
    slug: 'master-bedroom',
    nameEn: 'Master bedroom',
    nameMy: 'မာစတာဘက်ရွမ်',
    appliesTo: 'BUILDING',
  },
  {
    slug: 'furnished-kitchen',
    nameEn: 'Fitted kitchen',
    nameMy: 'မီးဖိုချောင်ပရိဘောဂ',
    appliesTo: 'BUILDING',
  },
  { slug: 'water-heater', nameEn: 'Water heater', nameMy: 'ရေနွေးစက်', appliesTo: 'BUILDING' },
  { slug: 'internet', nameEn: 'Internet ready', nameMy: 'အင်တာနက်', appliesTo: null },
  { slug: 'lobby', nameEn: 'Lobby', nameMy: 'ဧည့်ခန်းမ', appliesTo: 'BUILDING' },
  {
    slug: 'pet-friendly',
    nameEn: 'Pet friendly',
    nameMy: 'အိမ်မွေးတိရစ္ဆာန်ခေါ်ခွင့်',
    appliesTo: 'BUILDING',
  },
  { slug: 'corner-unit', nameEn: 'Corner unit', nameMy: 'ထောင့်ခန်း', appliesTo: 'BUILDING' },
  { slug: 'sea-view', nameEn: 'River view', nameMy: 'မြစ်မြင်ကွင်း', appliesTo: 'BUILDING' },
  { slug: 'main-road', nameEn: 'On main road', nameMy: 'လမ်းမပေါ်', appliesTo: null },
  { slug: 'near-market', nameEn: 'Near market', nameMy: 'ဈေးအနီး', appliesTo: null },
  { slug: 'near-school', nameEn: 'Near school', nameMy: 'ကျောင်းအနီး', appliesTo: null },
  { slug: 'near-hospital', nameEn: 'Near hospital', nameMy: 'ဆေးရုံအနီး', appliesTo: null },
  {
    slug: 'near-bus-stop',
    nameEn: 'Near bus stop',
    nameMy: 'ဘတ်စ်ကားမှတ်တိုင်အနီး',
    appliesTo: null,
  },
  {
    slug: 'fire-safety',
    nameEn: 'Fire safety system',
    nameMy: 'မီးသတ်စနစ်',
    appliesTo: 'COMMERCIAL',
  },
  { slug: 'loading-bay', nameEn: 'Loading bay', nameMy: 'ကုန်တင်ကုန်ချ', appliesTo: 'COMMERCIAL' },
  {
    slug: 'three-phase',
    nameEn: 'Three-phase power',
    nameMy: 'သုံးဖေ့စ်မီး',
    appliesTo: 'COMMERCIAL',
  },
  { slug: 'high-ceiling', nameEn: 'High ceiling', nameMy: 'အမိုးမြင့်', appliesTo: 'COMMERCIAL' },
  {
    slug: 'street-frontage',
    nameEn: 'Street frontage',
    nameMy: 'လမ်းမျက်နှာစာ',
    appliesTo: 'COMMERCIAL',
  },
  { slug: 'fenced', nameEn: 'Fenced', nameMy: 'ခြံစည်းရိုးပါ', appliesTo: 'LAND' },
  { slug: 'road-access', nameEn: 'Road access', nameMy: 'ကားလမ်းပေါက်', appliesTo: 'LAND' },
  {
    slug: 'electricity-ready',
    nameEn: 'Electricity connected',
    nameMy: 'မီးရရှိပြီး',
    appliesTo: 'LAND',
  },
  { slug: 'water-access', nameEn: 'Water access', nameMy: 'ရေရရှိနိုင်', appliesTo: 'LAND' },
  { slug: 'flat-land', nameEn: 'Flat land', nameMy: 'မြေညီ', appliesTo: 'LAND' },
  { slug: 'irrigated', nameEn: 'Irrigated', nameMy: 'ဆည်ရေသောက်', appliesTo: 'LAND' },
  { slug: 'title-ready', nameEn: 'Clear title', nameMy: 'ဂရန်ရှင်း', appliesTo: 'LAND' },
];
