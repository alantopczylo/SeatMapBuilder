import type { Metadata } from "next";
import "./globals.css";
import ConfirmModal from '../components/ConfirmModal';

export const metadata: Metadata = {
  title: "SeatMap Builder",
  description: "Herramienta profesional para diseño de planos de asientos y venues.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <ConfirmModal />
      </body>
    </html>
  );
}
