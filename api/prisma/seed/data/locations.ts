export interface TownshipSeed {
  slug: string;
  nameEn: string;
  nameMy: string;
}
export interface CitySeed {
  slug: string;
  nameEn: string;
  nameMy: string;
  townships: TownshipSeed[];
}
export interface RegionSeed {
  slug: string;
  nameEn: string;
  nameMy: string;
  isActive: boolean;
  cities: CitySeed[];
}

/**
 * Launch coverage is Yangon and Mandalay. Naypyitaw is seeded but inactive to
 * demonstrate that adding a city is a data change, not a code change.
 */
export const regions: RegionSeed[] = [
  {
    slug: 'yangon-region',
    nameEn: 'Yangon Region',
    nameMy: 'ရန်ကုန်တိုင်းဒေသကြီး',
    isActive: true,
    cities: [
      {
        slug: 'yangon',
        nameEn: 'Yangon',
        nameMy: 'ရန်ကုန်',
        townships: [
          { slug: 'ahlone', nameEn: 'Ahlone', nameMy: 'အလုံ' },
          { slug: 'bahan', nameEn: 'Bahan', nameMy: 'ဗဟန်း' },
          { slug: 'botataung', nameEn: 'Botataung', nameMy: 'ဗိုလ်တထောင်' },
          { slug: 'dagon', nameEn: 'Dagon', nameMy: 'ဒဂုံ' },
          { slug: 'dagon-seikkan', nameEn: 'Dagon Seikkan', nameMy: 'ဒဂုံဆိပ်ကမ်း' },
          { slug: 'east-dagon', nameEn: 'East Dagon', nameMy: 'ဒဂုံမြို့သစ်(အရှေ့ပိုင်း)' },
          { slug: 'north-dagon', nameEn: 'North Dagon', nameMy: 'ဒဂုံမြို့သစ်(မြောက်ပိုင်း)' },
          { slug: 'south-dagon', nameEn: 'South Dagon', nameMy: 'ဒဂုံမြို့သစ်(တောင်ပိုင်း)' },
          { slug: 'dawbon', nameEn: 'Dawbon', nameMy: 'ဒေါပုံ' },
          { slug: 'hlaing', nameEn: 'Hlaing', nameMy: 'လှိုင်' },
          { slug: 'hlaing-tharyar', nameEn: 'Hlaing Tharyar', nameMy: 'လှိုင်သာယာ' },
          { slug: 'insein', nameEn: 'Insein', nameMy: 'အင်းစိန်' },
          { slug: 'kamayut', nameEn: 'Kamayut', nameMy: 'ကမာရွတ်' },
          { slug: 'kyauktada', nameEn: 'Kyauktada', nameMy: 'ကျောက်တံတား' },
          { slug: 'kyimyindaing', nameEn: 'Kyimyindaing', nameMy: 'ကြည့်မြင်တိုင်' },
          { slug: 'lanmadaw', nameEn: 'Lanmadaw', nameMy: 'လမ်းမတော်' },
          { slug: 'latha', nameEn: 'Latha', nameMy: 'လသာ' },
          { slug: 'mayangone', nameEn: 'Mayangone', nameMy: 'မရမ်းကုန်း' },
          {
            slug: 'mingalar-taung-nyunt',
            nameEn: 'Mingalar Taung Nyunt',
            nameMy: 'မင်္ဂလာတောင်ညွန့်',
          },
          { slug: 'mingaladon', nameEn: 'Mingaladon', nameMy: 'မင်္ဂလာဒုံ' },
          { slug: 'north-okkalapa', nameEn: 'North Okkalapa', nameMy: 'မြောက်ဥက္ကလာပ' },
          { slug: 'south-okkalapa', nameEn: 'South Okkalapa', nameMy: 'တောင်ဥက္ကလာပ' },
          { slug: 'pabedan', nameEn: 'Pabedan', nameMy: 'ပန်းဘဲတန်း' },
          { slug: 'pazundaung', nameEn: 'Pazundaung', nameMy: 'ပုဇွန်တောင်' },
          { slug: 'sanchaung', nameEn: 'Sanchaung', nameMy: 'စမ်းချောင်း' },
          { slug: 'seikkan', nameEn: 'Seikkan', nameMy: 'ဆိပ်ကမ်း' },
          { slug: 'shwepyithar', nameEn: 'Shwepyithar', nameMy: 'ရွှေပြည်သာ' },
          { slug: 'tamwe', nameEn: 'Tamwe', nameMy: 'တာမွေ' },
          { slug: 'thaketa', nameEn: 'Thaketa', nameMy: 'သာကေတ' },
          { slug: 'thingangyun', nameEn: 'Thingangyun', nameMy: 'သင်္ဃန်းကျွန်း' },
          { slug: 'thanlyin', nameEn: 'Thanlyin', nameMy: 'သန်လျင်' },
          { slug: 'yankin', nameEn: 'Yankin', nameMy: 'ရန်ကင်း' },
        ],
      },
    ],
  },
  {
    slug: 'mandalay-region',
    nameEn: 'Mandalay Region',
    nameMy: 'မန္တလေးတိုင်းဒေသကြီး',
    isActive: true,
    cities: [
      {
        slug: 'mandalay',
        nameEn: 'Mandalay',
        nameMy: 'မန္တလေး',
        townships: [
          { slug: 'aungmyaythazan', nameEn: 'Aungmyaythazan', nameMy: 'အောင်မြေသာစံ' },
          { slug: 'chanayethazan', nameEn: 'Chanayethazan', nameMy: 'ချမ်းအေးသာစံ' },
          { slug: 'chanmyathazi', nameEn: 'Chanmyathazi', nameMy: 'ချမ်းမြသာစည်' },
          { slug: 'mahaaungmyay', nameEn: 'Mahaaungmyay', nameMy: 'မဟာအောင်မြေ' },
          { slug: 'pyigyidagun', nameEn: 'Pyigyidagun', nameMy: 'ပြည်ကြီးတံခွန်' },
          { slug: 'amarapura', nameEn: 'Amarapura', nameMy: 'အမရပူရ' },
        ],
      },
    ],
  },
  {
    // Seeded but inactive: staged for a future launch, invisible to the public API.
    slug: 'naypyitaw-union-territory',
    nameEn: 'Naypyitaw Union Territory',
    nameMy: 'နေပြည်တော်ပြည်ထောင်စုနယ်မြေ',
    isActive: false,
    cities: [
      {
        slug: 'naypyitaw',
        nameEn: 'Naypyitaw',
        nameMy: 'နေပြည်တော်',
        townships: [
          { slug: 'zabuthiri', nameEn: 'Zabuthiri', nameMy: 'ဇမ္ဗူသီရိ' },
          { slug: 'pobbathiri', nameEn: 'Pobbathiri', nameMy: 'ပုဗ္ဗသီရိ' },
          { slug: 'ottarathiri', nameEn: 'Ottarathiri', nameMy: 'ဥတ္တရသီရိ' },
        ],
      },
    ],
  },
];
