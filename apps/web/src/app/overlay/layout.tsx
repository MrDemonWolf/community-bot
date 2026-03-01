export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-transparent">{children}</div>;
}
