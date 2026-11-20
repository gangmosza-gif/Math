/** Downscale an uploaded image file to a reasonable data URL. */
export function fileToDataURL(file, max = 2048) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') return resolve({ url: fr.result });
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        if (k === 1 && fr.result.length < 3e6) return resolve({ url: fr.result, w: img.width, h: img.height });
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const png = file.type === 'image/png' || file.type === 'image/webp';
        resolve({ url: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w: c.width, h: c.height });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
