const MALE_GIVEN = [
  'Aung Myint',
  'Zaw Lin',
  'Kyaw Soe',
  'Thet Naing',
  'Myo Min Htut',
  'Ye Htut',
  'Tin Maung Oo',
  'Sai Kham Leng',
  'Hla Moe',
  'Nyan Win',
  'Kyaw Zaw Hein',
  'Thura Aung',
  'Min Thant',
  'Soe Naing',
  'Zeya Htun',
  'Kaung Myat',
  'Wunna Kyaw',
  'Tun Tun Naing',
  'Phyo Wai Aung',
  'Nay Lin Htet',
];

const FEMALE_GIVEN = [
  'Khin Thida',
  'Mya Mya Aye',
  'Nilar Win',
  'Su Su Hlaing',
  'Ei Ei Phyo',
  'Aye Aye Mon',
  'Hnin Wai',
  'Thin Thin Nwe',
  'Moe Moe Khaing',
  'Sandar Myint',
  'Yee Yee Cho',
  'Khin Mar Lar',
  'Zar Chi Win',
  'Nandar Aye',
  'Thandar Soe',
  'Phyu Phyu Thin',
  'Cho Cho Aung',
  'Myat Noe Oo',
  'Hla Hla Yee',
  'Wai Wai Mon',
];

/**
 * 40 owner accounts, not 15. With 300 seeded listings, fewer owners would push
 * each past the 10-active-listing quota — sample data that contradicts the rule
 * it is meant to demonstrate, and a demo account that cannot create a listing.
 */
export const OWNER_NAMES = Array.from({ length: 40 }, (_, i) =>
  i % 2 === 0
    ? `U ${MALE_GIVEN[Math.floor(i / 2) % MALE_GIVEN.length]}`
    : `Daw ${FEMALE_GIVEN[Math.floor(i / 2) % FEMALE_GIVEN.length]}`,
);

export const AGENT_NAMES = [
  'Ko Naing Lin',
  'Ma Thiri Kyaw',
  'Ko Wai Phyo',
  'Ma Hnin Yu Wai',
  'Ko Zin Ko Ko',
];

export const SEEKER_NAMES = [
  'Ma Phyu Phyu',
  'Ko Htet Aung',
  'Ma Yamin Thu',
  'Ko Kyaw Zin',
  'Ma Nwe Nwe',
  'Ko Aung Kaung',
  'Ma Thet Su',
  'Ko Min Khant',
  'Ma Shwe Yee',
  'Ko Pyae Sone',
];

export const AGENCY_NAMES = [
  'Golden Land Property',
  'Shwe Property Services',
  'Yangon Home Agency',
  'Mandalay Estate Partners',
  'City Key Property',
];

export const STREET_NAMES = [
  'Pyay Road',
  'Kabar Aye Pagoda Road',
  'Insein Road',
  'Bogyoke Aung San Road',
  'Anawrahta Road',
  'Merchant Road',
  'Strand Road',
  'U Wisara Road',
  'Dhammazedi Road',
  'Inya Road',
  'Parami Road',
  'Waizayantar Road',
  'Thitsar Road',
  'Baho Road',
  '78th Street',
  '35th Street',
  '62nd Street',
  'Theikpan Street',
  'Mandalay–Lashio Road',
];

/** Descriptive fragments assembled into a listing body. */
export const CONDITION = [
  'Newly built',
  'Well maintained',
  'Recently renovated',
  'Move-in ready',
  'Original condition',
];
export const NEARBY = [
  'close to the market',
  'a short walk from the main road',
  'near international schools',
  'minutes from the city centre',
  'beside a bus line',
  'in a quiet residential lane',
  'near the hospital',
  'close to shopping and restaurants',
];
export const SELLING_POINT = [
  'Bright and airy with good ventilation',
  'Quiet street with very little traffic',
  'Reliable water supply and standby generator',
  'Secure compound with 24-hour security',
  'Excellent natural light throughout the day',
  'Spacious layout suitable for a family',
  'Strong rental demand in this area',
  'Well-connected for daily commuting',
];

export const FACINGS = ['East', 'West', 'North', 'South', 'North-East', 'South-East'];

export const ENQUIRY_MESSAGES = [
  'Is this still available? I would like to arrange a viewing this week.',
  'Could you tell me the exact address and the best time to visit?',
  'Is the price negotiable? I am ready to move quickly.',
  'What is included in the monthly rent? Please call me back.',
  'I am interested. Are there any additional fees I should know about?',
  'Can you send more photos of the kitchen and bathroom?',
  'Is parking included with this unit?',
  'How many months advance are required?',
];

export const REPORT_REASONS = [
  'Duplicate listing',
  'Wrong price',
  'Property is no longer available',
  'Photos do not match the description',
  'Suspected scam',
];

export const REJECTION_REASONS = [
  'Photos are too low quality to publish. Please upload clearer images.',
  'The description is missing key details about the property.',
  'The asking price appears to be a placeholder. Please correct it.',
  'Contact phone number could not be verified.',
];
