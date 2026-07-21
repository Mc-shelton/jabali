// Single source of truth for the chorale's social presence.
// The hero and the footer both read from here, so a link is only ever fixed once.
//
// TODO(jabali): only `youtube` points at a real Jabali account. Replace the
// remaining URLs with the chorale's actual handles; any entry left as null is
// dropped from the UI rather than rendered as a dead link.
export const socialLinks = [
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@jabalichorale' },
  { id: 'instagram', label: 'Instagram', url: null },
  { id: 'tiktok', label: 'TikTok', url: null },
  { id: 'x', label: 'X', url: null },
  { id: 'whatsapp', label: 'WhatsApp', url: null },
];

export const activeSocialLinks = socialLinks.filter((link) => Boolean(link.url));
