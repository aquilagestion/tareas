import { printToFileAsync } from "expo-print";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Share, Platform } from "react-native";

export async function shareHtmlAsPdf(html: string, dialogTitle: string): Promise<void> {
  if (typeof printToFileAsync !== "function") {
    throw new Error("Generación de PDF no disponible en esta versión.");
  }

  const { uri } = await printToFileAsync({ html });

  let shareUri = uri;
  if (Platform.OS === "android" && !uri.toLowerCase().endsWith(".pdf")) {
    const dest = `${FileSystem.cacheDirectory}${dialogTitle.replace(/[^\w.-]+/g, "_")}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    shareUri = dest;
  }

  const available = await isAvailableAsync();
  if (available && typeof shareAsync === "function") {
    await shareAsync(shareUri, {
      mimeType: "application/pdf",
      dialogTitle,
      UTI: "com.adobe.pdf",
    });
    return;
  }

  await Share.share({
    title: dialogTitle,
    url: shareUri,
    message: dialogTitle,
  });
}

export async function shareTextContent(title: string, message: string): Promise<void> {
  await Share.share({ title, message });
}

export async function shareTextAsPdf(title: string, bodyText: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.5;color:#111;white-space:pre-wrap}</style>
</head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(bodyText)}</p></body></html>`;
  await shareHtmlAsPdf(html, title);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
