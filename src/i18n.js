import { ref, h } from 'vue'

// [ms, en]
const S = {
  back: ['Kembali', 'Back'],
  loading: ['Memuatkan', 'Loading'],
  notFound: ['Majlis tidak dijumpai', 'Event not found'],
  notFoundSub: ['Semak semula pautan anda.', 'Please check your link.'],
  // home ("/")
  homeEyebrow: ['Undangan perkahwinan digital', 'Digital wedding invitations'],
  homeTitle: ['Sepatah dua kata untuk pengantin', 'A few words for the couple'],
  homeLede: ['Undangan, RSVP, ucapan video dan galeri kenangan, semuanya dalam satu pautan.', 'Invitation, RSVP, video wishes and keepsake galleries, all in one link.'],
  homeF1: ['Undangan & RSVP dalam talian', 'Online invitation & RSVP'],
  homeF2: ['Buku tetamu video melalui QR', 'QR video guestbook'],
  homeF3: ['Galeri ucapan & gambar untuk pengantin', 'Wish & photo galleries for the couple'],
  loadFail: ['Tidak dapat dimuatkan', "Couldn't load"],
  loadFailSub: ['Semak sambungan internet anda, kemudian cuba lagi.', 'Check your internet connection, then try again.'],
  // guestbook landing
  eyebrow: ['Ucapan untuk pengantin', 'Wishes for the couple'],
  lede: ['Tinggalkan ucapan video atau ambil gambar kenangan untuk mereka.', 'Leave a video wish or take a keepsake photo for them.'],
  btnVideo: ['Rakam ucapan video', 'Record a video wish'],
  btnVideoSub: ['Maksimum 30 saat', 'Maximum 30 seconds'],
  btnPhoto: ['Ambil gambar', 'Take a photo'],
  foot: ['Dibuka semasa majlis sahaja. Nama anda tidak wajib.', 'Open during the event only. Your name is optional.'],
  notOpen: ['Buku tetamu belum dibuka', 'The guestbook is not open yet'],
  notOpenSub: ['Ia dibuka pada {when}. Sementara itu, anda boleh menghantar ucapan melalui undangan.', 'It opens on {when}. Until then, you can send a wish through the invitation.'],
  toInvite: ['Lihat undangan', 'View the invitation'],
  closed: ['Buku tetamu telah ditutup', 'The guestbook is closed'],
  closedSub: ['Terima kasih kerana meraikan {couple}.', 'Thank you for celebrating with {couple}.'],
  // recorder
  rec: ['Merakam', 'Recording'],
  prompt: ['Sebut sepatah dua untuk pengantin', 'Say a few words for the couple'],
  tap: ['Tekan untuk mula merakam', 'Tap to start recording'],
  start: ['Mula merakam', 'Start recording'],
  stop: ['Berhenti merakam', 'Stop recording'],
  phoneCam: ['Kamera tidak berfungsi? Guna kamera telefon', 'Camera not working? Use your phone camera'],
  errTitle: ['Kamera tidak dapat dibuka', "Camera couldn't open"],
  errBody: ['Benarkan akses kamera dalam tetapan pelayar anda.', 'Allow camera access in your browser settings.'],
  retry: ['Cuba lagi', 'Try again'],
  tooLong: ['Video terlalu panjang. Maksimum 30 saat.', 'Video too long. Maximum 30 seconds.'],
  reviewTitle: ['Semak ucapan anda', 'Review your wish'],
  nameLabel: ['Nama anda', 'Your name'],
  optional: ['(tidak wajib)', '(optional)'],
  ph: ['Contoh: Puan Rosnah', 'e.g. Puan Rosnah'],
  consent: ['Dengan menghantar, anda bersetuju ucapan ini dikongsi dengan pengantin.', 'By sending, you agree this wish is shared with the couple.'],
  send: ['Hantar ucapan', 'Send wish'],
  sending: ['Menghantar', 'Sending'],
  upFail: ['Gagal menghantar. Semak sambungan anda, kemudian cuba lagi.', "Couldn't send. Check your connection, then try again."],
  retake: ['Rakam semula', 'Record again'],
  debug: ['Maklumat ujian', 'Test info'],
  copy: ['Salin', 'Copy'],
  copied: ['Disalin', 'Copied'],
  // done
  thanks: ['Terima kasih!', 'Thank you!'],
  doneVideo: ['Ucapan anda telah dihantar kepada {couple}. Mereka akan menontonnya selepas majlis.', 'Your wish has been sent to {couple}. They will watch it after the event.'],
  donePhoto: ['Gambar anda telah dihantar. Ia akan muncul di skrin selepas diluluskan.', 'Your photo has been sent. It will appear on the screen once approved.'],
  nextPhoto: ['Ambil gambar pula', 'Take a photo too'],
  nextVideo: ['Rakam ucapan video', 'Record a video wish'],
  // photo
  photoTitle: ['Ambil gambar', 'Take a photo'],
  frame: ['Bingkai', 'Frame'],
  shutter: ['Ambil gambar', 'Take photo'],
  photoHint: ['Gambar masuk ke galeri gambar pengantin', "Photos go to the couple's photo gallery"],
  photoReview: ['Semak gambar anda', 'Review your photo'],
  sendPhoto: ['Hantar gambar', 'Send photo'],
  retakePhoto: ['Ambil semula', 'Retake'],
  flip: ['Tukar kamera', 'Switch camera'],
  layout: ['Susun atur', 'Layout'],
  single: ['Satu gambar', 'Single'],
  strip: ['Jalur (3)', 'Strip (3)'],
  stripHint: ['3 gambar, kiraan 3 saat sebelum setiap satu', '3 photos, a 3-second countdown before each'],
  theirFrame: ['Reka bentuk pengantin', "The couple's design"],
  kadAlt: ['Kad undangan {couple}', 'Invitation card for {couple}'],
  // couple gallery
  galEyebrow: ['Galeri ucapan & gambar', 'Wishes & photos'],
  galPre: ['Ucapan awal', 'Early wishes'],
  galEvent: ['Buku tetamu', 'Guestbook'],
  galPhoto: ['Gambar', 'Photos'],
  galExpires: ['Galeri ini akan dipadam pada {when}. Muat turun apa yang ingin anda simpan sebelum itu.', 'This gallery will be deleted on {when}. Download anything you want to keep before then.'],
  share: ['Kongsi pautan', 'Share link'],
  download: ['Muat turun', 'Download'],
  downloadAll: ['Muat turun semua (.zip)', 'Download all (.zip)'],
  downloading: ['Memuat turun {done}/{total}', 'Downloading {done}/{total}'],
  dlHint: ['Video bersaiz besar. Biarkan halaman ini terbuka sehingga muat turun selesai.', 'Videos are large. Keep this page open until the download finishes.'],
  zipFail: ['Muat turun terhenti. Semak sambungan anda, kemudian cuba lagi.', 'The download stopped. Check your connection, then try again.'],
  anon: ['Tanpa nama', 'Anonymous'],
  view: ['Lihat gambar', 'View photo'],
  close: ['Tutup', 'Close'],
  galEmpty: ['Belum ada apa-apa di sini', 'Nothing here yet'],
  galEmptyPre: ['Ucapan video yang dihantar bersama undangan akan muncul di sini.', 'Video wishes sent with the invitation will appear here.'],
  galEmptyEvent: ['Ucapan video daripada QR buku tetamu di majlis akan muncul di sini.', 'Video wishes from the guestbook QR at the event will appear here.'],
  galEmptyPhoto: ['Gambar yang diambil oleh tetamu di majlis akan muncul di sini.', 'Photos taken by guests at the event will appear here.'],
  galMissing: ['Galeri tidak dijumpai', 'Gallery not found'],
  galExpired: ['Galeri telah dipadam', 'This gallery has been deleted'],
  galExpiredSub: ['Ucapan dan gambar dipadam secara automatik selepas tempoh simpanan, untuk menjaga privasi tetamu.', "Wishes and photos are deleted automatically after the keeping period, to protect guests' privacy."],
  // invitation
  inviteEyebrow: ['Walimatul Urus', 'Wedding Reception'],
  coverTo: ['Kepada tetamu yang dihormati', 'To our honoured guests'],
  open: ['Buka Undangan', 'Open Invitation'],
  tapOpen: ['Sentuh sampul untuk membuka', 'Tap the envelope to open'],
  music: ['Muzik', 'Music'],
  inviteIntro: ['dengan segala hormatnya mempersilakan tuan/puan seisi keluarga ke majlis perkahwinan anakanda kami', 'request the pleasure of your company and family at the wedding of our children'],
  days: ['Hari', 'Days'],
  hours: ['Jam', 'Hours'],
  mins: ['Minit', 'Mins'],
  secs: ['Saat', 'Secs'],
  whenWhere: ['Tarikh & tempat', 'Date & venue'],
  addCal: ['Simpan dalam kalendar', 'Add to calendar'],
  icsTitle: ['Walimatul Urus {couple}', 'Wedding of {couple}'],
  agenda: ['Aturcara majlis', 'Programme'],
  rsvp: ['Sahkan kehadiran', 'RSVP'],
  yes: ['Hadir', 'Attending'],
  no: ['Tidak hadir', 'Not attending'],
  guests: ['Bilangan tetamu (termasuk anda)', 'Number of guests (including you)'],
  message: ['Ucapan untuk pengantin', 'A wish for the couple'],
  messagePh: ['Selamat pengantin baru, semoga berbahagia hingga ke Jannah.', 'Congratulations, wishing you a lifetime of happiness.'],
  rsvpConsent: ['Jawapan anda hanya dikongsi dengan pengantin dan penganjur majlis.', 'Your reply is only shared with the couple and the event organiser.'],
  rsvpSend: ['Hantar jawapan', 'Send reply'],
  rsvpDone: ['Terima kasih! Jawapan anda telah diterima.', 'Thank you! Your reply has been received.'],
  donePre: ['Ucapan anda telah dihantar kepada {couple}.', 'Your wish has been sent to {couple}.'],
  backInvite: ['Kembali ke undangan', 'Back to the invitation'],
  contact: ['Untuk sebarang pertanyaan', 'Contact'],
  call: ['Telefon', 'Call'],
  privacy: ['Notis privasi', 'Privacy notice'],
  madeWith: ['Dibuat dengan', 'Made with'],
  privacyBody: [
    'Nama, jawapan kehadiran dan ucapan video anda hanya digunakan untuk majlis ini dan dikongsi dengan pengantin. Ucapan video dan gambar dipadam secara automatik beberapa hari selepas majlis. Untuk memadam maklumat anda lebih awal, hubungi penganjur majlis.',
    'Your name, RSVP and video wish are only used for this event and shared with the couple. Video wishes and photos are deleted automatically a few days after the event. To have your details removed sooner, contact the event organiser.',
  ],
}

