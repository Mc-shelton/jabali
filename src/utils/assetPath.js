export const assetPath = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`;

export const cssUrl = (path) => `url("${encodeURI(path)}")`;
