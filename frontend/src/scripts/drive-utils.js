export const getFileId = (url) => {
  const patterns = [/\/file\/d\/([^/]+)/, /id=([^&]+)/, /\/d\/([^/]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

export const getDownloadLink = (fileId) => {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
};

export const getDriveLinks = () => {
  const anchorTags = [];

  // Search for anchor tags with vwNuXe class that point to drive.google.com
  const allAnchors = document.querySelectorAll('a.vwNuXe[href*="drive.google.com"]');
  console.log("found anchors: ", allAnchors.length);

  Array.from(allAnchors).forEach((anchor) => {
    anchorTags.push({
      href: anchor.href,
      text: anchor.textContent.trim(),
    });
  });

  return anchorTags;
};