const stored = (() => { try { return localStorage.getItem('sepatah-lang') } catch { return null } })()
export const lang = ref(stored || 'ms')
document.documentElement.lang = lang.value

export const t = (k, vars) => {
  let s = S[k][lang.value === 'ms' ? 0 : 1]
  for (const v in vars) s = s.replace(`{${v}}`, vars[v])
  return s
}
export function setLang(l) {
  lang.value = l
  document.documentElement.lang = l
  try { localStorage.setItem('sepatah-lang', l) } catch {}
}
// The event's default language applies until the guest picks one
export const initLang = (def) => !stored && def && (lang.value = document.documentElement.lang = def)

export const dateStr = (d) =>
  new Date(d.length === 10 ? d + 'T00:00' : d).toLocaleDateString(lang.value === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'long', year: 'numeric' })
// Majlis times are Malaysian time, wherever the guest opens the link
export const timeStr = (d) =>
  new Date(d).toLocaleTimeString(lang.value === 'ms' ? 'ms-MY' : 'en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })

export const LangToggle = () =>
  h('div', { class: 'lang', role: 'group', 'aria-label': 'Bahasa / Language' },
    ['ms', 'en'].map((l) => h('button', { key: l, 'aria-pressed': lang.value === l, onClick: () => setLang(l) }, l.toUpperCase())))
