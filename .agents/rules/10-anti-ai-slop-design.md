# Standar Desain UI/UX & Kualitas Visual (Anti-AI Slop)

Aturan ini memastikan antarmuka pengguna **Global HL7 FHIR Learning Lab** tetap profesional, ergonomis, berdensitas informasi tinggi, dan terbebas dari artefak desain generik ("AI slop").

---

## 1. Prinsip Desain Utama

1. **Information Density & Clarity**:
   - Ditujukan untuk tenaga ahli IT rumah sakit, data engineer, dan analis medis.
   - Gunakan layout kompak, padding proporsional (`p-2`, `p-3`, `p-4`), bukan whitespace berlebih tanpa tujuan.
   - Tema utama terang: panel `bg-white`, kanvas `bg-slate-50`, separator `border-slate-200`, judul `text-slate-900`, teks utama `text-slate-700`, dan teks sekunder `text-slate-600`.
   - Font UI memakai `"Segoe UI Variable Text"`, `"Segoe UI"`, lalu system sans-serif; tidak bergantung pada unduhan font eksternal. Body 14 px, judul 16–20 px, metadata/kode minimal 12 px dengan line-height yang lapang.
   - Monospace (`"Cascadia Code"`, `"SFMono-Regular"`, Consolas, lalu monospace) untuk JSON FHIR, schema SQL, query console, dan identifier medis.
2. **Standardized Status Color Coding**:
   - **SATUSEHAT Baseline**: Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`).
   - **Partial / Extended**: Amber (`bg-amber-50 text-amber-800 border-amber-200`).
   - **Pioneer Global FHIR**: Sky/Blue (`bg-sky-50 text-sky-800 border-sky-200`).
   - Aksi utama memakai `bg-teal-700 text-white`; seleksi memakai permukaan teal pucat dan teks teal gelap. Jangan memakai warna teks pastel tema gelap di atas latar putih.
3. **No Gratuitous Animations / Generic Slop**:
   - Hindari transisi lambat (>250ms), floating generic cards, atau ilustrasi hiasan yang tidak informatif.
   - Setiap elemen grafis dan visual node (`@xyflow/react`) wajib merepresentasikan relasi atau alur data klinis riil.
4. **Accessible Clinical Inspection**:
   - JSON viewer harus menyediakan syntax highlighting, copy-to-clipboard cepat, dan collapsible nodes.
   - Tabel SQL harus menampilkan jumlah baris, waktu eksekusi query (latency ms), dan pagination/scroll yang stabil.
   - Semua kontrol keyboard memiliki indikator `focus-visible` yang jelas; tersedia skip link menuju ruang kerja dan dukungan `prefers-reduced-motion`.
   - Judul bab dan identifier panjang tidak boleh terpotong tanpa akses ke nilainya; gunakan wrapping atau scroll lokal untuk kode/tabel. Graph menyediakan kontrol zoom dan fit-view.
