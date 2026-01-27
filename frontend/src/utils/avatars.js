// Default avatars based on role
export const getDefaultAvatar = (role, name) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const colors = {
    child: { bg: '#FFD23F', text: '#1D3557' },
    parent: { bg: '#06D6A0', text: '#1D3557' },
    teacher: { bg: '#3D5A80', text: 'white' },
    admin: { bg: '#EE6C4D', text: 'white' },
    school: { bg: '#1D3557', text: 'white' }
  };
  const color = colors[role] || colors.child;
  
  // Return SVG data URL for default avatar
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="${color.bg}" rx="60"/>
    <text x="60" y="75" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="${color.text}" text-anchor="middle">${initial}</text>
  </svg>`;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Get avatar for a user, falling back to default
export const getUserAvatar = (user) => {
  if (!user) return getDefaultAvatar('child', '?');
  return user.picture || getDefaultAvatar(user.role, user.name);
};
