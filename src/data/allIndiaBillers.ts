export interface BillerInfo {
  id: string;
  name: string;
  shortName: string;
  state: string;
  category: 'electricity' | 'water' | 'fastag' | 'gas' | 'broadband' | 'dth';
  sampleConsumerId?: string;
  sampleName?: string;
  sampleAmount?: number;
  idFormatHint?: string;
  portalUrl?: string;
}

export const INDIAN_STATES = [
  'Mizoram',
  'Assam',
  'Meghalaya',
  'Tripura',
  'Manipur',
  'Nagaland',
  'Arunachal Pradesh',
  'West Bengal',
  'Delhi (NCT)',
  'Maharashtra',
  'Uttar Pradesh',
  'Bihar',
  'Karnataka',
  'Tamil Nadu',
  'Rajasthan',
  'Gujarat',
  'Punjab',
  'Haryana',
  'Kerala',
  'Andhra Pradesh',
  'Telangana',
  'Madhya Pradesh',
  'Odisha',
  'Jharkhand',
  'Chhattisgarh',
  'Himachal Pradesh',
  'Uttarakhand',
  'Goa',
  'Jammu & Kashmir'
] as const;

export type IndianState = typeof INDIAN_STATES[number];

export const ALL_INDIA_ELECTRICITY_BOARDS: Record<string, BillerInfo[]> = {
  'Mizoram': [
    {
      id: 'PED_MIZORAM',
      name: 'Power & Electricity Department, Mizoram (P&ED)',
      shortName: 'P&ED Mizoram',
      state: 'Mizoram',
      category: 'electricity',
      sampleConsumerId: '1002948201',
      sampleName: 'Lalmuanpuia Ralte',
      sampleAmount: 940,
      idFormatHint: '10 digits (e.g. 1002948201)',
      portalUrl: 'https://power.mizoram.gov.in'
    }
  ],
  'Assam': [
    {
      id: 'APDCL_NON_RAPDRP',
      name: 'Assam Power Distribution Company Ltd (APDCL) - Non-RAPDRP',
      shortName: 'APDCL Rural / Semi-Urban',
      state: 'Assam',
      category: 'electricity',
      sampleConsumerId: '1020049281',
      sampleName: 'Pranab Jyoti Barman',
      sampleAmount: 1250,
      idFormatHint: '10 digits Consumer No',
      portalUrl: 'https://www.apdcl.org'
    },
    {
      id: 'APDCL_RAPDRP',
      name: 'Assam Power Distribution Company Ltd (APDCL) - Smart / RAPDRP',
      shortName: 'APDCL Urban (Guwahati / Silchar)',
      state: 'Assam',
      category: 'electricity',
      sampleConsumerId: '01000049219',
      sampleName: 'Himangshu Sarma',
      sampleAmount: 1840,
      idFormatHint: '11-12 digits Account No',
      portalUrl: 'https://www.apdcl.org'
    }
  ],
  'Meghalaya': [
    {
      id: 'MEECL_MEGHALAYA',
      name: 'Meghalaya Energy Corporation Limited (MeECL)',
      shortName: 'MeECL Meghalaya',
      state: 'Meghalaya',
      category: 'electricity',
      sampleConsumerId: '9840192841',
      sampleName: 'Banteilang Nongkynrih',
      sampleAmount: 1100,
      idFormatHint: '9-10 digits Consumer ID',
      portalUrl: 'https://www.meecl.nic.in'
    }
  ],
  'Tripura': [
    {
      id: 'TSECL_TRIPURA',
      name: 'Tripura State Electricity Corporation Ltd (TSECL)',
      shortName: 'TSECL Tripura',
      state: 'Tripura',
      category: 'electricity',
      sampleConsumerId: '0204918204',
      sampleName: 'Debabrata Debbarma',
      sampleAmount: 880,
      idFormatHint: '10 digits Consumer No',
      portalUrl: 'https://www.tsecl.in'
    }
  ],
  'Manipur': [
    {
      id: 'MSPDCL_MANIPUR',
      name: 'Manipur State Power Distribution Company Ltd (MSPDCL)',
      shortName: 'MSPDCL Prepaid / Postpaid',
      state: 'Manipur',
      category: 'electricity',
      sampleConsumerId: '1049281920',
      sampleName: 'Nongmaithem Singh',
      sampleAmount: 920,
      idFormatHint: '10 digits Account ID',
      portalUrl: 'https://mspdcl.info'
    }
  ],
  'Nagaland': [
    {
      id: 'DOPN_NAGALAND',
      name: 'Department of Power Nagaland (DoPN)',
      shortName: 'DoPN Nagaland',
      state: 'Nagaland',
      category: 'electricity',
      sampleConsumerId: '3049182910',
      sampleName: 'Toshi Jamir',
      sampleAmount: 750,
      idFormatHint: 'Consumer Number',
      portalUrl: 'https://dopn.gov.in'
    }
  ],
  'Arunachal Pradesh': [
    {
      id: 'DOPAP_ARUNACHAL',
      name: 'Department of Power Arunachal Pradesh (DoPAP)',
      shortName: 'DoPAP Arunachal',
      state: 'Arunachal Pradesh',
      category: 'electricity',
      sampleConsumerId: '4019284910',
      sampleName: 'Koj Rinya',
      sampleAmount: 690,
      idFormatHint: 'Consumer ID',
      portalUrl: 'https://arpunep.gov.in'
    }
  ],
  'West Bengal': [
    {
      id: 'WBSEDCL',
      name: 'West Bengal State Electricity Distribution Co. Ltd (WBSEDCL)',
      shortName: 'WBSEDCL West Bengal',
      state: 'West Bengal',
      category: 'electricity',
      sampleConsumerId: '204918291',
      sampleName: 'Subhasish Mukherjee',
      sampleAmount: 1450,
      idFormatHint: '9 digits Consumer ID',
      portalUrl: 'https://www.wbsedcl.in'
    },
    {
      id: 'CESC_KOLKATA',
      name: 'CESC Limited (Kolkata & Howrah)',
      shortName: 'CESC Kolkata',
      state: 'West Bengal',
      category: 'electricity',
      sampleConsumerId: '98401928491',
      sampleName: 'Arijit Ganguly',
      sampleAmount: 2310,
      idFormatHint: '11 digits Consumer No',
      portalUrl: 'https://www.cesc.co.in'
    }
  ],
  'Delhi (NCT)': [
    {
      id: 'BSES_RAJDHANI',
      name: 'BSES Rajdhani Power Limited (South & West Delhi)',
      shortName: 'BSES Rajdhani (BRPL)',
      state: 'Delhi (NCT)',
      category: 'electricity',
      sampleConsumerId: '100492819',
      sampleName: 'Rajesh Sharma',
      sampleAmount: 1720,
      idFormatHint: '9 digits CA Number',
      portalUrl: 'https://www.bsesdelhi.com'
    },
    {
      id: 'BSES_YAMUNA',
      name: 'BSES Yamuna Power Limited (East & Central Delhi)',
      shortName: 'BSES Yamuna (BYPL)',
      state: 'Delhi (NCT)',
      category: 'electricity',
      sampleConsumerId: '150491829',
      sampleName: 'Vikas Gupta',
      sampleAmount: 1650,
      idFormatHint: '9 digits CA Number',
      portalUrl: 'https://www.bsesdelhi.com'
    },
    {
      id: 'TATA_POWER_DELHI',
      name: 'Tata Power Delhi Distribution Limited (TPDDL - North Delhi)',
      shortName: 'Tata Power DDL',
      state: 'Delhi (NCT)',
      category: 'electricity',
      sampleConsumerId: '50049182910',
      sampleName: 'Manpreet Singh',
      sampleAmount: 1980,
      idFormatHint: '11 digits CA Number',
      portalUrl: 'https://www.tatapower-ddl.com'
    },
    {
      id: 'NDMC_DELHI',
      name: 'New Delhi Municipal Council (NDMC Electricity)',
      shortName: 'NDMC New Delhi',
      state: 'Delhi (NCT)',
      category: 'electricity',
      sampleConsumerId: '80049182',
      sampleName: 'Pooja Verma',
      sampleAmount: 2100,
      idFormatHint: '8 digits Consumer No'
    }
  ],
  'Maharashtra': [
    {
      id: 'MSEDCL_MAHAVITARAN',
      name: 'Maharashtra State Electricity Distribution (MSEDCL / Mahavitaran)',
      shortName: 'Mahavitaran (MSEDCL)',
      state: 'Maharashtra',
      category: 'electricity',
      sampleConsumerId: '049182910291',
      sampleName: 'Sachin Kulkarni',
      sampleAmount: 1540,
      idFormatHint: '12 digits Consumer No',
      portalUrl: 'https://www.mahadiscom.in'
    },
    {
      id: 'ADANI_ELECTRICITY_MUMBAI',
      name: 'Adani Electricity Mumbai Limited (AEML)',
      shortName: 'Adani Electricity Mumbai',
      state: 'Maharashtra',
      category: 'electricity',
      sampleConsumerId: '100492819',
      sampleName: 'Rohit Deshmukh',
      sampleAmount: 2450,
      idFormatHint: '9 digits Account No',
      portalUrl: 'https://www.adanielectricity.com'
    },
    {
      id: 'TATA_POWER_MUMBAI',
      name: 'Tata Power Mumbai',
      shortName: 'Tata Power Mumbai',
      state: 'Maharashtra',
      category: 'electricity',
      sampleConsumerId: '90049182910',
      sampleName: 'Ananya Joshi',
      sampleAmount: 2200,
      idFormatHint: '12 digits Consumer No'
    },
    {
      id: 'BEST_MUMBAI',
      name: 'Brihanmumbai Electric Supply and Transport (BEST Mumbai)',
      shortName: 'BEST Undertaking Mumbai',
      state: 'Maharashtra',
      category: 'electricity',
      sampleConsumerId: '501928491',
      sampleName: 'Kunal Patil',
      sampleAmount: 1800,
      idFormatHint: '9 digits Consumer No'
    }
  ],
  'Uttar Pradesh': [
    {
      id: 'UPPCL_PURVANCHAL',
      name: 'UPPCL - Purvanchal Vidyut Vitran Nigam (Varanasi / Gorakhpur)',
      shortName: 'UPPCL Purvanchal (PuVVNL)',
      state: 'Uttar Pradesh',
      category: 'electricity',
      sampleConsumerId: '7019284910',
      sampleName: 'Amitabh Mishra',
      sampleAmount: 1390,
      idFormatHint: '10-12 digits Account ID',
      portalUrl: 'https://www.upenergy.in'
    },
    {
      id: 'UPPCL_MADHYANCHAL',
      name: 'UPPCL - Madhyanchal Vidyut Vitran Nigam (Lucknow / Ayodhya)',
      shortName: 'UPPCL Madhyanchal (MVVNL)',
      state: 'Uttar Pradesh',
      category: 'electricity',
      sampleConsumerId: '6019284910',
      sampleName: 'Sanjay Yadav',
      sampleAmount: 1620,
      idFormatHint: '10-12 digits Account ID',
      portalUrl: 'https://www.upenergy.in'
    },
    {
      id: 'UPPCL_PASCHIMANCHAL',
      name: 'UPPCL - Paschimanchal Vidyut Vitran Nigam (Meerut / Noida / Ghaziabad)',
      shortName: 'UPPCL Paschimanchal (PVVNL)',
      state: 'Uttar Pradesh',
      category: 'electricity',
      sampleConsumerId: '5019284910',
      sampleName: 'Gaurav Tyagi',
      sampleAmount: 2150,
      idFormatHint: '10-12 digits Account ID'
    },
    {
      id: 'UPPCL_DAKSHINANCHAL',
      name: 'UPPCL - Dakshinanchal Vidyut Vitran Nigam (Agra / Aligarh / Jhansi)',
      shortName: 'UPPCL Dakshinanchal (DVVNL)',
      state: 'Uttar Pradesh',
      category: 'electricity',
      sampleConsumerId: '4019284910',
      sampleName: 'Dinesh Chauhan',
      sampleAmount: 1470,
      idFormatHint: '10-12 digits Account ID'
    },
    {
      id: 'KESCO_KANPUR',
      name: 'Kanpur Electricity Supply Company (KESCO)',
      shortName: 'KESCO Kanpur',
      state: 'Uttar Pradesh',
      category: 'electricity',
      sampleConsumerId: '1049281920',
      sampleName: 'Neeraj Shukla',
      sampleAmount: 1750,
      idFormatHint: '10 digits Consumer No'
    }
  ],
  'Bihar': [
    {
      id: 'SBPDCL_BIHAR',
      name: 'South Bihar Power Distribution Co. Ltd (SBPDCL)',
      shortName: 'SBPDCL South Bihar (Patna / Gaya)',
      state: 'Bihar',
      category: 'electricity',
      sampleConsumerId: '1049281920',
      sampleName: 'Alok Kumar Singh',
      sampleAmount: 1280,
      idFormatHint: '10-11 digits CA Number',
      portalUrl: 'https://www.sbpdcl.co.in'
    },
    {
      id: 'NBPDCL_BIHAR',
      name: 'North Bihar Power Distribution Co. Ltd (NBPDCL)',
      shortName: 'NBPDCL North Bihar (Muzaffarpur)',
      state: 'Bihar',
      category: 'electricity',
      sampleConsumerId: '2049182910',
      sampleName: 'Ravi Ranjan',
      sampleAmount: 1190,
      idFormatHint: '10-11 digits CA Number',
      portalUrl: 'https://www.nbpdcl.co.in'
    }
  ],
  'Karnataka': [
    {
      id: 'BESCOM_BANGALORE',
      name: 'Bangalore Electricity Supply Company Limited (BESCOM)',
      shortName: 'BESCOM Bengaluru',
      state: 'Karnataka',
      category: 'electricity',
      sampleConsumerId: '4918291029',
      sampleName: 'Karthik Rao',
      sampleAmount: 1850,
      idFormatHint: '10 digits Account ID',
      portalUrl: 'https://bescom.karnataka.gov.in'
    },
    {
      id: 'MESCOM_MANGALORE',
      name: 'Mangalore Electricity Supply Company Limited (MESCOM)',
      shortName: 'MESCOM Mangaluru',
      state: 'Karnataka',
      category: 'electricity',
      sampleConsumerId: '3918291029',
      sampleName: 'Preethi Shetty',
      sampleAmount: 1420,
      idFormatHint: 'Account ID'
    },
    {
      id: 'CESC_MYSORE',
      name: 'Chamundeshwari Electricity Supply Corporation (CESC Mysuru)',
      shortName: 'CESC Mysuru',
      state: 'Karnataka',
      category: 'electricity',
      sampleConsumerId: '2918291029',
      sampleName: 'Raghavendra Prasad',
      sampleAmount: 1360,
      idFormatHint: 'Account ID'
    },
    {
      id: 'HESCOM_HUBLI',
      name: 'Hubli Electricity Supply Company Limited (HESCOM)',
      shortName: 'HESCOM Hubballi-Dharwad',
      state: 'Karnataka',
      category: 'electricity',
      sampleConsumerId: '1918291029',
      sampleName: 'Santosh Patil',
      sampleAmount: 1200,
      idFormatHint: 'Account ID'
    }
  ],
  'Tamil Nadu': [
    {
      id: 'TANGEDCO',
      name: 'Tamil Nadu Generation and Distribution Corporation (TANGEDCO)',
      shortName: 'TANGEDCO Tamil Nadu',
      state: 'Tamil Nadu',
      category: 'electricity',
      sampleConsumerId: '0928192019',
      sampleName: 'M. Senthil Kumar',
      sampleAmount: 1680,
      idFormatHint: 'Consumer Number with Region code',
      portalUrl: 'https://www.tangedco.gov.in'
    }
  ],
  'Rajasthan': [
    {
      id: 'JVVNL_JAIPUR',
      name: 'Jaipur Vidyut Vitran Nigam Limited (JVVNL)',
      shortName: 'JVVNL Jaipur Discom',
      state: 'Rajasthan',
      category: 'electricity',
      sampleConsumerId: '2104928192',
      sampleName: 'Sunil Choudhary',
      sampleAmount: 1790,
      idFormatHint: '12 digits K Number'
    },
    {
      id: 'AVVNL_AJMER',
      name: 'Ajmer Vidyut Vitran Nigam Limited (AVVNL)',
      shortName: 'AVVNL Ajmer Discom',
      state: 'Rajasthan',
      category: 'electricity',
      sampleConsumerId: '1104928192',
      sampleName: 'Surendra Rathore',
      sampleAmount: 1550,
      idFormatHint: '12 digits K Number'
    },
    {
      id: 'JDVVNL_JODHPUR',
      name: 'Jodhpur Vidyut Vitran Nigam Limited (JdVVNL)',
      shortName: 'JdVVNL Jodhpur Discom',
      state: 'Rajasthan',
      category: 'electricity',
      sampleConsumerId: '3104928192',
      sampleName: 'Mahendra Gehlot',
      sampleAmount: 1610,
      idFormatHint: '12 digits K Number'
    }
  ],
  'Gujarat': [
    {
      id: 'DGVCL_GUJARAT',
      name: 'Dakshin Gujarat Vij Company Ltd (DGVCL - Surat)',
      shortName: 'DGVCL Dakshin Gujarat',
      state: 'Gujarat',
      category: 'electricity',
      sampleConsumerId: '04918291029',
      sampleName: 'Hasmukh Patel',
      sampleAmount: 1910,
      idFormatHint: '11 digits Consumer No'
    },
    {
      id: 'MGVCL_GUJARAT',
      name: 'Madhya Gujarat Vij Company Ltd (MGVCL - Vadodara)',
      shortName: 'MGVCL Vadodara',
      state: 'Gujarat',
      category: 'electricity',
      sampleConsumerId: '14918291029',
      sampleName: 'Chirag Shah',
      sampleAmount: 1670,
      idFormatHint: '11 digits Consumer No'
    },
    {
      id: 'UGVCL_GUJARAT',
      name: 'Uttar Gujarat Vij Company Ltd (UGVCL - Mehsana)',
      shortName: 'UGVCL Mehsana',
      state: 'Gujarat',
      category: 'electricity',
      sampleConsumerId: '24918291029',
      sampleName: 'Jayesh Prajapati',
      sampleAmount: 1530,
      idFormatHint: '11 digits Consumer No'
    },
    {
      id: 'PGVCL_GUJARAT',
      name: 'Paschim Gujarat Vij Company Ltd (PGVCL - Rajkot)',
      shortName: 'PGVCL Saurashtra / Kutch',
      state: 'Gujarat',
      category: 'electricity',
      sampleConsumerId: '34918291029',
      sampleName: 'Haresh Jadeja',
      sampleAmount: 1480,
      idFormatHint: '11 digits Consumer No'
    },
    {
      id: 'TORRENT_POWER',
      name: 'Torrent Power (Ahmedabad / Gandhinagar / Surat / Agra)',
      shortName: 'Torrent Power',
      state: 'Gujarat',
      category: 'electricity',
      sampleConsumerId: '50192849',
      sampleName: 'Darshan Mehta',
      sampleAmount: 2240,
      idFormatHint: 'Service Number'
    }
  ],
  'Punjab': [
    {
      id: 'PSPCL_PUNJAB',
      name: 'Punjab State Power Corporation Limited (PSPCL)',
      shortName: 'PSPCL Punjab',
      state: 'Punjab',
      category: 'electricity',
      sampleConsumerId: '3004928192',
      sampleName: 'Harpreet Singh Sandhu',
      sampleAmount: 1940,
      idFormatHint: '10 digits Account Number'
    }
  ],
  'Haryana': [
    {
      id: 'DHBVN_HARYANA',
      name: 'Dakshin Haryana Bijli Vitran Nigam (DHBVN - Gurugram / Faridabad)',
      shortName: 'DHBVN Gurugram / South Haryana',
      state: 'Haryana',
      category: 'electricity',
      sampleConsumerId: '1049281920',
      sampleName: 'Deepak Hooda',
      sampleAmount: 2180,
      idFormatHint: 'Account Number'
    },
    {
      id: 'UHBVN_HARYANA',
      name: 'Uttar Haryana Bijli Vitran Nigam (UHBVN - Panchkula / Karnal)',
      shortName: 'UHBVN North Haryana',
      state: 'Haryana',
      category: 'electricity',
      sampleConsumerId: '2049281920',
      sampleName: 'Virender Malik',
      sampleAmount: 1820,
      idFormatHint: 'Account Number'
    }
  ],
  'Kerala': [
    {
      id: 'KSEB_KERALA',
      name: 'Kerala State Electricity Board Ltd (KSEB)',
      shortName: 'KSEB Kerala',
      state: 'Kerala',
      category: 'electricity',
      sampleConsumerId: '1149281920193',
      sampleName: 'Rahul Panicker',
      sampleAmount: 1350,
      idFormatHint: '13 digits Consumer Number'
    }
  ],
  'Andhra Pradesh': [
    {
      id: 'APEPDCL',
      name: 'Eastern Power Distribution Company of AP (APEPDCL - Visakhapatnam)',
      shortName: 'APEPDCL Visakhapatnam',
      state: 'Andhra Pradesh',
      category: 'electricity',
      sampleConsumerId: '1049281920',
      sampleName: 'Venkata Rao',
      sampleAmount: 1720,
      idFormatHint: 'Service Number'
    },
    {
      id: 'APSPDCL',
      name: 'Southern Power Distribution Company of AP (APSPDCL - Tirupati / Vijayawada)',
      shortName: 'APSPDCL Tirupati',
      state: 'Andhra Pradesh',
      category: 'electricity',
      sampleConsumerId: '2049281920',
      sampleName: 'Srinivasa Reddy',
      sampleAmount: 1650,
      idFormatHint: 'Service Number'
    },
    {
      id: 'APCPDCL',
      name: 'Central Power Distribution Company of AP (APCPDCL - Guntur)',
      shortName: 'APCPDCL Guntur',
      state: 'Andhra Pradesh',
      category: 'electricity',
      sampleConsumerId: '3049281920',
      sampleName: 'Nagendra Babu',
      sampleAmount: 1580,
      idFormatHint: 'Service Number'
    }
  ],
  'Telangana': [
    {
      id: 'TSSPDCL',
      name: 'Southern Power Distribution Company of Telangana (TSSPDCL - Hyderabad)',
      shortName: 'TSSPDCL Hyderabad',
      state: 'Telangana',
      category: 'electricity',
      sampleConsumerId: '100492819',
      sampleName: 'Sai Kiran Goud',
      sampleAmount: 2050,
      idFormatHint: 'Unique Service No (USC)'
    },
    {
      id: 'TSNPDCL',
      name: 'Northern Power Distribution Company of Telangana (TSNPDCL - Warangal)',
      shortName: 'TSNPDCL Warangal',
      state: 'Telangana',
      category: 'electricity',
      sampleConsumerId: '200492819',
      sampleName: 'Murali Krishna',
      sampleAmount: 1460,
      idFormatHint: 'Unique Service No'
    }
  ],
  'Madhya Pradesh': [
    {
      id: 'MPPKVVCL_INDORE',
      name: 'MP Paschim Kshetra Vidyut Vitaran (MPPKVVCL - Indore / Ujjain)',
      shortName: 'MPPKVVCL Indore (West MP)',
      state: 'Madhya Pradesh',
      category: 'electricity',
      sampleConsumerId: '0491829102',
      sampleName: 'Praveen Malviya',
      sampleAmount: 1690,
      idFormatHint: '10 digits IVRS Number'
    },
    {
      id: 'MPMKVVCL_BHOPAL',
      name: 'MP Madhya Kshetra Vidyut Vitaran (MPMKVVCL - Bhopal / Gwalior)',
      shortName: 'MPMKVVCL Bhopal (Central MP)',
      state: 'Madhya Pradesh',
      category: 'electricity',
      sampleConsumerId: '1491829102',
      sampleName: 'Anil Tiwari',
      sampleAmount: 1740,
      idFormatHint: '10 digits IVRS Number'
    },
    {
      id: 'MPPKVVCL_JABALPUR',
      name: 'MP Poorv Kshetra Vidyut Vitaran (MPPoKVVCL - Jabalpur / Rewa)',
      shortName: 'MP Poorv Kshetra (East MP)',
      state: 'Madhya Pradesh',
      category: 'electricity',
      sampleConsumerId: '2491829102',
      sampleName: 'Vijay Dwivedi',
      sampleAmount: 1520,
      idFormatHint: '10 digits IVRS Number'
    }
  ],
  'Odisha': [
    {
      id: 'TPCODL_ODISHA',
      name: 'TP Central Odisha Distribution Limited (TPCODL - Bhubaneswar / Cuttack)',
      shortName: 'TPCODL Bhubaneswar',
      state: 'Odisha',
      category: 'electricity',
      sampleConsumerId: '4019284910',
      sampleName: 'Debasis Mohanty',
      sampleAmount: 1630,
      idFormatHint: '12 digits Consumer No'
    },
    {
      id: 'TPWODL_ODISHA',
      name: 'TP Western Odisha Distribution Limited (TPWODL - Sambalpur / Rourkela)',
      shortName: 'TPWODL Sambalpur',
      state: 'Odisha',
      category: 'electricity',
      sampleConsumerId: '5019284910',
      sampleName: 'Bibhuti Pradhan',
      sampleAmount: 1410,
      idFormatHint: 'Consumer No'
    },
    {
      id: 'TPSODL_ODISHA',
      name: 'TP Southern Odisha Distribution Limited (TPSODL - Berhampur)',
      shortName: 'TPSODL Berhampur',
      state: 'Odisha',
      category: 'electricity',
      sampleConsumerId: '6019284910',
      sampleName: 'Prasanta Tripathy',
      sampleAmount: 1380,
      idFormatHint: 'Consumer No'
    },
    {
      id: 'TPNODL_ODISHA',
      name: 'TP Northern Odisha Distribution Limited (TPNODL - Balasore)',
      shortName: 'TPNODL Balasore',
      state: 'Odisha',
      category: 'electricity',
      sampleConsumerId: '7019284910',
      sampleName: 'Soumya Ranjan Das',
      sampleAmount: 1440,
      idFormatHint: 'Consumer No'
    }
  ],
  'Jharkhand': [
    {
      id: 'JBVNL_JHARKHAND',
      name: 'Jharkhand Bijli Vitran Nigam Limited (JBVNL - Ranchi / Jamshedpur)',
      shortName: 'JBVNL Jharkhand',
      state: 'Jharkhand',
      category: 'electricity',
      sampleConsumerId: '1049281920',
      sampleName: 'Manish Pandey',
      sampleAmount: 1390,
      idFormatHint: 'Consumer No / Account No'
    }
  ],
  'Chhattisgarh': [
    {
      id: 'CSPDCL_CHHATTISGARH',
      name: 'Chhattisgarh State Power Distribution Company (CSPDCL)',
      shortName: 'CSPDCL Chhattisgarh',
      state: 'Chhattisgarh',
      category: 'electricity',
      sampleConsumerId: '1004928192',
      sampleName: 'Hemant Verma',
      sampleAmount: 1490,
      idFormatHint: '10 digits BP Number'
    }
  ],
  'Himachal Pradesh': [
    {
      id: 'HPSEBL_HIMACHAL',
      name: 'Himachal Pradesh State Electricity Board Limited (HPSEBL)',
      shortName: 'HPSEBL Himachal',
      state: 'Himachal Pradesh',
      category: 'electricity',
      sampleConsumerId: '104928192019',
      sampleName: 'Pankaj Thakur',
      sampleAmount: 1220,
      idFormatHint: '12 digits Consumer ID'
    }
  ],
  'Uttarakhand': [
    {
      id: 'UPCL_UTTARAKHAND',
      name: 'Uttarakhand Power Corporation Limited (UPCL - Dehradun / Haridwar)',
      shortName: 'UPCL Uttarakhand',
      state: 'Uttarakhand',
      category: 'electricity',
      sampleConsumerId: '40192849102',
      sampleName: 'Vivek Rawat',
      sampleAmount: 1560,
      idFormatHint: '11 digits Service Connection No'
    }
  ],
  'Goa': [
    {
      id: 'GED_GOA',
      name: 'Goa Electricity Department (GED)',
      shortName: 'GED Goa',
      state: 'Goa',
      category: 'electricity',
      sampleConsumerId: '0491829102',
      sampleName: 'Savio Fernandes',
      sampleAmount: 1680,
      idFormatHint: 'Consumer Number'
    }
  ],
  'Jammu & Kashmir': [
    {
      id: 'KPDCL_KASHMIR',
      name: 'Kashmir Power Distribution Corporation Limited (KPDCL - Srinagar)',
      shortName: 'KPDCL Kashmir',
      state: 'Jammu & Kashmir',
      category: 'electricity',
      sampleConsumerId: '01049182910',
      sampleName: 'Farooq Ahmad Mir',
      sampleAmount: 1150,
      idFormatHint: 'Consumer ID'
    },
    {
      id: 'JPDCL_JAMMU',
      name: 'Jammu Power Distribution Corporation Limited (JPDCL - Jammu)',
      shortName: 'JPDCL Jammu',
      state: 'Jammu & Kashmir',
      category: 'electricity',
      sampleConsumerId: '02049182910',
      sampleName: 'Ajay Sharma',
      sampleAmount: 1290,
      idFormatHint: 'Consumer ID'
    }
  ]
};

