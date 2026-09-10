const QRCode = require('qrcode');

/**
 * Generates a QR code data URL for a given table ID or text.
 * @param {string} text - The content to encode in the QR code.
 * @returns {Promise<string>} The QR code as a base64 Data URL.
 */
const generateQR = async (text) => {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      color: {
        dark: '#1e293b', // Sleek slate color
        light: '#ffffff'
      },
      width: 300
    });
    return dataUrl;
  } catch (err) {
    console.error('QR Code generation error:', err);
    throw err;
  }
};

module.exports = { generateQR };
