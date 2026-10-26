function LegalLayout({ title, children }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 text-stone-800">
      <p className="text-sm uppercase tracking-wide text-stone-500">Soulmap</p>
      <h1 className="text-3xl font-semibold text-stone-900">{title}</h1>
      <div className="space-y-4 text-sm leading-6">{children}</div>
      <footer className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-stone-500">
        <a href="/" className="underline">
          Zurück
        </a>
        <a href="/impressum" className="underline">
          Impressum
        </a>
        <a href="/datenschutz" className="underline">
          Datenschutz
        </a>
      </footer>
    </main>
  );
}

export function ImpressumPage() {
  return (
    <LegalLayout title="Impressum">
      <p>Soulmap ist ein Angebot von Andre.</p>
      <p>Website: https://app.mithertz.online</p>
      <p>
        Anschrift, ladungsfähige E-Mail und gegebenenfalls Telefon nach § 5 DDG trägt der Betreiber
        hier nach, bevor die Seite öffentlich betrieben wird. Diese Angaben werden nicht erfunden.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Datenschutz">
      <p>
        Soulmap speichert keine Konversation, kein Nutzerkonto und kein Endnutzer-Login. Der
        Gesprächstext bleibt im Browser und wird nur für die jeweilige Antwort an OpenAI übermittelt.
      </p>
      <p>
        IP-Adresse und daraus abgeleiteter Ländercode werden in der Nutzungsstatistik gespeichert.
        Zweck sind Betrieb, Missbrauchsschutz und technisches Monitoring. Rechtsgrundlage ist das
        berechtigte Interesse. Die Speicherung endet 6 Monate nach dem Ereignis.
      </p>
      <p>
        Ein Klick auf „Unterkunft suchen“ ist eine Anzeige und leitet zu Booking.com weiter. Ab dort
        verarbeitet Booking.com die Anfrage. Empfehlungen sind unverbindlich.
      </p>
      <p>Du interagierst im Gespräch mit einer KI. Der Hinweis erscheint in der Sitzung selbst.</p>
    </LegalLayout>
  );
}
