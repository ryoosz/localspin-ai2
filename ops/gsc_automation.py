import os
import sys
import argparse
from googleapiclient.discovery import build
from oauth2client.service_account import ServiceAccountCredentials
from googleapiclient.errors import HttpError

# --- KONFIGURASI DEFAULT ---
DEFAULT_SERVICE_ACCOUNT_FILE = os.environ.get('GSC_SERVICE_ACCOUNT_FILE', 'service-account-key.json')
DEFAULT_SITE_URL = os.environ.get('GSC_SITE_URL', 'https://www.domainanda.com/')
DEFAULT_SITEMAP_URL = os.environ.get('GSC_SITEMAP_URL', 'https://www.domainanda.com/sitemap.xml')

# Scope izin yang dibutuhkan (webmasters untuk akses baca/tulis penuh)
SCOPES = ['https://www.googleapis.com/auth/webmasters']


def get_gsc_service(service_account_file):
    """Mengautentikasi dan mengembalikan objek service GSC API."""
    try:
        credentials = ServiceAccountCredentials.from_json_keyfile_name(
            service_account_file, scopes=SCOPES
        )
        service = build('webmasters', 'v3', credentials=credentials)
        return service
    except Exception as e:
        print(f"GAGAL membuat service GSC: {e}", file=sys.stderr)
        return None


def add_site_to_gsc(service, site_url):
    """Menambahkan properti situs ke akun Search Console."""
    try:
        service.sites().add(siteUrl=site_url).execute()
        print(f"OK: Situs '{site_url}' berhasil ditambahkan (atau sudah terdaftar).")
        return True
    except HttpError as e:
        if e.resp.status == 409:
            print(f"INFO: Situs '{site_url}' sudah terdaftar, melanjutkan ke submit sitemap.")
            return True
        print(f"GAGAL menambahkan situs: {e}", file=sys.stderr)
        return False


def submit_sitemap(service, site_url, sitemap_url):
    """Mengirimkan sitemap ke Google Search Console."""
    try:
        service.sitemaps().submit(siteUrl=site_url, feedpath=sitemap_url).execute()
        print(f"OK: Sitemap '{sitemap_url}' berhasil dikirim untuk properti '{site_url}'.")
        return True
    except HttpError as e:
        print(f"GAGAL mengirim sitemap: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Otomatisasi Google Search Console (Add Site & Submit Sitemap)')
    parser.add_argument('--key-file', default=DEFAULT_SERVICE_ACCOUNT_FILE, help='Path ke service-account-key.json')
    parser.add_argument('--site-url', default=DEFAULT_SITE_URL, help='URL properti di GSC')
    parser.add_argument('--sitemap-url', default=DEFAULT_SITEMAP_URL, help='URL lengkap sitemap.xml')
    args = parser.parse_args()

    print('--- Memulai Otomatisasi Google Search Console ---')
    gsc_service = get_gsc_service(args.key_file)
    if not gsc_service:
        print('Proses dihentikan karena autentikasi gagal.', file=sys.stderr)
        sys.exit(1)

    add_site_to_gsc(gsc_service, args.site_url)
    ok = submit_sitemap(gsc_service, args.site_url, args.sitemap_url)
    print('--- Proses Selesai ---')
    sys.exit(0 if ok else 2)


if __name__ == '__main__':
    main()
