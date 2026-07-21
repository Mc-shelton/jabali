import { assetPath } from '../utils/assetPath';

const buildMember = (name, photo, voice = 'Chorale member', church = 'Jabali Chorale') => ({
  name,
  voice,
  photo,
  church,
});

export const choirMembers = [
  buildMember('Alice Ayieko', assetPath('/images/members/IMG-20221123-WA0019 - Alice Ayieko.jpg')),
  buildMember('Anfenee Keago', assetPath('/images/members/IMG-20230217-WA0004 - anfenee keago.jpg')),
  buildMember('Anyes Moh', assetPath('/images/members/AGGY1 - Anyes Moh.jpg')),
  buildMember('Beryl Ateng', assetPath('/images/members/IMG-20230216-WA0011 - Beryl Ateng.jpg')),
  buildMember('Beryl Ouya', assetPath('/images/members/IMG-20230216-WA0031 - Beryl Ouya.jpg')),
  buildMember('Brian Odera', assetPath('/images/members/IMG-20230216-WA0007 - Brian Odera.jpg')),
  buildMember('Collins Mlamba', assetPath('/images/members/20220625_164403 - Collins Mlamba.jpg')),
  buildMember('Davis Mogeni', assetPath('/images/members/croped - Davis Mogeni.JPG')),
  buildMember('Elsie Nyangweso', assetPath('/images/members/DSC07591 - Elsie Nyangweso.jpg')),
  buildMember('Elvis Okoth Dick', assetPath('/images/members/Screenshot_20230517-170708 - ELVIS OKOTH DICK.png')),
  buildMember('Fidel Lelei', assetPath('/images/members/IMG_5054~4 - Fidel Lelei.jpg')),
  buildMember('Grace Apondi', assetPath('/images/members/IMG_20220423_135530 - Grace Apondi.jpg')),
  buildMember('Jerry Collins Otieno (Oti)', assetPath('/images/members/IMG_20220409_144211 - Jerry Collins Otieno (Oti).jpg')),
  buildMember('Kevin Mose', assetPath('/images/members/_MG_6512 - kevin mose.JPG')),
  buildMember('Lynn Okumu', assetPath('/images/members/DSC_6732~3 - LYNN Okumu.jpg')),
  buildMember('Midiang\'a Benja', assetPath('/images/members/20230616_190658 - Midiang\'a Benja.jpg')),
  buildMember('Miriam Lelei', assetPath('/images/members/IMG-20210508-WA0052 - miriam lelei.jpg')),
  buildMember('Mutuku Kennedy', assetPath('/images/members/IMG_1579 - Mutuku Kennedy.jpg')),
  buildMember('Olivia Akinyi', assetPath('/images/members/627FBD83-D251-482E-8F7D-0E9201927474 - olivia akinyi.jpeg')),
  buildMember('Ruth Mayenga', assetPath('/images/members/+254 719 636654 20230103_205558 - Ruth Mayenga.jpg')),
  buildMember('Saigon Felix', assetPath('/images/members/DSC07395 - SAIGON FELIX.jpg')),
  buildMember('Sarah Peris', assetPath('/images/members/254759086751_status_d29ba009bc444771ba5b6a42bbf2971d - Sarah peris.jpg')),
  buildMember('Young Scout', assetPath('/images/members/IMG-2021090 - Young Scout.jpg')),
];
