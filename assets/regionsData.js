/**
 * Data Hirarki Wilayah Administratif Indonesia (38 Provinsi -> Kota / Kabupaten -> Kecamatan)
 * Format UMD: Dapat digunakan langsung di Browser (<script src="assets/regionsData.js">) maupun Node.js (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.INDONESIAN_REGIONS_DATA = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function makeReg(id, wilayah, zonaWaktu, karakteristikWilayah, daerahList) {
    return { id, wilayah, zonaWaktu, karakteristikWilayah, daerahList };
  }
  function makeDaerah(id, jenis, nama, konteksDaerah, kecamatanNames) {
    const labelLengkap = `${jenis} ${nama}`;
    return {
      id,
      jenis,
      nama,
      labelLengkap,
      konteksDaerah: konteksDaerah || `pusat aktivitas ekonomi, perdagangan, dan layanan masyarakat di ${labelLengkap}`,
      kecamatan: kecamatanNames.map((k) =>
        typeof k === 'string'
          ? { nama: k, konteks: `area pemukiman, UMKM, dan aktivitas niaga strategis di Kecamatan ${k}` }
          : k
      )
    };
  }

  return [
    // === SUMATERA (10 Provinsi) ===
    makeReg('wil-aceh', 'Aceh', 'WIB', 'gerbang barat Nusantara dengan pusat perdagangan, pelabuhan, dan agribisnis Aceh', [
      makeDaerah('aceh-banda-kota', 'Kota', 'Banda Aceh', 'ibu kota provinsi dan pusat jasa serta pemerintahan Aceh', ['Baiturrahman', 'Kuta Alam', 'Syiah Kuala', 'Ulee Kareng', 'Lueng Bata']),
      makeDaerah('aceh-lhokseumawe', 'Kota', 'Lhokseumawe', 'kota industri energi dan pelabuhan pantai timur Aceh', ['Banda Sakti', 'Muara Dua', 'Muara Satu', 'Blang Mangat']),
      makeDaerah('aceh-besar', 'Kabupaten', 'Aceh Besar', 'kawasan penyangga ibu kota provinsi, bandara, dan pertanian', ['Ingin Jaya', 'Darul Imarah', 'Krueng Barona Jaya', 'Kuta Baro']),
      makeDaerah('aceh-utara', 'Kabupaten', 'Aceh Utara', 'sentra agribisnis dan perdagangan pesisir utara Aceh', ['Lhoksukon', 'Dewantara', 'Tanah Jambo Aye', 'Matangkuli'])
    ]),
    makeReg('wil-sumut', 'Sumatera Utara', 'WIB', 'pusat ekonomi utama Sumatera bagian utara dengan jaringan perkebunan, industri, dan pelabuhan Belawan', [
      makeDaerah('sumut-medan', 'Kota', 'Medan', 'metropolitan terbesar di Sumatera dan pusat bisnis regional', ['Medan Polonia', 'Medan Baru', 'Medan Johor', 'Medan Sunggal', 'Medan Timur', 'Medan Selayang']),
      makeDaerah('sumut-binjai', 'Kota', 'Binjai', 'kota penyangga barat Medan dengan pertumbuhan perumahan dan ritel', ['Binjai Kota', 'Binjai Timur', 'Binjai Barat', 'Binjai Selatan']),
      makeDaerah('sumut-pematangsiantar', 'Kota', 'Pematangsiantar', 'pusat perdagangan koridor tengah menuju Danau Toba', ['Siantar Barat', 'Siantar Timur', 'Siantar Selatan', 'Siantar Marihat']),
      makeDaerah('sumut-deli-serdang', 'Kabupaten', 'Deli Serdang', 'kawasan industri, Bandara Kualanamu, dan pemukiman padat penyangga Medan', ['Lubuk Pakam', 'Percut Sei Tuan', 'Sunggal', 'Tanjung Morawa', 'Batang Kuis']),
      makeDaerah('sumut-karo', 'Kabupaten', 'Karo', 'sentra hortikultura dataran tinggi dan pariwisata Berastagi', ['Kabanjahe', 'Berastagi', 'Tigapanah', 'Simpang Empat'])
    ]),
    makeReg('wil-sumbar', 'Sumatera Barat', 'WIB', 'pusat perdagangan Minangkabau, pendidikan tinggi, dan pariwisata budaya', [
      makeDaerah('sumbar-padang', 'Kota', 'Padang', 'ibu kota provinsi dan pusat pelabuhan Teluk Bayur serta pendidikan', ['Padang Barat', 'Padang Timur', 'Padang Utara', 'Koto Tangah', 'Nanggalo']),
      makeDaerah('sumbar-bukittinggi', 'Kota', 'Bukittinggi', 'pusat grosir tekstil, niaga dataran tinggi, dan wisata', ['Guguk Panjang', 'Mandiangin Koto Selayan', 'Aur Birugo Tigo Baleh']),
      makeDaerah('sumbar-payakumbuh', 'Kota', 'Payakumbuh', 'sentra kuliner, perdagangan, dan UMKM Sumatera Barat bagian timur', ['Payakumbuh Barat', 'Payakumbuh Timur', 'Payakumbuh Utara']),
      makeDaerah('sumbar-agam', 'Kabupaten', 'Agam', 'kawasan agribisnis, danau Maninjau, dan penyangga Bukittinggi', ['Lubuk Basung', 'Banuhampu', 'Ampek Angkek', 'Tilatang Kamang'])
    ]),
    makeReg('wil-riau', 'Riau', 'WIB', 'koridor energi, perkebunan kelapa sawit, dan perdagangan strategis Selat Malaka', [
      makeDaerah('riau-pekanbaru', 'Kota', 'Pekanbaru', 'ibu kota provinsi dengan pertumbuhan jasa, properti, dan korporasi energi', ['Tampan', 'Marpoyan Damai', 'Sukajadi', 'Bukit Raya', 'Tenayan Raya']),
      makeDaerah('riau-dumai', 'Kota', 'Dumai', 'kota pelabuhan ekspor utama dan industri hilir di pesisir Riau', ['Dumai Kota', 'Dumai Timur', 'Dumai Barat', 'Bukit Kapur']),
      makeDaerah('riau-kampar', 'Kabupaten', 'Kampar', 'penyangga barat Pekanbaru dan sentra perkebunan serta perikanan', ['Bangkinang Kota', 'Siak Hulu', 'Tambang', 'Tapung']),
      makeDaerah('riau-siak', 'Kabupaten', 'Siak', 'kawasan perkebunan, industri kertas, dan wisata sejarah', ['Siak', 'Tualang', 'Minas', 'Kandis'])
    ]),
    makeReg('wil-kepri', 'Kepulauan Riau', 'WIB', 'kawasan perdagangan bebas internasional, industri maritim, dan gerbang Singapura', [
      makeDaerah('kepri-batam', 'Kota', 'Batam', 'zona perdagangan bebas, manufaktur elektronik, dan galangan kapal', ['Batam Kota', 'Lubuk Baja', 'Batu Ampar', 'Sekupang', 'Sagulung', 'Nongsa']),
      makeDaerah('kepri-tanjungpinang', 'Kota', 'Tanjungpinang', 'ibu kota provinsi dan pusat pemerintahan Kepulauan Riau', ['Tanjungpinang Kota', 'Tanjungpinang Timur', 'Bukit Bestari', 'Tanjungpinang Barat']),
      makeDaerah('kepri-bintan', 'Kabupaten', 'Bintan', 'kawasan pariwisata internasional Lagoi dan industri maritim', ['Bintan Timur', 'Bintan Utara', 'Teluk Sebong', 'Gunung Kijang'])
    ]),
    makeReg('wil-jambi', 'Jambi', 'WIB', 'sentra perkebunan karet-sawit dan perdagangan koridor tengah Sumatera', [
      makeDaerah('jambi-kota', 'Kota', 'Jambi', 'ibu kota provinsi dan pusat niaga Sungai Batanghari', ['Telanaipura', 'Kota Baru', 'Jambi Timur', 'Jambi Selatan', 'Alam Barajo']),
      makeDaerah('jambi-sungaipenuh', 'Kota', 'Sungai Penuh', 'pusat perdagangan dataran tinggi Kerinci', ['Sungai Penuh', 'Hamparan Rawang', 'Pesisir Bukit']),
      makeDaerah('jambi-muarojambi', 'Kabupaten', 'Muaro Jambi', 'penyangga utama Kota Jambi dan kawasan pergudangan', ['Jaluko', 'Sekernan', 'Sungai Gelam', 'Mestong'])
    ]),
    makeReg('wil-sumsel', 'Sumatera Selatan', 'WIB', 'pusat ekonomi Sumatera bagian selatan dengan sektor energi, agribisnis, dan infrastruktur terpadu', [
      makeDaerah('sumsel-palembang', 'Kota', 'Palembang', 'metropolitan tertua dan pusat bisnis utama di Sumatera Selatan', ['Ilir Barat I', 'Ilir Timur I', 'Ilir Timur II', 'Sukarami', 'Seberang Ulu I', 'Jakabaring']),
      makeDaerah('sumsel-lubuklinggau', 'Kota', 'Lubuklinggau', 'kota transit perdagangan lintas barat Sumatera Selatan', ['Lubuklinggau Barat I', 'Lubuklinggau Timur I', 'Lubuklinggau Selatan I']),
      makeDaerah('sumsel-banyuasin', 'Kabupaten', 'Banyuasin', 'kawasan penyangga pelabuhan Tanjung Api-Api dan lumbung pangan', ['Talang Kelapa', 'Banyuasin III', 'Rambutan', 'Betung']),
      makeDaerah('sumsel-muaraenim', 'Kabupaten', 'Muara Enim', 'sentra energi pertambangan dan perkebunan', ['Muara Enim', 'Lawang Kidul', 'Gelumbang'])
    ]),
    makeReg('wil-babel', 'Kepulauan Bangka Belitung', 'WIB', 'pusat industri timah, pariwisata bahari kelas dunia, dan lada putih', [
      makeDaerah('babel-pangkalpinang', 'Kota', 'Pangkalpinang', 'ibu kota provinsi dan pusat perdagangan Pulau Bangka', ['Bukitintan', 'Gerunggang', 'Pangkal Balam', 'Rangkui', 'Taman Sari']),
      makeDaerah('babel-bangka', 'Kabupaten', 'Bangka', 'kawasan pesisir industri perikanan dan wisata Sungailiat', ['Sungailiat', 'Belinyu', 'Merawang']),
      makeDaerah('babel-belitung', 'Kabupaten', 'Belitung', 'destinasi wisata bahari Tanjung Pandan dan UMKM kreatif', ['Tanjung Pandan', 'Sijuk', 'Badau'])
    ]),
    makeReg('wil-bengkulu', 'Bengkulu', 'WIB', 'kawasan pesisir barat Sumatera dengan kekuatan perkebunan, perikanan, dan pendidikan', [
      makeDaerah('bengkulu-kota', 'Kota', 'Bengkulu', 'ibu kota provinsi dan pusat niaga pantai barat Sumatera', ['Ratu Agung', 'Ratu Samban', 'Gading Cempaka', 'Selebar', 'Singaran Pati']),
      makeDaerah('bengkulu-rejanglebong', 'Kabupaten', 'Rejang Lebong', 'sentra sayuran dataran tinggi dan kopi Curup', ['Curup', 'Curup Tengah', 'Curup Timur', 'Selupu Rejang'])
    ]),
    makeReg('wil-lampung', 'Lampung', 'WIB', 'gerbang utama Pulau Sumatera dengan pelabuhan Bakauheni, agribisnis kopi, dan industri pengolahan', [
      makeDaerah('lampung-bandar', 'Kota', 'Bandar Lampung', 'ibu kota provinsi dan pusat bisnis jasa di ujung selatan Sumatera', ['Tanjungkarang Pusat', 'Sukarame', 'Kedaton', 'Rajabasa', 'Telukbetung Selatan', 'Kemiling']),
      makeDaerah('lampung-metro', 'Kota', 'Metro', 'kota pendidikan dan pusat perdagangan Lampung bagian tengah', ['Metro Pusat', 'Metro Timur', 'Metro Barat', 'Metro Utara']),
      makeDaerah('lampung-selatan', 'Kabupaten', 'Lampung Selatan', 'koridor pelabuhan penyeberangan Bakauheni dan Bandara Radin Inten II', ['Kalianda', 'Natar', 'Bakauheni', 'Sidomulyo']),
      makeDaerah('lampung-tengah', 'Kabupaten', 'Lampung Tengah', 'lumbung pangan dan kawasan agribisnis terbesar di Lampung', ['Gunung Sugih', 'Terbanggi Besar', 'Bandar Jaya', 'Seputih Mataram'])
    ]),

    // === JAWA (6 Provinsi) ===
    makeReg('wil-dki', 'DKI Jakarta', 'WIB', 'pusat bisnis nasional, perkantoran korporasi, dan layanan komersial berstandar tinggi', [
      makeDaerah('dki-jakpus', 'Kota', 'Jakarta Pusat', 'jantung pemerintahan, CBD Thamrin-Sudirman, dan perdagangan grosir Tanah Abang', ['Menteng', 'Tanah Abang', 'Gambir', 'Senen', 'Kemayoran', 'Cempaka Putih']),
      makeDaerah('dki-jaksel', 'Kota', 'Jakarta Selatan', 'distrik perkantoran SCBD, Kuningan, hunian premium, dan gaya hidup urban', ['Kebayoran Baru', 'Tebet', 'Cilandak', 'Setiabudi', 'Pasar Minggu', 'Mampang Prapatan']),
      makeDaerah('dki-jakbar', 'Kota', 'Jakarta Barat', 'pusat niaga Puri Indah, perumahan terpadu, dan kawasan kampus', ['Kebon Jeruk', 'Cengkareng', 'Grogol Petamburan', 'Kembangan', 'Kalideres', 'Palmerah']),
      makeDaerah('dki-jaktim', 'Kota', 'Jakarta Timur', 'kawasan industri Pulogadung, perkantoran, dan pemukiman padat', ['Cakung', 'Duren Sawit', 'Jatinegara', 'Kramat Jati', 'Matraman', 'Pulo Gadung']),
      makeDaerah('dki-jakut', 'Kota', 'Jakarta Utara', 'gerbang pelabuhan Tanjung Priok, PIK, dan kawasan niaga Kelapa Gading', ['Kelapa Gading', 'Penjaringan', 'Tanjung Priok', 'Koja', 'Pademangan', 'Cilincing']),
      makeDaerah('dki-seribu', 'Kabupaten', 'Kepulauan Seribu', 'kawasan wisata bahari dan ekowisata kepulauan ibu kota', ['Kepulauan Seribu Selatan', 'Kepulauan Seribu Utara'])
    ]),
    makeReg('wil-banten', 'Banten', 'WIB', 'koridor industri berat Cilegon-Tangerang, bandara internasional Soekarno-Hatta, dan kota mandiri', [
      makeDaerah('banten-tangerang-kota', 'Kota', 'Tangerang', 'pusat industri, logistik bandara, dan pemukiman padat barat Jakarta', ['Cipondoh', 'Karawaci', 'Ciledug', 'Batuceper', 'Tangerang', 'Pinang']),
      makeDaerah('banten-tangsel', 'Kota', 'Tangerang Selatan', 'kota mandiri BSD, Bintaro, Alam Sutera dengan daya beli tinggi', ['Serpong', 'Pondok Aren', 'Ciputat', 'Pamulang', 'Setu', 'Serpong Utara']),
      makeDaerah('banten-serang-kota', 'Kota', 'Serang', 'ibu kota Provinsi Banten dan pusat layanan publik regional', ['Serang', 'Cipocok Jaya', 'Taktakan', 'Curug']),
      makeDaerah('banten-cilegon', 'Kota', 'Cilegon', 'kota industri baja, petrokimia, dan pelabuhan penyeberangan Merak', ['Cilegon', 'Pulomerak', 'Cibeber', 'Jombang']),
      makeDaerah('banten-tangerang-kab', 'Kabupaten', 'Tangerang', 'kawasan industri Cikupa-Balaraja dan kota terpadu Gading Serpong', ['Kelapa Dua', 'Cikupa', 'Balaraja', 'Pasar Kemis', 'Curug', 'Pagedangan'])
    ]),
    makeReg('wil-jabar', 'Jawa Barat', 'WIB', 'koridor ekonomi kreatif, manufaktur terbesar nasional, dan megapolitan penyangga ibu kota', [
      makeDaerah('jabar-bandung-kota', 'Kota', 'Bandung', 'pusat komersial, pendidikan tinggi, kuliner, dan bisnis kreatif Jawa Barat', ['Coblong', 'Buahbatu', 'Cicendo', 'Lengkong', 'Sukajadi', 'Antapani', 'Arcamanik']),
      makeDaerah('jabar-bandung-kab', 'Kabupaten', 'Bandung', 'kawasan penyangga agribisnis, industri tekstil, dan perumahan selatan Bandung', ['Soreang', 'Bojongsoang', 'Margahayu', 'Cileunyi', 'Dayeuhkolot', 'Baleendah']),
      makeDaerah('jabar-bekasi-kota', 'Kota', 'Bekasi', 'kota megapolitan timur Jakarta dengan pertumbuhan apartemen dan jasa sangat pesat', ['Bekasi Barat', 'Bekasi Selatan', 'Jatiasih', 'Pondokgede', 'Bekasi Timur', 'Rawalumbu']),
      makeDaerah('jabar-bekasi-kab', 'Kabupaten', 'Bekasi', 'koridor kawasan industri manufaktur terbesar di Asia Tenggara', ['Cikarang Selatan', 'Cikarang Utara', 'Tambun Selatan', 'Cibitung', 'Cikarang Barat']),
      makeDaerah('jabar-depok', 'Kota', 'Depok', 'kota pendidikan, hunian komuter, dan pusat niaga Koridor Margonda', ['Beji', 'Sukmajaya', 'Pancoran Mas', 'Cimanggis', 'Cinere', 'Sawangan', 'Limo']),
      makeDaerah('jabar-bogor-kota', 'Kota', 'Bogor', 'kota wisata kuliner, penelitian, dan perdagangan selatan Jakarta', ['Bogor Tengah', 'Bogor Utara', 'Bogor Selatan', 'Bogor Barat', 'Tanah Sareal']),
      makeDaerah('jabar-bogor-kab', 'Kabupaten', 'Bogor', 'kawasan penyangga luas Cibinong, Sentul, hingga koridor industri Gunung Putri', ['Cibinong', 'Gunung Putri', 'Citeureup', 'Cileungsi', 'Babakan Madang', 'Parung']),
      makeDaerah('jabar-karawang', 'Kabupaten', 'Karawang', 'pusat industri otomotif nasional dan lumbung padi Jawa Barat', ['Karawang Barat', 'Karawang Timur', 'Telukjambe Timur', 'Klari', 'Cikampek']),
      makeDaerah('jabar-cirebon-kota', 'Kota', 'Cirebon', 'simpul perdagangan pantai utara dan pelabuhan timur Jawa Barat', ['Kejaksan', 'Kesambi', 'Harjamukti', 'Lemahwungkuk']),
      makeDaerah('jabar-tasikmalaya-kota', 'Kota', 'Tasikmalaya', 'pusat bisnis dan UMKM kreatif wilayah Priangan Timur', ['Cihideung', 'Tawang', 'Cipedes', 'Indihiang'])
    ]),
    makeReg('wil-jateng', 'Jawa Tengah', 'WIB', 'koridor manufaktur, logistik pantai utara, dan pusat ekonomi budaya Jawa Tengah', [
      makeDaerah('jateng-semarang-kota', 'Kota', 'Semarang', 'ibu kota provinsi dengan pelabuhan Tanjung Emas dan pusat bisnis Simpang Lima', ['Semarang Tengah', 'Banyumanik', 'Tembalang', 'Pedurungan', 'Semarang Barat', 'Ngaliyan']),
      makeDaerah('jateng-semarang-kab', 'Kabupaten', 'Semarang', 'koridor industri Ungaran dan wisata pegunungan Bandungan', ['Ungaran Barat', 'Ungaran Timur', 'Bergas', 'Ambarawa', 'Bawen']),
      makeDaerah('jateng-surakarta', 'Kota', 'Surakarta (Solo)', 'pusat perdagangan batik, kuliner, dan bisnis Solo Raya', ['Banjarsari', 'Laweyan', 'Jebres', 'Serengan', 'Pasar Kliwon']),
      makeDaerah('jateng-pekalongan-kota', 'Kota', 'Pekalongan', 'sentra industri batik nasional dan perikanan Pantura', ['Pekalongan Barat', 'Pekalongan Timur', 'Pekalongan Utara']),
      makeDaerah('jateng-tegal-kota', 'Kota', 'Tegal', 'pusat niaga dan industri logam pantai utara bagian barat', ['Tegal Barat', 'Tegal Timur', 'Tegal Selatan', 'Margadana']),
      makeDaerah('jateng-banyumas', 'Kabupaten', 'Banyumas (Purwokerto)', 'pusat pendidikan dan perdagangan Jawa Tengah bagian barat daya', ['Purwokerto Selatan', 'Purwokerto Utara', 'Purwokerto Timur', 'Sokaraja'])
    ]),
    makeReg('wil-diy', 'DI Yogyakarta', 'WIB', 'kota pelajar nasional, ekonomi kreatif digital, dan destinasi pariwisata budaya utama', [
      makeDaerah('diy-yogya-kota', 'Kota', 'Yogyakarta', 'pusat heritage Malioboro, pendidikan, dan bisnis jasa kreatif', ['Gondokusuman', 'Umbulharjo', 'Jetis', 'Kotagede', 'Danurejan', 'Mergangsan']),
      makeDaerah('diy-sleman', 'Kabupaten', 'Sleman', 'kawasan pertumbuhan utara dengan konsentrasi universitas besar dan startup', ['Depok', 'Mlati', 'Ngaglik', 'Gamping', 'Kalasan', 'Ngemplak']),
      makeDaerah('diy-bantul', 'Kabupaten', 'Bantul', 'sentra kerajinan ekspor Kasongan, kuliner, dan hunian selatan Jogja', ['Kasihan', 'Sewon', 'Banguntapan', 'Bantul', 'Jetis']),
      makeDaerah('diy-kulonprogo', 'Kabupaten', 'Kulon Progo', 'koridor Bandara Internasional Yogyakarta (YIA) dan agribisnis', ['Wates', 'Temon', 'Sentolo', 'Pengasih']),
      makeDaerah('diy-gunungkidul', 'Kabupaten', 'Gunungkidul', 'kawasan wisata pantai selatan dan ekonomi kreatif lokal', ['Wonosari', 'Playen', 'Karangmojo', 'Patuk'])
    ]),
    makeReg('wil-jatim', 'Jawa Timur', 'WIB', 'gerbang ekonomi Indonesia Timur dengan kekuatan industri maritim, manufaktur, dan perdagangan', [
      makeDaerah('jatim-surabaya', 'Kota', 'Surabaya', 'metropolitan terbesar kedua di Indonesia dengan aktivitas jasa dan ritel modern', ['Gubeng', 'Wonokromo', 'Rungkut', 'Sukolilo', 'Tegalsari', 'Wiyung', 'Kenjeran']),
      makeDaerah('jatim-sidoarjo', 'Kabupaten', 'Sidoarjo', 'penyangga utama Surabaya dengan kekuatan UMKM, industri, dan Bandara Juanda', ['Waru', 'Sidoarjo', 'Taman', 'Gedangan', 'Buduran', 'Krian']),
      makeDaerah('jatim-gresik', 'Kabupaten', 'Gresik', 'kawasan industri berat, semen, pelabuhan, dan JIIPE', ['Gresik', 'Kebomas', 'Manyar', 'Driyorejo']),
      makeDaerah('jatim-malang-kota', 'Kota', 'Malang', 'kota pendidikan tinggi, wisata, dan ekonomi kreatif Jawa Timur', ['Lowokwaru', 'Klojen', 'Blimbing', 'Sukun', 'Kedungkandang']),
      makeDaerah('jatim-malang-kab', 'Kabupaten', 'Malang', 'kawasan agribisnis, wisata pantai selatan, dan penyangga Malang Raya', ['Kepanjen', 'Singosari', 'Lawang', 'Pakis', 'Dau']),
      makeDaerah('jatim-kediri-kota', 'Kota', 'Kediri', 'pusat perdagangan dan industri pengolahan di koridor Sungai Brantas', ['Kota Kediri', 'Mojoroto', 'Pesantren']),
      makeDaerah('jatim-jember', 'Kabupaten', 'Jember', 'pusat ekonomi kawasan Tapal Kuda dan agribisnis perkebunan', ['Sumbersari', 'Kaliwates', 'Patrang', 'Ambulu'])
    ]),

    // === BALI & NUSA TENGGARA (3 Provinsi) ===
    makeReg('wil-bali', 'Bali', 'WITA', 'pusat pariwisata internasional, industri kreatif, perhotelan, dan properti kelas dunia', [
      makeDaerah('bali-denpasar', 'Kota', 'Denpasar', 'ibu kota Provinsi Bali dan pusat bisnis, perkantoran, serta layanan komersial', ['Denpasar Selatan', 'Denpasar Barat', 'Denpasar Timur', 'Denpasar Utara']),
      makeDaerah('bali-badung', 'Kabupaten', 'Badung', 'pusat pariwisata Kuta, Seminyak, Canggu, Jimbaran, dan Nusa Dua', ['Kuta', 'Kuta Selatan', 'Kuta Utara', 'Mengwi', 'Abiansemal']),
      makeDaerah('bali-gianyar', 'Kabupaten', 'Gianyar', 'sentra seni budaya Ubud, vila wisata, dan kerajinan ekspor', ['Ubud', 'Gianyar', 'Sukawati', 'Blahbatuh']),
      makeDaerah('bali-tabanan', 'Kabupaten', 'Tabanan', 'lumbung pangan Bali dan kawasan pengembangan properti barat', ['Tabanan', 'Kediri', 'Kerambitan']),
      makeDaerah('bali-buleleng', 'Kabupaten', 'Buleleng', 'pusat pendidikan dan wisata pesisir utara Bali (Singaraja)', ['Buleleng', 'Banjar', 'Sukasada'])
    ]),
    makeReg('wil-ntb', 'Nusa Tenggara Barat', 'WITA', 'kawasan pariwisata Lombok-Sumbawa, sirkuit internasional Mandalika, dan agribisnis', [
      makeDaerah('ntb-mataram', 'Kota', 'Mataram', 'ibu kota provinsi dan pusat perdagangan Pulau Lombok', ['Mataram', 'Cakranegara', 'Selaparang', 'Ampenan', 'Sandubaya']),
      makeDaerah('ntb-bima-kota', 'Kota', 'Bima', 'pusat niaga dan pelabuhan wilayah timur Pulau Sumbawa', ['Rasanae Barat', 'Rasanae Timur', 'Mpunda']),
      makeDaerah('ntb-lombok-barat', 'Kabupaten', 'Lombok Barat', 'kawasan wisata Senggigi dan pelabuhan Lembar', ['Gerung', 'Batu Layar', 'Narmada', 'Lingsar']),
      makeDaerah('ntb-lombok-tengah', 'Kabupaten', 'Lombok Tengah', 'lokasi Bandara Internasional Lombok dan KEK Mandalika', ['Praya', 'Pujut', 'Jonggat'])
    ]),
    makeReg('wil-ntt', 'Nusa Tenggara Timur', 'WITA', 'destinasi wisata bahari super-prioritas Labuan Bajo-Komodo dan peternakan nusantara', [
      makeDaerah('ntt-kupang-kota', 'Kota', 'Kupang', 'ibu kota provinsi dan pusat pelabuhan niaga Timor', ['Oebobo', 'Kelapa Lima', 'Maulafa', 'Kota Lama', 'Alak']),
      makeDaerah('ntt-manggaraibarat', 'Kabupaten', 'Manggarai Barat', 'kawasan wisata internasional Labuan Bajo dan Taman Nasional Komodo', ['Komodo', 'Sano Nggoang', 'Boleng']),
      makeDaerah('ntt-sikka', 'Kabupaten', 'Sikka', 'pusat niaga dan pelabuhan di Pulau Flores bagian tengah', ['Alok', 'Alok Timur', 'Alok Barat'])
    ]),

    // === KALIMANTAN (5 Provinsi) ===
    makeReg('wil-kalbar', 'Kalimantan Barat', 'WIB', 'koridor perdagangan lintas batas Malaysia, perkebunan, dan pelabuhan Pontianak', [
      makeDaerah('kalbar-pontianak', 'Kota', 'Pontianak', 'ibu kota provinsi di garis khatulistiwa dan pusat niaga Kalbar', ['Pontianak Kota', 'Pontianak Selatan', 'Pontianak Tenggara', 'Pontianak Barat', 'Pontianak Utara']),
      makeDaerah('kalbar-singkawang', 'Kota', 'Singkawang', 'kota wisata budaya, kuliner, dan jasa pesisir utara', ['Singkawang Tengah', 'Singkawang Barat', 'Singkawang Selatan']),
      makeDaerah('kalbar-kuburaya', 'Kabupaten', 'Kubu Raya', 'lokasi Bandara Supadio dan kawasan pergudangan penyangga Pontianak', ['Sungai Raya', 'Sungai Kakap', 'Kuala Mandor B'])
    ]),
    makeReg('wil-kalteng', 'Kalimantan Tengah', 'WIB', 'pusat agribisnis, kehutanan berkelanjutan, dan perdagangan jalur sungai Kalimantan tengah', [
      makeDaerah('kalteng-palangkaraya', 'Kota', 'Palangka Raya', 'ibu kota provinsi dengan tata ruang terencana dan pusat pendidikan', ['Jekan Raya', 'Pahandut', 'Sebangau', 'Bukit Batu']),
      makeDaerah('kalteng-kotim', 'Kabupaten', 'Kotawaringin Timur', 'pusat pelabuhan Sampit dan perdagangan agribisnis', ['Mentawa Baru Ketapang', 'Baamang', 'Seranau']),
      makeDaerah('kalteng-kobar', 'Kabupaten', 'Kotawaringin Barat', 'pusat niaga Pangkalan Bun dan gerbang Taman Nasional Tanjung Puting', ['Arut Selatan', 'Kumai', 'Pangkalan Lada'])
    ]),
    makeReg('wil-kalsel', 'Kalimantan Selatan', 'WITA', 'pusat niaga sungai, pelabuhan Trisakti, dan lumbung logistik Kalimantan bagian selatan', [
      makeDaerah('kalsel-banjarmasin', 'Kota', 'Banjarmasin', 'kota seribu sungai dan pusat perdagangan regional Kalimantan Selatan', ['Banjarmasin Tengah', 'Banjarmasin Timur', 'Banjarmasin Selatan', 'Banjarmasin Utara', 'Banjarmasin Barat']),
      makeDaerah('kalsel-banjarbaru', 'Kota', 'Banjarbaru', 'ibu kota provinsi baru, Bandara Syamsudin Noor, dan pusat pemerintahan', ['Banjarbaru Selatan', 'Banjarbaru Utara', 'Landasan Ulin', 'Liang Anggang']),
      makeDaerah('kalsel-banjar', 'Kabupaten', 'Banjar', 'pusat perdagangan permata Martapura dan penyangga metropolitan Banjarbakula', ['Martapura', 'Kertak Hanyar', 'Gambut'])
    ]),
    makeReg('wil-kaltim', 'Kalimantan Timur', 'WITA', 'lokasi Ibu Kota Nusantara (IKN), pusat energi migas-batubara, dan kota pelabuhan modern', [
      makeDaerah('kaltim-samarinda', 'Kota', 'Samarinda', 'ibu kota provinsi dan pusat perdagangan sungai Mahakam', ['Samarinda Ulu', 'Samarinda Ilir', 'Samarinda Kota', 'Sungai Kunjang', 'Loa Janan Ilir']),
      makeDaerah('kaltim-balikpapan', 'Kota', 'Balikpapan', 'kota minyak, Bandara Sepinggan, dan pintu gerbang utama menuju IKN', ['Balikpapan Selatan', 'Balikpapan Kota', 'Balikpapan Tengah', 'Balikpapan Utara', 'Balikpapan Timur']),
      makeDaerah('kaltim-bontang', 'Kota', 'Bontang', 'kota industri gas alam cair dan pupuk nasional', ['Bontang Utara', 'Bontang Selatan', 'Bontang Barat']),
      makeDaerah('kaltim-ppu', 'Kabupaten', 'Penajam Paser Utara', 'kawasan utama Ibu Kota Nusantara (IKN) dan penyangga strategis', ['Sepaku', 'Penajam', 'Waru', 'Babulu']),
      makeDaerah('kaltim-kukar', 'Kabupaten', 'Kutai Kartanegara', 'kawasan penyangga IKN dengan kekayaan energi dan agribisnis', ['Tenggarong', 'Loa Janan', 'Samboja', 'Sanga-Sanga'])
    ]),
    makeReg('wil-kaltara', 'Kalimantan Utara', 'WITA', 'provinsi termuda di Kalimantan dengan pelabuhan ekspor dan kawasan industri hijau KIPI', [
      makeDaerah('kaltara-tarakan', 'Kota', 'Tarakan', 'pusat perdagangan, bandara internasional, dan perikanan Pulau Tarakan', ['Tarakan Tengah', 'Tarakan Timur', 'Tarakan Barat', 'Tarakan Utara']),
      makeDaerah('kaltara-bulungan', 'Kabupaten', 'Bulungan', 'ibu kota provinsi (Tanjung Selor) dan kawasan industri hijau Tanah Kuning', ['Tanjung Selor', 'Tanjung Palas', 'Bunyu'])
    ]),

    // === SULAWESI (6 Provinsi) ===
    makeReg('wil-sulut', 'Sulawesi Utara', 'WITA', 'gerbang Pasifik Indonesia dengan pelabuhan hub internasional Bitung dan pariwisata Bunaken', [
      makeDaerah('sulut-manado', 'Kota', 'Manado', 'ibu kota provinsi dan pusat bisnis jasa Sulawesi Utara', ['Wenang', 'Sario', 'Malalayang', 'Mapanget', 'Tikala', 'Wanea']),
      makeDaerah('sulut-bitung', 'Kota', 'Bitung', 'kota pelabuhan samudera internasional dan KEK industri perikanan', ['Maesa', 'Madidir', 'Matuari', 'Aertembaga']),
      makeDaerah('sulut-tomohon', 'Kota', 'Tomohon', 'kota bunga, pendidikan, dan wisata dataran tinggi Minahasa', ['Tomohon Tengah', 'Tomohon Utara', 'Tomohon Selatan']),
      makeDaerah('sulut-minahasa-utara', 'Kabupaten', 'Minahasa Utara', 'kawasan KEK Pariwisata Likupang dan penyangga Manado-Bitung', ['Airmadidi', 'Kalawat', 'Likupang Timur'])
    ]),
    makeReg('wil-gorontalo', 'Gorontalo', 'WITA', 'sentra agribisnis jagung, perikanan Teluk Tomini, dan perdagangan Sulawesi bagian utara', [
      makeDaerah('gorontalo-kota', 'Kota', 'Gorontalo', 'ibu kota provinsi dan pusat niaga utama Gorontalo', ['Kota Selatan', 'Kota Tengah', 'Kota Utara', 'Dungingi', 'Sipatana']),
      makeDaerah('gorontalo-kab', 'Kabupaten', 'Gorontalo', 'kawasan Bandara Djalaluddin dan sentra pertanian Limboto', ['Limboto', 'Telaga', 'Tibawa'])
    ]),
    makeReg('wil-sulteng', 'Sulawesi Tengah', 'WITA', 'pusat hilirisasi nikel nasional, koridor Teluk Palu, dan pelabuhan Pantoloan', [
      makeDaerah('sulteng-palu', 'Kota', 'Palu', 'ibu kota provinsi dan pusat bisnis jasa di Teluk Palu', ['Palu Selatan', 'Palu Timur', 'Palu Barat', 'Palu Utara', 'Mantikulore']),
      makeDaerah('sulteng-morowali', 'Kabupaten', 'Morowali', 'kawasan industri hilirisasi nikel terpadu terbesar di Indonesia', ['Bahodopi', 'Bungku Tengah', 'Bungku Barat']),
      makeDaerah('sulteng-banggai', 'Kabupaten', 'Banggai', 'pusat perdagangan dan energi migas Sulawesi Tengah bagian timur (Luwuk)', ['Luwuk', 'Luwuk Selatan', 'Batui'])
    ]),
    makeReg('wil-sulbar', 'Sulawesi Barat', 'WITA', 'kawasan agribisnis kakao-kelapa dan jalur logistik Selat Makassar', [
      makeDaerah('sulbar-mamuju', 'Kabupaten', 'Mamuju', 'ibu kota Provinsi Sulawesi Barat dan pusat pemerintahan', ['Mamuju', 'Simboro', 'Kalukku']),
      makeDaerah('sulbar-polman', 'Kabupaten', 'Polewali Mandar', 'sentra perdagangan padat dan perikanan pesisir selatan Sulbar', ['Polewali', 'Wonomulyo', 'Campalagian'])
    ]),
    makeReg('wil-sulsel', 'Sulawesi Selatan', 'WITA', 'hub utama ekonomi, logistik, dan pendidikan Indonesia bagian timur', [
      makeDaerah('sulsel-makassar', 'Kota', 'Makassar', 'metropolitan gerbang Indonesia Timur dengan pelabuhan Soekarno-Hatta', ['Panakkukang', 'Rappocini', 'Tamalanrea', 'Biringkanaya', 'Makassar', 'Ujung Pandang']),
      makeDaerah('sulsel-parepare', 'Kota', 'Parepare', 'kota pelabuhan niaga bagian tengah Sulawesi Selatan', ['Bacukiki', 'Ujung', 'Soreang']),
      makeDaerah('sulsel-palopo', 'Kota', 'Palopo', 'pusat perdagangan dan pendidikan wilayah Luwu Raya', ['Wara', 'Wara Timur', 'Wara Utara']),
      makeDaerah('sulsel-gowa', 'Kabupaten', 'Gowa', 'penyangga selatan Makassar dan kawasan pendidikan tinggi', ['Somba Opu', 'Pallangga', 'Bontomarannu']),
      makeDaerah('sulsel-maros', 'Kabupaten', 'Maros', 'lokasi Bandara Internasional Sultan Hasanuddin dan kawasan industri', ['Turikale', 'Mandai', 'Marusu'])
    ]),
    makeReg('wil-sultra', 'Sulawesi Tenggara', 'WITA', 'kawasan pertambangan nikel, pariwisata bahari Wakatobi, dan perdagangan Teluk Kendari', [
      makeDaerah('sultra-kendari', 'Kota', 'Kendari', 'ibu kota provinsi dan pusat niaga Sulawesi Tenggara', ['Mandonga', 'Kadia', 'Baruga', 'Poasia', 'Kendari Barat']),
      makeDaerah('sultra-baubau', 'Kota', 'Baubau', 'kota pelabuhan strategis Pulau Buton dan jalur pelayaran timur', ['Wolio', 'Murhum', 'Betoambari']),
      makeDaerah('sultra-konawe', 'Kabupaten', 'Konawe', 'sentra industri smelter dan lumbung pangan Sulawesi Tenggara', ['Unaaha', 'Bondoala', 'Morosi'])
    ]),

    // === MALUKU & PAPUA (8 Provinsi) ===
    makeReg('wil-maluku', 'Maluku', 'WIT', 'gugus kepulauan rempah, perikanan laut dalam, dan kota musik Ambon', [
      makeDaerah('maluku-ambon', 'Kota', 'Ambon', 'ibu kota provinsi dan pusat perdagangan serta pendidikan di Maluku', ['Sirimau', 'Nusaniwe', 'Baguala', 'Teluk Ambon', 'Leitimur Selatan']),
      makeDaerah('maluku-tual', 'Kota', 'Tual', 'kota pelabuhan perikanan di Kepulauan Kei', ['Pulau Dullah Selatan', 'Pulau Dullah Utara']),
      makeDaerah('maluku-malteng', 'Kabupaten', 'Maluku Tengah', 'sentra perkebunan pala-cengkeh dan wisata Pulau Seram', ['Kota Masohi', 'Salahutu', 'Leihitu'])
    ]),
    makeReg('wil-malut', 'Maluku Utara', 'WIT', 'pusat hilirisasi nikel Halmahera, perdagangan kepulauan, dan rempah historis', [
      makeDaerah('malut-ternate', 'Kota', 'Ternate', 'pusat perdagangan, bandara, dan jasa utama Maluku Utara', ['Ternate Tengah', 'Ternate Selatan', 'Ternate Utara', 'Kota Ternate Barat']),
      makeDaerah('malut-tidore', 'Kota', 'Tidore Kepulauan', 'kawasan pemerintahan Sofifi dan pusat maritim historis', ['Tidore', 'Oba Utara (Sofifi)', 'Tidore Selatan']),
      makeDaerah('malut-halteng', 'Kabupaten', 'Halmahera Tengah', 'kawasan industri baterai dan smelter Weda Bay', ['Weda', 'Weda Tengah', 'Weda Utara'])
    ]),
    makeReg('wil-papua', 'Papua', 'WIT', 'gerbang utama pesisir utara Papua dengan pelabuhan Jayapura dan Bandara Sentani', [
      makeDaerah('papua-jayapura-kota', 'Kota', 'Jayapura', 'ibu kota Provinsi Papua dan pusat niaga Teluk Yos Sudarso', ['Jayapura Utara', 'Jayapura Selatan', 'Abepura', 'Heram', 'Muara Tami']),
      makeDaerah('papua-jayapura-kab', 'Kabupaten', 'Jayapura', 'lokasi Bandara Internasional Sentani dan kawasan agribisnis', ['Sentani', 'Sentani Timur', 'Waibu']),
      makeDaerah('papua-biak', 'Kabupaten', 'Biak Numfor', 'pusat perikanan dan pelabuhan udara strategis Teluk Cenderawasih', ['Biak Kota', 'Samofa', 'Yendidori'])
    ]),
    makeReg('wil-papbar', 'Papua Barat', 'WIT', 'kawasan energi LNG Teluk Bintuni, pendidikan Manokwari, dan kehutanan lestari', [
      makeDaerah('papbar-manokwari', 'Kabupaten', 'Manokwari', 'ibu kota Provinsi Papua Barat dan pusat layanan regional', ['Manokwari Barat', 'Manokwari Timur', 'Manokwari Selatan', 'Prafi']),
      makeDaerah('papbar-fakfak', 'Kabupaten', 'Fakfak', 'sentra pala Tomandin dan pelabuhan pesisir selatan Papua Barat', ['Fakfak', 'Fakfak Tengah', 'Pariwari'])
    ]),
    makeReg('wil-papsel', 'Papua Selatan', 'WIT', 'lumbung pangan nasional kawasan Merauke dan gerbang selatan Papua', [
      makeDaerah('papsel-merauke', 'Kabupaten', 'Merauke', 'ibu kota Provinsi Papua Selatan dan sentra pertanian modern', ['Merauke', 'Semangga', 'Tanah Miring', 'Kurik']),
      makeDaerah('papsel-bovendigoel', 'Kabupaten', 'Boven Digoel', 'kawasan perkebunan dan simpul logistik pedalaman selatan', ['Mandobo', 'Jair'])
    ]),
    makeReg('wil-papteng', 'Papua Tengah', 'WIT', 'pusat pertambangan kelas dunia Mimika dan simpul perdagangan pegunungan tengah', [
      makeDaerah('papteng-mimika', 'Kabupaten', 'Mimika', 'pusat industri pertambangan Timika dan Bandara Mozes Kilangin', ['Mimika Baru', 'Kuala Kencana', 'Wania', 'Tembagapura']),
      makeDaerah('papteng-nabire', 'Kabupaten', 'Nabire', 'ibu kota Provinsi Papua Tengah dan pusat niaga Teluk Cenderawasih', ['Nabire', 'Nabire Barat', 'Wanggar'])
    ]),
    makeReg('wil-pappeg', 'Papua Pegunungan', 'WIT', 'kawasan Lembah Baliem Wamena dengan potensi kopi arabika pegunungan dan ekowisata', [
      makeDaerah('pappeg-jayawijaya', 'Kabupaten', 'Jayawijaya', 'ibu kota Provinsi Papua Pegunungan (Wamena) dan pusat kopi pegunungan', ['Wamena', 'Hubikosi', 'Assolokobal', 'Asotipo']),
      makeDaerah('pappeg-yahukimo', 'Kabupaten', 'Yahukimo', 'kawasan dataran tinggi selatan pegunungan tengah', ['Dekai', 'Kurima'])
    ]),
    makeReg('wil-pabarda', 'Papua Barat Daya', 'WIT', 'gerbang utama Kepala Burung Papua (Sorong) dan destinasi bahari dunia Raja Ampat', [
      makeDaerah('pabarda-sorong-kota', 'Kota', 'Sorong', 'ibu kota Provinsi Papua Barat Daya dan hub perdagangan-migas utama', ['Sorong', 'Sorong Barat', 'Sorong Timur', 'Sorong Manoi', 'Sorong Utara']),
      makeDaerah('pabarda-sorong-kab', 'Kabupaten', 'Sorong', 'kawasan Ekonomi Khusus (KEK) Sorong dan agribisnis', ['Aimas', 'Mariat', 'Mayamuk']),
      makeDaerah('pabarda-rajaampat', 'Kabupaten', 'Raja Ampat', 'destinasi wisata bahari kelas dunia dan konservasi laut', ['Kota Waisai', 'Waigeo Selatan', 'Misool Selatan'])
    ])
  ];
}));
