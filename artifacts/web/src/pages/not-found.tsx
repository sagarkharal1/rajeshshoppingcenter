import { Store, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-8 text-muted-foreground">
        <Store className="w-12 h-12" />
      </div>
      <h1 className="text-6xl font-serif font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-bold text-foreground mb-4">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        The aisle you are looking for doesn't exist in our store. It might have been moved or removed.
      </p>
      <Link 
        href="/" 
        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Store
      </Link>
    </div>
  );
}
