import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GREFA Tareas — Administración",
  description: "Gestión de personal, tareas y liquidación GREFA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