export const ALL_INDIA_WATER_BOARDS: Record<string, BillerInfo[]> = {
  'Mizoram': [
    {
      id: 'PHED_MIZORAM',
      name: 'Public Health Engineering Department (PHED Mizoram)',
      shortName: 'PHED Mizoram (Aizawl, Lunglei, Champhai, Kolasib)',
      state: 'Mizoram',
      category: 'water',
      sampleConsumerId: 'PHED/AIZ/2024/0981',
      sampleName: 'Zohmangaiha',
      sampleAmount: 420,
      idFormatHint: 'e.g. PHED/AIZ/2024/0981 or AIZ0981',
      portalUrl: 'https://phed.mizoram.gov.in'
    }
  ],
  'Assam': [
    {
      id: 'GMC_WATER_GUWAHATI',
      name: 'Guwahati Jal Board / Guwahati Municipal Corporation Water',
      shortName: 'Guwahati Jal Board',
      state: 'Assam',
      category: 'water',
      sampleConsumerId: 'GJB-94821',
      sampleName: 'Bipul Deka',
      sampleAmount: 480,
      idFormatHint: 'Consumer ID'
    }
  ],
  'Delhi (NCT)': [
    {
      id: 'DELHI_JAL_BOARD',
      name: 'Delhi Jal Board (DJB - Water & Sewerage)',
      shortName: 'Delhi Jal Board (DJB)',
      state: 'Delhi (NCT)',
      category: 'water',
      sampleConsumerId: '1004928192',
      sampleName: 'Ashok Mehra',
      sampleAmount: 620,
      idFormatHint: '10 digits KNO Number'
    }
  ],
  'Karnataka': [
    {
      id: 'BWSSB_BANGALORE',
      name: 'Bangalore Water Supply and Sewerage Board (BWSSB)',
      shortName: 'BWSSB Bengaluru',
      state: 'Karnataka',
      category: 'water',
      sampleConsumerId: 'W-49182910',
      sampleName: 'Naveen Kumar',
      sampleAmount: 580,
      idFormatHint: 'RR Number'
    }
  ],
  'Maharashtra': [
    {
      id: 'MCGM_MUMBAI_WATER',
      name: 'Brihanmumbai Municipal Corporation (BMC / MCGM Water Supply)',
      shortName: 'BMC / MCGM Mumbai Water',
      state: 'Maharashtra',
      category: 'water',
      sampleConsumerId: 'BMC-W-984210',
      sampleName: 'Santosh Sawant',
      sampleAmount: 740,
      idFormatHint: 'CCN Number'
    },
    {
      id: 'PMC_PUNE_WATER',
      name: 'Pune Municipal Corporation (PMC Water Department)',
      shortName: 'PMC Pune Water',
      state: 'Maharashtra',
      category: 'water',
      sampleConsumerId: 'PMC-849182',
      sampleName: 'Amol Shinde',
      sampleAmount: 510,
      idFormatHint: 'Consumer No'
    }
  ],
  'Tamil Nadu': [
    {
      id: 'CMWSSB_CHENNAI',
      name: 'Chennai Metropolitan Water Supply and Sewerage (CMWSSB / Metrowater)',
      shortName: 'Chennai Metrowater (CMWSSB)',
      state: 'Tamil Nadu',
      category: 'water',
      sampleConsumerId: '08-104-9281',
      sampleName: 'K. Balachandar',
      sampleAmount: 660,
      idFormatHint: 'CMC Number'
    }
  ],
  'Kerala': [
    {
      id: 'KWA_KERALA',
      name: 'Kerala Water Authority (KWA)',
      shortName: 'Kerala Water Authority (KWA)',
      state: 'Kerala',
      category: 'water',
      sampleConsumerId: 'KWA-9481920',
      sampleName: 'Jose Thomas',
      sampleAmount: 390,
      idFormatHint: 'Consumer ID'
    }
  ],
  'West Bengal': [
    {
      id: 'KMC_KOLKATA_WATER',
      name: 'Kolkata Municipal Corporation (KMC Water Supply)',
      shortName: 'KMC Kolkata Water',
      state: 'West Bengal',
      category: 'water',
      sampleConsumerId: 'KMC-W-40192',
      sampleName: 'Debjani Roy',
      sampleAmount: 450,
      idFormatHint: 'Assessee No'
    }
  ],
  'Telangana': [
    {
      id: 'HMWSSB_HYDERABAD',
      name: 'Hyderabad Metropolitan Water Supply & Sewerage Board (HMWSSB)',
      shortName: 'HMWSSB Hyderabad Water',
      state: 'Telangana',
      category: 'water',
      sampleConsumerId: '104928192',
      sampleName: 'G. Suresh Kumar',
      sampleAmount: 590,
      idFormatHint: '9 digits CAN Number'
    }
  ],
  'Rajasthan': [
    {
      id: 'PHED_RAJASTHAN',
      name: 'Public Health Engineering Department Rajasthan (PHED Water)',
      shortName: 'PHED Rajasthan',
      state: 'Rajasthan',
      category: 'water',
      sampleConsumerId: 'RJ-PHED-94821',
      sampleName: 'Rameshwar Meena',
      sampleAmount: 430,
      idFormatHint: 'K Number'
    }
  ],
  'Gujarat': [
    {
      id: 'SMC_SURAT_WATER',
      name: 'Surat Municipal Corporation Water Works',
      shortName: 'Surat Municipal Water (SMC)',
      state: 'Gujarat',
      category: 'water',
      sampleConsumerId: 'SMC-W-10492',
      sampleName: 'Ketan Dholakia',
      sampleAmount: 520,
      idFormatHint: 'Tenement Number'
    },
    {
      id: 'AMC_AHMEDABAD_WATER',
      name: 'Ahmedabad Municipal Corporation Water & Conservancy',
      shortName: 'AMC Ahmedabad Water',
      state: 'Gujarat',
      category: 'water',
      sampleConsumerId: 'AMC-W-84910',
      sampleName: 'Dipen Parekh',
      sampleAmount: 540,
      idFormatHint: 'Tenement Number'
    }
  ],
  'Uttar Pradesh': [
    {
      id: 'JAL_SANSTHAN_LUCKNOW',
      name: 'Jal Sansthan Lucknow (Nagar Nigam Jal Vibhag)',
      shortName: 'Jal Sansthan Lucknow',
      state: 'Uttar Pradesh',
      category: 'water',
      sampleConsumerId: 'JSL-491829',
      sampleName: 'Abhishek Dixit',
      sampleAmount: 470,
      idFormatHint: 'Consumer Number'
    }
  ]
};

