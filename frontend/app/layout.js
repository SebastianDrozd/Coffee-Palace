import "@fontsource-variable/fredoka";
import "@fontsource-variable/figtree";
import "./globals.css";
import ReactQueryProvider from "@/util/ReactQueryProvider";

export const metadata = {
  title: "Coffee Palace",
  description: "Haz tu pedido en Coffee Palace",
  // Kiosk + staff screens: keep them out of search engines
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-VE">
      <body>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
