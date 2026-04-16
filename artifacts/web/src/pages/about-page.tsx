import { useGetSettings } from "@workspace/api-client-react";
import { CalendarHeart, MapPin, Phone, Store } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { getImageUrl } from "@/lib/utils";

export default function AboutPage() {
  const { t } = useLanguage();
  const { data: settings, isLoading } = useGetSettings();
  const publicSettings = (settings ?? {}) as Record<string, unknown>;
  const proprietorName = String(publicSettings.proprietorName || "Sandesh Kharal");
  const secondaryProprietorName = "Yubraj Kharel";
  const secondaryProprietorPhone = "9819499002";
  const ownerPhoto = getImageUrl(settings?.ownerPhotoPath);
  const shopPhoto = getImageUrl(settings?.shopPhotoPath);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="bg-primary text-primary-foreground py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}
        ></div>
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6">{t.about.title}</h1>
          <p className="text-xl text-primary-foreground/80 font-medium">{t.about.subtitle}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-20">
        <div className="bg-card rounded-3xl shadow-xl border border-border/50 overflow-hidden flex flex-col md:flex-row">
          <div className="p-8 md:p-16 flex-1">
            <div className="flex items-center gap-3 text-accent mb-6 font-bold tracking-widest text-sm uppercase">
              <CalendarHeart className="w-5 h-5" />
              {t.about.established}
            </div>

            <h2 className="text-3xl font-serif font-bold text-foreground mb-6">
              {settings?.shopName || "Rajesh Shopping Center"}
            </h2>

            <div className="prose prose-lg text-muted-foreground leading-relaxed mb-10">
              <p>{t.about.defaultAbout1}</p>
              <p className="mt-4">{t.about.defaultAbout2}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">{t.about.ownerCaption}</h4>
                  <p className="text-sm text-muted-foreground">{proprietorName}</p>
                  <p className="text-sm text-muted-foreground">{secondaryProprietorName} • {secondaryProprietorPhone}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">{t.about.address}</h4>
                  <p className="text-sm text-muted-foreground">
                    {settings?.address || "Musikot-5, Aapchaur, Gulmi, Nepal"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">{t.about.contact}</h4>
                  <p className="text-sm text-muted-foreground">{settings?.phone || "N/A"}</p>
                  {settings?.email && <p className="text-sm text-muted-foreground">{settings.email}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="md:w-[400px] bg-muted relative shrink-0">
            {ownerPhoto ? (
              <img src={ownerPhoto} alt="Owner" className="w-full h-full object-cover" />
            ) : shopPhoto ? (
              <img src={shopPhoto} alt="Shop exterior" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full min-h-[300px] flex items-center justify-center text-muted-foreground">
                <Store className="w-24 h-24 opacity-20" />
              </div>
            )}

            {ownerPhoto && (
              <div className="absolute bottom-6 left-6 right-6 bg-background/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-white/20">
                <p className="font-bold text-center text-foreground font-serif">{t.about.ownerCaption}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-24 text-center">
        <h3 className="text-2xl font-serif font-bold mb-10">{t.about.importantInfo}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="bg-muted/30 p-8 rounded-2xl border border-border">
            <h4 className="font-bold text-lg mb-4">{t.about.deliveryPolicy}</h4>
            <p className="text-muted-foreground text-sm leading-relaxed">{t.about.defaultDelivery}</p>
          </div>
          <div className="bg-muted/30 p-8 rounded-2xl border border-border">
            <h4 className="font-bold text-lg mb-4">{t.about.termsConditions}</h4>
            <p className="text-muted-foreground text-sm leading-relaxed">{t.about.defaultTerms}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="bg-muted/30 p-8 rounded-2xl border border-border">
            <h4 className="font-bold text-lg mb-4">Sandesh Hardware and Suppliers</h4>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Hardware, construction materials, cement, rods, pipes, fittings, and related supply support for customers.
            </p>
          </div>
          <div className="bg-muted/30 p-8 rounded-2xl border border-border">
            <h4 className="font-bold text-lg mb-4">Sagar Shree Stores</h4>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Additional goods, service support, and local partner assistance for customers needing more options.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