export const ALL_FASTAG_BANKS = [
  'State Bank of India (SBI FASTag)',
  'ICICI Bank FASTag',
  'HDFC Bank FASTag',
  'Axis Bank FASTag',
  'Airtel Payments Bank FASTag',
  'Paytm Payments Bank FASTag',
  'Bank of Baroda FASTag',
  'IDFC FIRST Bank FASTag',
  'Kotak Mahindra Bank FASTag',
  'Punjab National Bank (PNB FASTag)',
  'Canara Bank FASTag',
  'Union Bank of India FASTag',
  'IndusInd Bank FASTag',
  'Federal Bank FASTag',
  'Equitas Small Finance Bank FASTag',
  'Indian Highways Management Company Ltd (IHMCL FASTag)',
  'South Indian Bank FASTag',
  'AU Small Finance Bank FASTag'
];

export const ALL_GAS_PROVIDERS = [
  'Indane Gas (Indian Oil - IOCL)',
  'Bharat Gas (Bharat Petroleum - BPCL)',
  'HP Gas (Hindustan Petroleum - HPCL)',
  'Indraprastha Gas Limited (IGL) - Piped Natural Gas',
  'Mahanagar Gas Limited (MGL Mumbai) - Piped Gas',
  'Adani Total Gas Limited',
  'Gujarat Gas Limited (GGL)',
  'Tripura Natural Gas Company Ltd (TNGCL)',
  'Assam Gas Company Limited (AGCL)',
  'Aizawl Indane Gas Agency (Chanmari / Mission Veng)'
];

export const ALL_BROADBAND_PROVIDERS = [
  'BSNL Bharat Fiber (Broadband / FTTH)',
  'Reliance JioFiber / AirFiber',
  'Airtel Xstream Fiber',
  'ACT Fibernet',
  'Tata Play Fiber',
  'Hathway Broadband',
  'RailWire Broadband',
  'Excitel Broadband',
  'Netplus Broadband',
  'Den Broadband'
];
