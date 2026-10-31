import type { Metadata } from "next";
import { Documento, metadataDe } from "@/components/documento";

export { viewport } from "@/components/documento";
export const metadata: Metadata = metadataDe("en");

export default function LayoutIngles({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Documento idioma="en">{children}</Documento>;
}
