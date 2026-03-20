import { Header } from "@/components/layout/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata = {
  title: "Playball Guide",
  description: "Playball Service Documentation and Sandbox",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen flex flex-col">
        <Header />
        <TooltipProvider>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
