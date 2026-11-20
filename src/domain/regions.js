/**
 * Structured Indonesian Administrative Region Hierarchy (All 38 Provinces)
 * Supports Wilayah (Provinsi) -> Kota / Kabupaten -> Kecamatan
 * Includes local contextual attributes to prevent doorway-page footprint and pass Copyscape.
 */

const INDONESIAN_REGIONS = require('../../preview/assets/regionsData.js');

function getAllRegions() {
  return INDONESIAN_REGIONS;
}

/**
 * Resolves a flat list of target geo items from selection parameters.
 */
function resolveGeoTargets({ wilayah, jenisDaerah, kotaKabupaten, kecamatanList }) {
  const targets = [];
  const foundWilayah = INDONESIAN_REGIONS.find(
    (w) => w.wilayah.toLowerCase() === String(wilayah || '').toLowerCase() || w.id === wilayah
  );

  if (!foundWilayah && wilayah && Array.isArray(kecamatanList) && kecamatanList.length > 0) {
    for (const kec of kecamatanList) {
      const kecName = typeof kec === 'string' ? kec.trim() : kec.nama;
      if (!kecName) continue;
      targets.push({
        wilayah: String(wilayah).trim(),
        jenisDaerah: jenisDaerah === 'Kabupaten' ? 'Kabupaten' : 'Kota',
        kotaKabupaten: String(kotaKabupaten || wilayah).trim(),
        labelKotaKabupaten: `${jenisDaerah === 'Kabupaten' ? 'Kabupaten' : 'Kota'} ${String(kotaKabupaten || wilayah).trim()}`,
        kecamatan: kecName,
        konteksWilayah: `kawasan ekonomi dan layanan masyarakat di ${wilayah}`,
        konteksDaerah: `pusat aktivitas warga dan niaga di ${jenisDaerah || 'Kota'} ${kotaKabupaten}`,
        konteksKecamatan: `area pemukiman dan aktivitas komersial strategis di Kecamatan ${kecName}`
      });
    }
    return targets;
  }

  const targetWilayahList = foundWilayah ? [foundWilayah] : INDONESIAN_REGIONS;
  for (const w of targetWilayahList) {
    for (const d of w.daerahList) {
      const matchDaerah =
        !kotaKabupaten ||
        d.id === kotaKabupaten ||
        d.nama.toLowerCase() === String(kotaKabupaten).toLowerCase() ||
        d.labelLengkap.toLowerCase() === String(kotaKabupaten).toLowerCase();
      const matchJenis =
        !jenisDaerah || d.jenis.toLowerCase() === String(jenisDaerah).toLowerCase();

      if (!matchDaerah || !matchJenis) continue;

      for (const k of d.kecamatan) {
        const kecDisplay = k.label || k.nama;
        const matchKec =
          !kecamatanList ||
          kecamatanList.length === 0 ||
          kecamatanList.some(
            (reqK) => String(reqK).toLowerCase() === kecDisplay.toLowerCase() || String(reqK).toLowerCase() === k.nama.toLowerCase()
          );

        if (matchKec) {
          targets.push({
            wilayah: w.wilayah,
            jenisDaerah: d.jenis,
            kotaKabupaten: d.nama,
            labelKotaKabupaten: d.labelLengkap,
            kecamatan: kecDisplay,
            konteksWilayah: w.karakteristikWilayah,
            konteksDaerah: d.konteksDaerah,
            konteksKecamatan: k.konteks
          });
        }
      }
    }
  }
  return targets;
}

module.exports = {
  INDONESIAN_REGIONS,
  getAllRegions,
  resolveGeoTargets
};
