# Google Search Console Zugriff

Direkter API-Zugriff auf Search Console Daten für `pack-factory.de`, ohne Browser.

## Setup (einmalig, schon erledigt)

1. Google Cloud Projekt `packfactory-seo` mit aktivierter "Google Search Console API"
2. Service Account `search-console-reader@packfactory-seo.iam.gserviceaccount.com`
3. JSON-Schlüssel liegt **außerhalb dieses Repos** unter `~/.credentials/packfactory-seo/service-account.json`
4. Der Service Account ist in Search Console (Einstellungen → Nutzer und Berechtigungen) als Nutzer für `pack-factory.de` hinterlegt

## Nutzung

```bash
python tools/gsc/gsc.py pages --days 28       # Top-Seiten nach Klicks/Impressionen/CTR/Position
python tools/gsc/gsc.py queries --days 28     # Top-Suchanfragen
python tools/gsc/gsc.py devices --days 28     # Aufschlüsselung nach Gerätetyp
python tools/gsc/gsc.py inspect <url>         # URL Inspection (Indexierungsstatus einer einzelnen Seite)
```

Braucht `google-api-python-client` und `google-auth` (`pip install google-api-python-client google-auth`).

**Die Schlüsseldatei niemals in dieses Repo legen oder committen.**
